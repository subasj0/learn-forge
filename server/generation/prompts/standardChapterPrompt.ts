import type { CourseOutlineChapter, GenerationConfig, SourceFile } from '../types';

export function buildStandardChapterPrompt(args: {
  courseContext: string;
  partTitle: string;
  chapter: CourseOutlineChapter;
  moduleType: string;
  personalization?: any;
  generationConfig?: GenerationConfig;
  files?: SourceFile[];
}) {
  const { courseContext, partTitle, chapter, moduleType, personalization = {}, generationConfig = {}, files = [] } = args;
  const typeGuidance = moduleType === 'quick'
    ? 'Keep it highly concise and fast-paced.'
    : moduleType === 'quiz'
      ? 'Heavily emphasize interactive knowledge checks and reflection questions using try_it blocks.'
      : moduleType === 'flashcards'
        ? 'Deliver information in bite-sized, independent concepts perfect for memorization.'
        : 'Provide a balanced mix of educational theory, practical examples, and short exercises.';

  const styleGuide = [
    `Target Audience Complexity: ${generationConfig.depth || personalization.depth || personalization.complexity || 'Intermediate'}`,
    `Tone: ${generationConfig.tone || personalization.tone || 'Balanced'}`,
    generationConfig.focus ? `Specific Focus Area: ${generationConfig.focus}` : '',
    generationConfig.guidance ? `Custom Guidance: ${generationConfig.guidance}` : '',
    personalization.interests ? `Contextualize examples around these interests: ${personalization.interests}` : '',
  ].filter(Boolean).join('\n- ');

  const fileContext = files
    .filter((file) => file.text)
    .map((file) => `\n--- File: ${file.name} ---\n${file.text}\n--- End of File ---`)
    .join('\n');

  return `You are an expert educational course designer crafting a chapter for a digital learning platform.
Generate the chapter as a sequence of layout blocks.

Context:
- Course Overview: ${courseContext}
- Part: ${partTitle}
- Chapter: ${chapter.title}
- Chapter Objectives: ${generationConfig.guidance || chapter.guidance || ''}

Design Guidelines:
- ${styleGuide}
- Overall Tone: ${typeGuidance}

Available Layout Blocks:
1. heading: main section title.
2. subheading: secondary section title.
3. text: standard learning content using markdown.
4. image_placeholder: describe a specific rich visual.
5. callout: highlighted note with calloutType.
6. try_it: exercise with title and instructions.

Instructions:
- Sequence blocks logically.
- Do not output one massive text block.
- Start directly with content.
- If referencing attached files, extract relevant content directly.
- Return ONLY valid JSON matching the schema.
${fileContext}`;
}

