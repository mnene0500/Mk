import { createClient } from '@supabase/supabase-js';

/**
 * @fileOverview Central Supabase Client for the browser and server.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Robust base64 to binary conversion for storage.
 * Final version ensures proper MIME type extraction and clean binary upload.
 */
export async function uploadBase64Image(base64: string, bucket: string, path: string): Promise<string> {
  try {
    // If it's already a URL, return it
    if (base64.startsWith('http')) return base64;

    // 1. Extract clean base64 data and MIME type
    const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
      console.error("[Storage] Invalid format for", path);
      throw new Error("Invalid image string format.");
    }

    const contentType = matches[1];
    const b64Data = matches[2];

    // 2. Convert to binary using native browser APIs
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

    const blob = new Blob(byteArrays, { type: contentType });

    // 3. Upload to Supabase Storage
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType,
      upsert: true,
      cacheControl: '3600'
    });

    if (error) {
      console.error("[Storage API Error]", error);
      throw error;
    }

    // 4. Return the public URL
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  } catch (err: any) {
    console.error("[Storage Upload Crash]", err.message);
    throw err;
  }
}
