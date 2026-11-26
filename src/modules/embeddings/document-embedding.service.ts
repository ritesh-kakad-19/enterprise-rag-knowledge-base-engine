import { ApiError } from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";

import { chunkingConfig } from "../../config/chunking.js";

import { generateEmbeddings } from "./embedding.service.js";

import type { DocumentChunk } from "../documents/chunking/chunking.types.js";
import type { EmbeddedDocumentChunk } from "./embedded-chunk.types.js";

// Number of chunks sent to Gemini in one request.
//
// We process batches sequentially to avoid sending too many
// requests simultaneously and overwhelming the API.
const EMBEDDING_BATCH_SIZE = 32;

/**
 * Generate embeddings for all chunks of a document.
 *
 * This function:
 * 1. Validates the chunks.
 * 2. Divides chunks into batches.
 * 3. Sends each batch to Gemini.
 * 4. Combines each chunk with its corresponding embedding.
 * 5. Returns the embedded chunks.
 *
 * Important:
 * This function does not save anything to PostgreSQL.
 */
export const embedDocumentChunks = async (
  chunks: DocumentChunk[],
  documentTitle?: string
): Promise<EmbeddedDocumentChunk[]> => {
  // Validate input.
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new ApiError(400, "Document chunks cannot be empty");
  }

  // Every chunk must belong to the same document.
  const documentId = chunks[0].documentId;

  if (!documentId) {
    throw new ApiError(400, "Document ID is required");
  }

  // Validate chunk information before making API calls.
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];

    if (chunk.documentId !== documentId) {
      throw new ApiError(
        400,
        "All chunks must belong to the same document"
      );
    }

    if (!chunk.text || !chunk.text.trim()) {
      throw new ApiError(
        400,
        `Chunk ${index} contains empty text`
      );
    }

    if (chunk.chunkIndex !== index) {
      throw new ApiError(
        400,
        `Invalid chunk index at position ${index}`
      );
    }
  }

  try {
    logger.info(
      {
        documentId,
        totalChunks: chunks.length,
        batchSize: EMBEDDING_BATCH_SIZE,
      },
      "Starting document chunk embedding"
    );

    const embeddedChunks: EmbeddedDocumentChunk[] = [];

    // Process chunks in batches.
    for (
      let startIndex = 0;
      startIndex < chunks.length;
      startIndex += EMBEDDING_BATCH_SIZE
    ) {
      const batch = chunks.slice(
        startIndex,
        startIndex + EMBEDDING_BATCH_SIZE
      );

      logger.info(
        {
          documentId,
          batchNumber:
            Math.floor(startIndex / EMBEDDING_BATCH_SIZE) + 1,
          batchSize: batch.length,
        },
        "Generating embeddings for chunk batch"
      );

      // Extract only the text from the chunks.
      const texts = batch.map((chunk) => chunk.text);

      // Call the Gemini embedding service.
      const embeddingResult = await generateEmbeddings(
        texts,
        "RETRIEVAL_DOCUMENT",
        documentTitle
      );

      // Combine each chunk with its corresponding vector.
      for (let index = 0; index < batch.length; index++) {
        const chunk = batch[index];
        const embedding = embeddingResult.embeddings[index];

        embeddedChunks.push({
          ...chunk,

          embedding: embedding.values,
          embeddingModel: embeddingResult.model,
          embeddingDimensions: embeddingResult.dimensions,
        });
      }

      logger.info(
        {
          documentId,
          processedChunks: embeddedChunks.length,
          totalChunks: chunks.length,
        },
        "Chunk batch embedding completed"
      );
    }

    logger.info(
      {
        documentId,
        totalChunks: chunks.length,
        embeddedChunks: embeddedChunks.length,
      },
      "Document chunk embedding completed"
    );

    return embeddedChunks;
  } catch (error) {
    logger.error(
      {
        err: error,
        documentId,
        totalChunks: chunks.length,
      },
      "Document chunk embedding failed"
    );

    // Preserve existing application errors.
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      502,
      "Failed to generate embeddings for document chunks"
    );
  }
};