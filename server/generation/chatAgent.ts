import { buildOpenAIChatInput, generateOpenAIText } from './openai';

export async function completeChat(args: { chapterText: string; message: string; history?: any[] }) {
  const systemPrompt = `You are a helpful and educational AI assistant accompanying an interactive online course.
Relevant chapter content context:
---
${args.chapterText.substring(0, 40000)}
---
Answer the user's question, summarize, or modify the text as requested. Use standard markdown formatting. Provide concise and helpful answers.`;

  return generateOpenAIText({
    input: buildOpenAIChatInput({
      systemPrompt,
      history: args.history,
      message: args.message,
    }),
    maxOutputTokens: 10000,
  });
}

export async function generateChatTitle(message: string) {
  const responseText = await generateOpenAIText({
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: `Create a very short title (4-5 words max) for a chat that starts with this message:\n"${message}"\n\nOutput only the title, no quotes or additional text.` }],
      },
    ],
  });
  return responseText.trim() || 'New Chat';
}
