import { readFileSync } from 'fs';
import path from 'path';
import type { CourseOutlineChapter, GenerationConfig, SourceFile } from '../types';

const MAX_SKILL_CONTEXT_CHARS = 1200;
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

function getSkillsContext() {
  const files = [
    'src/lib/agents/skills/motion_animations.md',
    'src/lib/agents/skills/quizzes_and_logic.md',
    'src/lib/agents/skills/recharts_data_viz.md',
    'src/lib/agents/skills/svg_diagrams.md',
  ];
  return files.map((file) => `--- Skill: ${path.basename(file)} ---\n${trimText(readOptional(file), MAX_SKILL_CONTEXT_CHARS)}`).join('\n\n');
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
  const courseLower = `${courseContext} ${chapter.title}`.toLowerCase();
  const recommendedTheme = courseLower.includes('tech') || courseLower.includes('coding') || courseLower.includes('quantum') || courseLower.includes('space')
    ? 'Tech/Sci-Fi'
    : courseLower.includes('bio') || courseLower.includes('botany') || courseLower.includes('nature') || courseLower.includes('garden')
      ? 'Nature/Organic'
      : 'Deep Academic';

  const guidelines = readOptional('src/lib/agents/prompts/interactive_course_guidelines.md');
  const skillsContext = getSkillsContext();
  let attachedChars = 0;
  const fileContext = files
    .filter((file) => file.text && attachedChars < MAX_ATTACHED_CONTEXT_CHARS)
    .map((file) => {
      const clipped = trimText(file.text || '', MAX_ATTACHED_FILE_CHARS);
      attachedChars += clipped.length;
      return `\n--- File: ${file.name} ---\n${clipped}\n--- End of File ---`;
    })
    .join('\n');

  const styleGuide = [
    `Theme Recommendation: Use the ${recommendedTheme} style.`,
    `Target Audience: ${generationConfig.depth || personalization.depth || personalization.complexity || 'Intermediate'}`,
    `Tone: ${generationConfig.tone || personalization.tone || 'Balanced'}`,
    generationConfig.focus ? `Specific Focus: ${generationConfig.focus}` : '',
    generationConfig.guidance ? `Chapter-Specific Custom Instructions: ${generationConfig.guidance}` : '',
    personalization.interests ? `Personalized Context: Integrate examples related to ${personalization.interests}.` : '',
  ].filter(Boolean).join('\n- ');

  return `You are a world-class React developer and educational designer.
Generate a single-file React component (TypeScript) that represents an interactive, premium educational chapter.

Core Directive:
Create a "Modern Academic" experience. The chapter must feel like a high-end digital publication.

Technical Constraints:
- Default export ONLY.
- Tailwind CSS ONLY for styling.
- Lucide-react for icons.
- motion/react for animations.
- recharts for charts.
- The cn function is GLOBAL. Do not define or import it.
- NO external imports other than: react, lucide-react, motion/react, recharts.

Current Topic Context:
- Course: ${courseContext}
- Part: ${partTitle}
- Chapter: ${chapter.title}
- Objectives: ${generationConfig.guidance || chapter.guidance || ''}

Personalization:
- ${styleGuide}

Applied Guidelines:
${guidelines}

${skillsContext}

Output ONLY the raw component code in a typescript block. Ensure the component is robust and does not crash.
${fileContext}`;
}

