'use server';
/**
 * @fileOverview An AI agent that synthesizes conversation history into actionable flow insights.
 *
 * - automatedConversationSummary - A function that handles the conversation synthesis process.
 * - ConversationSummaryInput - The input type for the automatedConversationSummary function.
 * - ConversationSummaryOutput - The return type for the automatedConversationSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConversationSummaryInputSchema = z.object({
  conversation: z.string().describe('The full conversation text to be synthesized.'),
});
export type ConversationSummaryInput = z.infer<typeof ConversationSummaryInputSchema>;

const ConversationSummaryOutputSchema = z.object({
  summary: z.string().describe('A high-level synthesis of the conversation flow and key insights.'),
});
export type ConversationSummaryOutput = z.infer<typeof ConversationSummaryOutputSchema>;

export async function automatedConversationSummary(
  input: ConversationSummaryInput
): Promise<ConversationSummaryOutput> {
  return automatedConversationSummaryFlow(input);
}

const summaryPrompt = ai.definePrompt({
  name: 'automatedConversationSummaryPrompt',
  input: {schema: ConversationSummaryInputSchema},
  output: {schema: ConversationSummaryOutputSchema},
  prompt: `You are an expert social dynamics analyst. 
Analyze the following conversation from MatchFlow and provide a high-level synthesis of the interaction.

Identify:
- The general "vibe" or emotional tone.
- Key points of connection or shared interests.
- Potential next steps or suggested conversation directions.

Keep the summary concise, insightful, and encouraging.

Conversation:
{{{conversation}}}

Provide your insights:`,
});

const automatedConversationSummaryFlow = ai.defineFlow(
  {
    name: 'automatedConversationSummaryFlow',
    inputSchema: ConversationSummaryInputSchema,
    outputSchema: ConversationSummaryOutputSchema,
  },
  async input => {
    const {output} = await summaryPrompt(input);
    return output!;
  }
);
