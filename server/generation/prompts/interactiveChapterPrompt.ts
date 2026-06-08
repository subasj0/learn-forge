import { readFileSync } from 'fs';
import path from 'path';
import { CHAPTER_COMPONENT_NAMES } from '../../../src/chapter-components/contracts';
import type { CourseOutlineChapter, GenerationConfig, SourceFile } from '../types';

const MAX_ATTACHED_FILE_CHARS = 12000;
const MAX_ATTACHED_CONTEXT_CHARS = 30000;

function trimText(text: string, maxChars: number) {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated]` : text;
}

function readOptional(relativePath: string) {
  try {
    return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
  } catch {
    return '';
  }
}

export function buildInteractiveChapterPrompt(args: {
  courseContext: string;
  partTitle: string;
  chapter: CourseOutlineChapter;
  personalization?: any;
  generationConfig?: GenerationConfig;
  files?: SourceFile[];
}) {
  const { courseContext, partTitle, chapter, personalization = {}, generationConfig = {}, files = [] } = args;
  const guidelines = readOptional('src/lib/agents/prompts/interactive_course_guidelines.md');
  let attachedChars = 0;
  const fileContext = files
    .filter((file) => file.text && attachedChars < MAX_ATTACHED_CONTEXT_CHARS)
    .map((file) => {
      const clipped = trimText(file.text || '', MAX_ATTACHED_FILE_CHARS);
      attachedChars += clipped.length;
      return `\n--- File: ${file.name} ---\n${clipped}\n--- End of File ---`;
    })
    .join('\n');

  const contentGuide = [
    `Target Audience: ${generationConfig.depth || personalization.depth || personalization.complexity || 'Intermediate'}`,
    `Tone: ${generationConfig.tone || personalization.tone || 'Balanced'}`,
    generationConfig.focus ? `Specific Focus: ${generationConfig.focus}` : '',
    generationConfig.guidance ? `Chapter-Specific Custom Instructions: ${generationConfig.guidance}` : '',
    personalization.interests ? `Personalized Context: Integrate examples related to ${personalization.interests}.` : '',
  ].filter(Boolean).join('\n- ');

  const chapterObjectives = generationConfig.guidance || chapter.guidance || 'Teach the chapter topic clearly with one strong model and one applied example.';
  const injectedComponents = CHAPTER_COMPONENT_NAMES.join(', ');

  return `You are a world-class React developer and educational designer.
Generate a single default-exported React component for an interactive educational chapter.

Core Directive:
Create a calm, structured, premium learning chapter by composing the predefined Learn Forge chapter components. Do not invent a separate design system, card library, or color palette.

Mandatory Rules:
- Output ONLY the raw component code. No markdown fences.
- Default export ONLY.
- Do not include imports. React hooks, lucide icons, motion, recharts, cn, chapterTheme, and these injected chapter components are already in scope: ${injectedComponents}.
- Accept \`{ theme = chapterTheme }\` and pass \`theme={theme}\` to every predefined chapter component.
- Use \`ChapterHero\` for the hero block.
- Use numbered \`Section\` blocks for the main chapter flow.
- Use \`ProcessFlow\`, \`Timeline\`, \`DataTable\`, or a simple chart for the core model.
- Use \`Quizz\` for quiz interactions instead of building a custom quiz UI.
- Route all color styling through \`theme\` tokens. Do not use raw Tailwind color classes.
- Keep interactivity to 1-2 blocks with labeled controls and visible feedback.
- Make the chapter specific to the topic. No placeholders, TODOs, or developer notes.

Chapter Context:
- Course: ${courseContext}
- Part: ${partTitle}
- Chapter: ${chapter.title}
- Objectives: ${chapterObjectives}

Content Personalization:
- ${contentGuide}

Applied Guidelines:
${guidelines || 'Follow the Learn Forge interactive chapter component contract.'}

Output ONLY the raw component code. Ensure the component is robust, complete, and does not crash when rendered with no props.
${fileContext}`;
}
