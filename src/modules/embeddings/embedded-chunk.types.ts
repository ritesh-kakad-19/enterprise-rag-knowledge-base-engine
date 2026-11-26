import type { DocumentChunk } from "../documents/chunking/chunking.types.js";

// Represents a document chunk after its embedding is generated.
export interface EmbeddedDocumentChunk extends DocumentChunk {
  embedding: number[];

  embeddingModel: string;

  embeddingDimensions: number;
}