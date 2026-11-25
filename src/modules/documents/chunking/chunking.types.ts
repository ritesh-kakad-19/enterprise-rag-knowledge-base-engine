/**
 * Represents one chunk created from a document.
 *
 * Metadata helps us identify the source document,
 * locate the chunk, and later provide citations.
 */
export interface DocumentChunk {
  // ID of the original document in PostgreSQL.
  documentId: string;

  // Position of this chunk in the document.
  // Zero-based: first chunk = 0, second chunk = 1.
  chunkIndex: number;

  // Actual text that will later be converted into an embedding.
  text: string;

  // Number of characters in this chunk.
  characterCount: number;

  // Starting character position in the cleaned document.
  startChar: number;

  // Ending character position (exclusive).
  endChar: number;

  // Reserved for future page-aware extraction.
  // Currently unavailable because our extractors
  // return the document's combined text.
  pageNumber?: number;
}