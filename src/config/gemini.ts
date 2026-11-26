import { GoogleGenAI } from "@google/genai";

import { env } from "./env.js";

// Create one reusable Gemini client for the application.
// We should not create a new client for every chunk.
export const geminiClient = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});