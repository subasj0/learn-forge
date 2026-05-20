import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a string (e.g. JSON, HTML, Markdown) to Firebase Storage
 * @param path The path in storage
 * @param content The string content
 * @param contentType The MIME type
 * @returns The download URL
 */
export async function uploadContent(path: string, content: string, contentType: string = 'application/json'): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, content, 'raw', { contentType });
  return await getDownloadURL(storageRef);
}

/**
 * Uploads data (e.g. Blob, Uint8Array) to Firebase Storage
 * @param path The path in storage 
 * @param data The binary data
 * @param contentType The MIME type
 * @returns The download URL
 */
export async function uploadBinary(path: string, data: Blob | Uint8Array | ArrayBuffer, contentType: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, data, { contentType });
  return await getDownloadURL(storageRef);
}

/**
 * Fetches JSON content from a URL
 * @param url The download URL
 * @returns The parsed JSON content
 */
export async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch content from ${url}`);
  }
  return await response.json();
}
