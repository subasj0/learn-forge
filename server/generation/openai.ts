export const OPENAI_MODEL = 'gpt-5.4';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return apiKey;
}

function asInputText(text: string) {
  return [{ type: 'input_text', text }];
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  if (data?.output_parsed && typeof data.output_parsed === 'object') {
    return JSON.stringify(data.output_parsed);
  }

  if (Array.isArray(data?.output)) {
    const chunks: string[] = [];
    for (const block of data.output) {
      if (!Array.isArray(block?.content)) continue;
      for (const item of block.content) {
        if (typeof item?.text === 'string' && item.text) {
          chunks.push(item.text);
          continue;
        }

        if (typeof item?.value === 'string' && item.value) {
          chunks.push(item.value);
          continue;
        }

        if (item?.json && typeof item.json === 'object') {
          chunks.push(JSON.stringify(item.json));
        }
      }
    }

    if (chunks.length) {
      return chunks.join('\n').trim();
    }
  }

  return '';
}

async function postToOpenAI(payload: Record<string, any>) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || response.statusText || 'OpenAI request failed';
    throw new Error(message);
  }

  return data;
}

export async function generateOpenAIText(args: {
  input: any;
  maxOutputTokens?: number;
  temperature?: number;
}) {
  const data = await postToOpenAI({
    model: OPENAI_MODEL,
    input: args.input,
    ...(args.maxOutputTokens ? { max_output_tokens: args.maxOutputTokens } : {}),
    ...(typeof args.temperature === 'number' ? { temperature: args.temperature } : {}),
  });

  const text = extractResponseText(data);
  if (!text) {
    throw new Error('OpenAI returned an empty text response');
  }
  return text;
}

export async function generateOpenAIJson(args: {
  input: any;
  schema: Record<string, any>;
  schemaName: string;
  maxOutputTokens?: number;
}) {
  const data = await postToOpenAI({
    model: OPENAI_MODEL,
    input: args.input,
    text: {
      format: {
        type: 'json_schema',
        name: args.schemaName,
        schema: args.schema,
        strict: true,
      },
    },
    ...(args.maxOutputTokens ? { max_output_tokens: args.maxOutputTokens } : {}),
  });

  const jsonText = extractResponseText(data);
  if (!jsonText) {
    throw new Error('OpenAI returned an empty JSON response');
  }
  return jsonText;
}

export async function extractImageText(args: { data: string; mimeType: string }) {
  const dataUrl = `data:${args.mimeType};base64,${args.data}`;
  return generateOpenAIText({
    input: [
      {
        role: 'user',
        content: [
          ...asInputText('Extract all text from this image exactly as it appears. Return ONLY the raw extracted text, nothing else.'),
          { type: 'input_image', image_url: dataUrl },
        ],
      },
    ],
  });
}

export function buildOpenAIChatInput(args: { systemPrompt: string; history?: any[]; message: string }) {
  const history = (args.history || [])
    .map((item) => {
      const text = typeof item?.content === 'string'
        ? item.content
        : (item?.parts || []).map((part: any) => part?.text || '').join('\n').trim();

      if (!text) return null;
      return {
        role: item?.role === 'model' ? 'assistant' : item?.role || 'user',
        content: asInputText(text),
      };
    })
    .filter(Boolean);

  return [
    { role: 'system', content: asInputText(args.systemPrompt) },
    ...history,
    { role: 'user', content: asInputText(args.message) },
  ];
}