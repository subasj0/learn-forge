import type { SourceFile } from '../types';

export function buildOutlinePrompt(topic: string, moduleType = 'guided', personalization: any = {}, files: SourceFile[] = []) {
  const typeGuidance = moduleType === 'quick'
    ? 'Focus purely on exploring this new topic efficiently. Do not include heavy quiz sections; keep it exploratory and fast-paced.'
    : moduleType === 'quiz'
      ? 'The primary focus is testing the user. Ensure the outline relies heavily on quizzes and knowledge checks.'
      : moduleType === 'flashcards'
        ? 'The primary focus is memorization. Keep the content bite-sized and perfect for flashcards.'
        : moduleType === 'interactive'
          ? 'The primary focus is a high-quality interactive learning module with hands-on demos and visual explanations.'
          : 'This is a guided lesson. Include a well-rounded mix of theory, practical examples, and exercises.';

  const personalizationLines = [
    personalization.complexity ? `Target Audience Complexity: ${personalization.complexity}` : '',
    personalization.intent ? `Learning Goal: ${personalization.intent}` : '',
    personalization.interests ? `Connect examples to these interests: ${personalization.interests}` : '',
  ].filter(Boolean).join('\n');

  const fileContext = files
    .filter((file) => file.text)
    .map((file) => `\n--- File: ${file.name} ---\n${file.text}\n--- End of File ---`)
    .join('\n');

  return `You are an expert curriculum designer.
Generate a comprehensive course outline.
${topic ? `Topic to guide the outline: "${topic}"` : 'Use the attached files to determine the topic and content of the course.'}
${personalizationLines}
Course Type Guidance: ${typeGuidance}

If attached documents are provided, make the outline heavily reflect and cover their content.
Structure the course into logical Parts, and within each Part, create several Chapters.
For each chapter, provide a detailed guidance string for the chapter-writing agent.
Keep the outline compact: 2-3 Parts and 3-4 Chapters per part is ideal.
Return ONLY valid JSON matching the schema.
${fileContext}`;
}

