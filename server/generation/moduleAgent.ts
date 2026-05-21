import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { buildOutlinePrompt } from './prompts/outlinePrompt';
import type { CourseOutline, SourceFile } from './types';

function getAi() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
}

const outlineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    parts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                guidance: { type: Type.STRING },
              },
              required: ['id', 'title', 'guidance'],
            },
          },
        },
        required: ['id', 'title', 'chapters'],
      },
    },
  },
  required: ['title', 'parts'],
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

function slugify(value: string, fallback: string) {
  return (value || fallback).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || fallback;
}

export async function createModuleOutline(args: {
  topic: string;
  moduleType: string;
  personalization?: any;
  files?: SourceFile[];
}): Promise<CourseOutline> {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: buildOutlinePrompt(args.topic, args.moduleType, args.personalization, args.files) }] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: outlineSchema,
      maxOutputTokens: 10000,
    },
  });

  const outline = parseJson(response.text || '{}');
  const seen = new Set<string>();
  outline.parts = (outline.parts || []).map((part: any, pIdx: number) => ({
    ...part,
    id: slugify(part.id || part.title, `part-${pIdx}`),
    chapters: (part.chapters || []).map((chapter: any, cIdx: number) => {
      let id = slugify(chapter.id || chapter.title, `chapter-${pIdx}-${cIdx}`);
      const base = id;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${base}-${suffix++}`.slice(0, 60);
      }
      seen.add(id);
      return { ...chapter, id };
    }),
  }));

  return outline;
}
