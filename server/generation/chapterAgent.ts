import { randomUUID } from 'crypto';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { buildStandardChapterPrompt } from './prompts/standardChapterPrompt';
import { buildInteractiveChapterPrompt } from './prompts/interactiveChapterPrompt';
import { writeChapterJson } from './chapterStorage';
import {
  appendChapterVersion,
  findChapter,
  getCourseForUser,
  markChapterFailed,
  markChapterGenerating,
  serializeGenerationConfig,
} from './moduleRepository';
import type { GenerationConfig, SourceFile } from './types';

function getAi() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
}

const chapterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mainContent: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          content: { type: Type.STRING },
          title: { type: Type.STRING },
          calloutType: { type: Type.STRING },
        },
        required: ['type', 'content'],
      },
    },
  },
  required: ['mainContent'],
};

function parseJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  try {
    return JSON.parse(jsonText);
  } catch {
    return JSON.parse(jsonrepair(jsonText));
  }
}

function extractCode(text: string) {
  const codeMatch = text.match(/```(?:typescript|tsx|javascript|jsx)?\n([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : text.trim();
}

export async function generateChapterVersion(args: {
  courseId: string;
  chapterId: string;
  userId: string;
  generationConfig?: GenerationConfig;
  files?: SourceFile[];
}) {
  const course = await getCourseForUser(args.courseId, args.userId);
  if (!course) throw new Error('Course not found or permission denied');

  const located = findChapter(course, args.chapterId);
  if (!located) throw new Error('Chapter not found in course outline');

  const generationConfig = serializeGenerationConfig(args.generationConfig);
  await markChapterGenerating(args.courseId, args.chapterId);

  try {
    let content: any;
    const moduleType = course.moduleType || 'guided';

    if (moduleType === 'interactive') {
      const responseStream = await getAi().models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [{
            text: buildInteractiveChapterPrompt({
              courseContext: course.topic,
              partTitle: located.part.title,
              chapter: located.chapter,
              personalization: course.personalization,
              generationConfig,
              files: args.files,
            }),
          }],
        },
        config: { maxOutputTokens: 15000, temperature: 0.7 },
      });

      let fullCode = '';
      for await (const chunk of responseStream) {
        if (chunk.text) fullCode += chunk.text;
      }
      content = { componentCode: extractCode(fullCode), moduleType: 'interactive' };
    } else {
      const response = await getAi().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [{
            text: buildStandardChapterPrompt({
              courseContext: course.topic,
              partTitle: located.part.title,
              chapter: located.chapter,
              moduleType,
              personalization: course.personalization,
              generationConfig,
              files: args.files,
            }),
          }],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: chapterSchema,
          maxOutputTokens: 10000,
        },
      });
      content = parseJson(response.text || '{}');
    }

    const versionId = `${Date.now()}-${randomUUID()}`;
    const storagePath = `courses/${args.courseId}/chapters/${args.chapterId}/versions/${versionId}.json`;
    await writeChapterJson(storagePath, content);

    const version = {
      versionId,
      storagePath,
      contentType: 'application/json',
      moduleType,
      createdAtMs: Date.now(),
      generationConfig,
    };
    await appendChapterVersion(args.courseId, args.chapterId, version);
    return { versionId };
  } catch (error: any) {
    await markChapterFailed(args.courseId, args.chapterId, error.message || String(error));
    throw error;
  }
}
