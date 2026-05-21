import { GoogleGenAI } from '@google/genai';

function getAi() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
}

export async function completeChat(args: { chapterText: string; message: string; history?: any[] }) {
  const systemPrompt = `You are a helpful and educational AI assistant accompanying an interactive online course.
Relevant chapter content context:
---
${args.chapterText.substring(0, 40000)}
---
Answer the user's question, summarize, or modify the text as requested. Use standard markdown formatting. Provide concise and helpful answers.`;

  const contents = [
    ...(args.history || []),
    { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request:\n${args.message}` }] },
  ];

  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
    config: { maxOutputTokens: 10000 },
  });
  return response.text || '';
}

export async function generateChatTitle(message: string) {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a very short title (4-5 words max) for a chat that starts with this message:\n"${message}"\n\nOutput only the title, no quotes or additional text.`,
  });
  return response.text?.trim() || 'New Chat';
}
