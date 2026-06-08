import { randomUUID } from 'crypto';
import { jsonrepair } from 'jsonrepair';
import { buildStandardChapterPrompt } from './prompts/standardChapterPrompt';
import { buildInteractiveChapterPrompt } from './prompts/interactiveChapterPrompt';
import { generateOpenAIJson, generateOpenAIText } from './openai';
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

const chapterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mainContent: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          content: { type: 'string' },
          title: { type: 'string' },
          calloutType: { type: 'string' },
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
      const fullCode = await generateOpenAIText({
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: buildInteractiveChapterPrompt({
              courseContext: course.topic,
              partTitle: located.part.title,
              chapter: located.chapter,
              personalization: course.personalization,
              generationConfig,
              files: args.files,
            }) }],
          },
        ],
        maxOutputTokens: 15000,
        temperature: 0.7,
      });
      const componentCode = extractCode(fullCode);
      if (!componentCode) {
        throw new Error('Generated interactive chapter code is empty');
      }
      content = { componentCode, moduleType: 'interactive' };
    } else {
      const responseText = await generateOpenAIJson({
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: buildStandardChapterPrompt({
              courseContext: course.topic,
              partTitle: located.part.title,
              chapter: located.chapter,
              moduleType,
              personalization: course.personalization,
              generationConfig,
              files: args.files,
            }) }],
          },
        ],
        schema: chapterSchema,
        schemaName: 'chapter_content',
        maxOutputTokens: 10000,
      });
      content = parseJson(responseText || '{}');
      if (!Array.isArray(content.mainContent) || content.mainContent.length === 0) {
        throw new Error('Generated chapter content is empty');
      }
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
