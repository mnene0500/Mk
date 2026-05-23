
import { createClient } from '@supabase/supabase-js';

/**
 * @fileOverview Central Supabase Client for the browser and server.
 * Standardized to use the 'photos' bucket with timestamped paths.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Utility to convert base64 data into a Blob/File that Supabase Storage can process.
 */
export function base64ToBlob(base64: string): { blob: Blob, contentType: string } {
  const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid image string format.");
  }

  const contentType = matches[1];
  const b64Data = matches[2];
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return { 
    blob: new Blob(byteArrays, { type: contentType }),
    contentType 
  };
}

/**
 * Uploads a profile photo to the 'photos' bucket.
 * Exact path: [userId]/[timestamp].jpg
 */
export async function uploadProfilePhoto(file: File | Blob, userId: string) {
  const filePath = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error("[Avatar Upload Error]", error);
    throw error;
  }

  const { data } = supabase.storage
    .from('photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Uploads gallery or proof photos to the 'photos' bucket.
 * Exact path: [userId]/[uuid].jpg
 */
export async function uploadPostPhoto(file: File | Blob, userId: string) {
  const filePath = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from('photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("[Gallery Upload Error]", error);
    throw error;
  }

  const { data } = supabase.storage
    .from('photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
