'use server';
/**
 * @fileOverview Biometric Verification via Supabase Edge Functions.
 * Since GenAI keys are now stored in Supabase, we delegate the analysis 
 * to an AI Edge Function to maintain security.
 */

import { supabase } from '@/lib/supabase';
import { z } from 'genkit';

const VerifyIdentityInputSchema = z.object({
  profilePhotoUrl: z.string().describe('The URL of the user\'s existing profile photo.'),
  selfieDataUri: z
    .string()
    .describe(
      "A live selfie captured by the user, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type VerifyIdentityInput = z.infer<typeof VerifyIdentityInputSchema>;

const VerifyIdentityOutputSchema = z.object({
  isMatch: z.boolean().describe('Whether the person in the selfie matches the profile photo.'),
  confidence: z.number().min(0).max(1).describe('The confidence score of the match (0 to 1).'),
  reasoning: z.string().describe('A brief explanation of the AI\'s determination.'),
});
export type VerifyIdentityOutput = z.infer<typeof VerifyIdentityOutputSchema>;

export async function verifyIdentity(input: VerifyIdentityInput): Promise<VerifyIdentityOutput> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-ops', {
      body: { 
        action: 'verify-identity',
        profilePhotoUrl: input.profilePhotoUrl,
        selfieDataUri: input.selfieDataUri
      }
    });

    if (error || !data) {
      console.error("AI Edge Function Error:", error);
      throw new Error("Identity verification service timed out.");
    }

    return {
      isMatch: data.isMatch || false,
      confidence: data.confidence || 0,
      reasoning: data.reasoning || "Verification completed via edge function."
    };
  } catch (err: any) {
    console.error("VerifyIdentity Flow Proxy Error:", err.message);
    throw err;
  }
}
