import { adminStorage } from '../firebaseAdmin';

export async function writeChapterJson(storagePath: string, value: unknown) {
  const file = adminStorage.file(storagePath);
  await file.save(JSON.stringify(value), {
    contentType: 'application/json',
    resumable: false,
  });
}

export async function readChapterJson(storagePath: string) {
  const file = adminStorage.file(storagePath);
  const [contents] = await file.download();
  return JSON.parse(contents.toString('utf8'));
}

