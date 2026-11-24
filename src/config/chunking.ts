import { env } from "./env.js";

// Centralized configuration for document chunking.
// Keeping these values together makes future tuning easier.

export const chunkingConfig = {
  // Maximum target size of each chunk in characters.
  chunkSize: env.CHUNK_SIZE_CHARS,

  // Number of characters shared between consecutive chunks.
  overlap: env.CHUNK_OVERLAP_CHARS,

  // Minimum useful chunk size in characters.
  minChunkSize: env.MIN_CHUNK_SIZE_CHARS,

  // Prefer splitting text at meaningful boundaries.
  separators: [
    "\n\n", // Paragraph boundary
    "\n",   // Line boundary
    ". ",   // Sentence boundary
    "? ",
    "! ",
    " ",    // Word boundary
  ],
} as const;