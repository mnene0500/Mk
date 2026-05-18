import { config } from 'dotenv';
config();

import '@/ai/flows/suggested-chat-responses.ts';
import '@/ai/flows/chat-history-summarizer.ts';
import '@/ai/flows/verify-identity-flow.ts';
import '@/ai/flows/automated-conversation-summary.ts';
