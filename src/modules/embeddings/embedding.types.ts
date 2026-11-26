// Supported embedding tasks in our RAG application.
export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

// Represents one generated embedding.
export interface GeneratedEmbedding {
  values: number[];
  dimensions: number;
}

// Represents multiple generated embeddings.
export interface GeneratedEmbeddings {
  embeddings: GeneratedEmbedding[];
  model: string;
  dimensions: number;
}