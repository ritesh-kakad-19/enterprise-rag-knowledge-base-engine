import logger from "../../utils/logger.js";

import type { DocumentChunk } from "../documents/chunking/chunking.types.js";

import { embedDocumentChunks } from "./document-embedding.service.js";
import { storeEmbeddedChunks } from "./document-chunk-batch-storage.service.js";

import type { StoredDocumentChunk } from "./chunk-storage.service.js";

/**
 * Result returned after the document chunks
 * have been embedded and stored successfully.
 */
export interface DocumentEmbeddingStorageResult {
  documentId: string;
  totalChunks: number;
  storedChunks: StoredDocumentChunk[];
}

/**
 * Generates embeddings for document chunks
 * and stores them in PostgreSQL.
 *
 * Pipeline:
 *
 * Document chunks
 *      ↓
 * Generate embeddings
 *      ↓
 * Store embeddings in PostgreSQL
 *      ↓
 * Return storage result
 */
export async function embedAndStoreDocumentChunks(
  chunks: DocumentChunk[],
  documentTitle?: string,
): Promise<DocumentEmbeddingStorageResult> {
  // Validate input.
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error(
      "At least one document chunk is required.",
    );
  }

  const documentId = chunks[0].documentId;

  // Ensure every chunk belongs to the same document.
  for (const chunk of chunks) {
    if (chunk.documentId !== documentId) {
      throw new Error(
        "All chunks must belong to the same document.",
      );
    }
  }

  logger.info(
    {
      documentId,
      totalChunks: chunks.length,
    },
    "Starting document embedding and storage pipeline",
  );

  try {
    /*
     * STEP 1:
     * Generate embeddings for all document chunks.
     *
     * This calls the existing embedding service.
     */
    const embeddedChunks = await embedDocumentChunks(
      chunks,
      documentTitle,
    );

    // Verify that every chunk received an embedding.
    if (embeddedChunks.length !== chunks.length) {
      throw new Error(
        "Generated embedding count does not match chunk count.",
      );
    }

    logger.info(
      {
        documentId,
        embeddedChunks: embeddedChunks.length,
      },
      "Document embeddings generated successfully",
    );

    /*
     * STEP 2:
     * Store all embedded chunks in PostgreSQL.
     *
     * This calls the existing batch storage service.
     * The storage service uses a transaction.
     */
    const storedChunks = await storeEmbeddedChunks(
      embeddedChunks,
    );

    // Verify that every embedded chunk was stored.
    if (storedChunks.length !== embeddedChunks.length) {
      throw new Error(
        "Stored chunk count does not match embedded chunk count.",
      );
    }

    logger.info(
      {
        documentId,
        totalChunks: storedChunks.length,
      },
      "Document embedding and storage pipeline completed",
    );

    // Return storage information.
    return {
      documentId,
      totalChunks: storedChunks.length,
      storedChunks,
    };
  } catch (error) {
    logger.error(
      {
        documentId,
        error,
      },
      "Document embedding and storage pipeline failed",
    );

    // Preserve the original error for debugging.
    throw new Error(
      "Failed to embed and store document chunks.",
      { cause: error },
    );
  }
}