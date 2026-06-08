import { jsonrepair } from 'jsonrepair';
import { buildOutlinePrompt } from './prompts/outlinePrompt';
import { generateOpenAIJson } from './openai';
import type { CourseOutline, SourceFile } from './types';

const outlineSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          chapters: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                guidance: { type: 'string' },
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
  const responseText = await generateOpenAIJson({
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: buildOutlinePrompt(args.topic, args.moduleType, args.personalization, args.files) }],
      },
    ],
    schema: outlineSchema,
    schemaName: 'course_outline',
    maxOutputTokens: 10000,
  });

  const outline = parseJson(responseText || '{}');
  outline.title = typeof outline.title === 'string' && outline.title.trim()
    ? outline.title.trim()
    : `${args.topic?.trim() || 'Generated Course'}`;
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

  if (!Array.isArray(outline.parts) || outline.parts.length === 0) {
    throw new Error('Generated outline is empty');
  }

  return outline;
}
