import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import type { ChapterVersionRef, CourseOutline, GenerationConfig, SourceFile } from './types';

export function courseRef(courseId: string) {
  return adminDb.collection('courses').doc(courseId);
}

export async function createCourseShell(args: {
  userId: string;
  authorName: string;
  topic: string;
  moduleType: string;
  personalization: any;
}) {
  const ref = adminDb.collection('courses').doc();
  await ref.set({
    userId: args.userId,
    authorName: args.authorName,
    title: 'Generating course...',
    topic: args.topic || 'Generated Course',
    moduleType: args.moduleType || 'guided',
    personalization: args.personalization || {},
    status: 'generating_outline',
    outline: [],
    chapterRefs: {},
    isPublic: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function markCourseOutlineReady(courseId: string, outline: CourseOutline) {
  const chapterRefs: Record<string, any> = {};
  for (const part of outline.parts || []) {
    for (const chapter of part.chapters || []) {
      chapterRefs[chapter.id] = {
        latestVersionId: null,
        generationStatus: 'idle',
        versions: [],
      };
    }
  }

  await courseRef(courseId).update({
    title: outline.title,
    outline: outline.parts,
    chapterRefs,
    status: 'ready',
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markCourseFailed(courseId: string, message: string) {
  await courseRef(courseId).update({
    status: 'failed',
    errorMessage: message,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getCourseForUser(courseId: string, userId?: string, allowPublic = false) {
  const snap = await courseRef(courseId).get();
  if (!snap.exists) return null;
  const course = { id: snap.id, ...snap.data() } as any;
  if (userId && course.userId === userId) return course;
  if (allowPublic && course.isPublic === true) return course;
  return null;
}

export async function markChapterGenerating(courseId: string, chapterId: string) {
  await courseRef(courseId).update(
    new FieldPath('chapterRefs', chapterId, 'generationStatus'), 'generating',
    new FieldPath('chapterRefs', chapterId, 'errorMessage'), FieldValue.delete(),
    'updatedAt', FieldValue.serverTimestamp(),
  );
}

export async function markChapterFailed(courseId: string, chapterId: string, message: string) {
  await courseRef(courseId).update(
    new FieldPath('chapterRefs', chapterId, 'generationStatus'), 'failed',
    new FieldPath('chapterRefs', chapterId, 'errorMessage'), message,
    'updatedAt', FieldValue.serverTimestamp(),
  );
}

export async function appendChapterVersion(courseId: string, chapterId: string, version: ChapterVersionRef) {
  await courseRef(courseId).update(
    new FieldPath('chapterRefs', chapterId, 'latestVersionId'), version.versionId,
    new FieldPath('chapterRefs', chapterId, 'generationStatus'), 'ready',
    new FieldPath('chapterRefs', chapterId, 'errorMessage'), FieldValue.delete(),
    new FieldPath('chapterRefs', chapterId, 'versions'), FieldValue.arrayUnion(version),
    'updatedAt', FieldValue.serverTimestamp(),
  );
}

export function findChapter(course: any, chapterId: string) {
  let orderIndex = 0;
  for (const part of course.outline || []) {
    for (const chapter of part.chapters || []) {
      if (chapter.id === chapterId) {
        return { part, chapter, orderIndex };
      }
      orderIndex++;
    }
  }
  return null;
}

export function findChapterVersion(course: any, chapterId: string, versionId?: string) {
  const chapterRef = course.chapterRefs?.[chapterId];
  if (!chapterRef) return null;
  const resolvedVersionId = versionId || chapterRef.latestVersionId;
  return (chapterRef.versions || []).find((version: any) => version.versionId === resolvedVersionId) || null;
}

export function serializeGenerationConfig(config: GenerationConfig = {}) {
  return {
    guidance: config.guidance || '',
    tone: config.tone || 'conversational',
    depth: config.depth || 'detailed',
    focus: config.focus || '',
  };
}

export function sanitizeFiles(files: SourceFile[] = []) {
  return files
    .filter((file) => file && typeof file.name === 'string')
    .map((file) => ({
      name: file.name.slice(0, 200),
      text: typeof file.text === 'string' ? file.text.slice(0, 120000) : '',
    }));
}

export function toMillis(value: any) {
  if (value instanceof Timestamp) return value.toMillis();
  return Date.now();
}

