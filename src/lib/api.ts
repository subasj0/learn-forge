import { auth } from './firebase';

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
}

export async function createModule(input: {
  topic: string;
  moduleType: string;
  personalization?: any;
  files?: { name: string; text?: string }[];
}) {
  const response = await fetch('/api/modules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<{ courseId: string }>;
}

export async function generateChapter(input: {
  courseId: string;
  chapterId: string;
  generationConfig?: any;
  files?: { name: string; text?: string }[];
}) {
  const response = await fetch(`/api/modules/${input.courseId}/chapters/${input.chapterId}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      generationConfig: input.generationConfig || {},
      files: input.files || [],
    }),
  });
  return parseResponse(response) as Promise<{ versionId: string }>;
}

export async function fetchChapterContent(courseId: string, chapterId: string, versionId?: string) {
  const params = new URLSearchParams();
  if (versionId) params.set('versionId', versionId);
  const response = await fetch(`/api/modules/${courseId}/chapters/${chapterId}/content?${params.toString()}`, {
    headers: await authHeaders(),
  });
  return parseResponse(response);
}

export async function completeChat(input: { chapterText: string; message: string; history?: any[] }) {
  const response = await fetch('/api/chat/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<{ text: string }>;
}

export async function createChatTitle(message: string) {
  const response = await fetch('/api/chat/title', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify({ message }),
  });
  return parseResponse(response) as Promise<{ title: string }>;
}

