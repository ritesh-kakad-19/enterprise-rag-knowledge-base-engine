import pool from "../../config/database.js";
import logger  from "../../utils/logger.js";
import { env } from "../../config/env.js";

import type { EmbeddedDocumentChunk } from "./embedded-chunk.types.js";

import type { StoredDocumentChunk } from "./chunk-storage.service.js";

import { toPgVectorLiteral } from "./vector.utils.js";

/**
 * Stores multiple embedded chunks for one document.
 *
 * All chunks are inserted inside one PostgreSQL transaction.
 *
 * If any chunk fails:
 * - The transaction is rolled back.
 * - No chunks from this batch remain stored.
 */
export async function storeEmbeddedChunks(
  chunks: EmbeddedDocumentChunk[],
): Promise<StoredDocumentChunk[]> {
  // A batch must contain at least one chunk.
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("At least one embedded chunk is required.");
  }

  const documentId = chunks[0].documentId;

  // All chunks in this batch must belong to the same document.
  for (const chunk of chunks) {
    if (chunk.documentId !== documentId) {
      throw new Error(
        "All chunks in a batch must belong to the same document.",
      );
    }
  }

  // Prevent duplicate chunk indexes in the same batch.
  const chunkIndexes = chunks.map((chunk) => chunk.chunkIndex);

  if (new Set(chunkIndexes).size !== chunkIndexes.length) {
    throw new Error(
      "Duplicate chunk indexes found in the batch.",
    );
  }

  // Validate chunk indexes before opening a database transaction.
  for (const chunk of chunks) {
    if (
      !Number.isInteger(chunk.chunkIndex) ||
      chunk.chunkIndex < 0
    ) {
      throw new Error(
        "Chunk index must be a non-negative integer.",
      );
    }

    if (!chunk.text || chunk.text.trim().length === 0) {
      throw new Error("Chunk text cannot be empty.");
    }

    if (chunk.characterCount !== chunk.text.length) {
      throw new Error(
        "Chunk character count does not match the chunk text.",
      );
    }

    if (
      chunk.startChar < 0 ||
      chunk.endChar < chunk.startChar
    ) {
      throw new Error("Invalid chunk character offsets.");
    }

    if (
      chunk.embeddingDimensions !== env.GEMINI_EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Expected ${env.GEMINI_EMBEDDING_DIMENSIONS} embedding dimensions.`,
      );
    }

    if (chunk.embeddingModel.trim().length === 0) {
      throw new Error("Embedding model name is required.");
    }

    // Validate vector dimensions and values before DB operations.
    toPgVectorLiteral(chunk.embedding);
  }

  /*
   * Get a dedicated PostgreSQL connection.
   *
   * A transaction must use the same connection for
   * BEGIN, INSERT, COMMIT, and ROLLBACK.
   */
  const client = await pool.connect();

  // Store the database rows returned by PostgreSQL.
  const storedChunks: StoredDocumentChunk[] = [];

  try {
    // Start transaction.
    await client.query("BEGIN");

    const insertQuery = `
      INSERT INTO document_chunks (
        document_id,
        chunk_index,
        chunk_text,
        embedding,
        embedding_model,
        embedding_dimensions,
        character_count,
        start_char,
        end_char
      )
      VALUES (
        $1,
        $2,
        $3,
        $4::vector,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING
        id,
        document_id,
        chunk_index,
        created_at;
    `;

    // Insert chunks sequentially using the same transaction.
    for (const chunk of chunks) {
      const embeddingLiteral = toPgVectorLiteral(
        chunk.embedding,
      );

      const values = [
        chunk.documentId,
        chunk.chunkIndex,
        chunk.text,
        embeddingLiteral,
        chunk.embeddingModel,
        chunk.embeddingDimensions,
        chunk.characterCount,
        chunk.startChar,
        chunk.endChar,
      ];

      const result = await client.query(
        insertQuery,
        values,
      );

      if (result.rowCount !== 1 || !result.rows[0]) {
        throw new Error(
          `Failed to insert chunk ${chunk.chunkIndex}.`,
        );
      }

      const row = result.rows[0];

      storedChunks.push({
        id: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        createdAt: row.created_at,
      });
    }

    // Save all inserted chunks permanently.
    await client.query("COMMIT");

    logger.info(
      {
        documentId,
        chunkCount: storedChunks.length,
      },
      "Document chunks stored successfully",
    );

    return storedChunks;
  } catch (error) {
    // If anything fails, undo all inserts in this transaction.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        {
          documentId,
          rollbackError,
        },
        "Failed to rollback document chunk transaction",
      );
    }

    logger.error(
      {
        documentId,
        chunkCount: chunks.length,
        error,
      },
      "Failed to store document chunks",
    );

    throw new Error(
      "Failed to store document chunks. Transaction rolled back.",
      { cause: error },
    );
  } finally {
    /*
     * Always release the connection back to the pool.
     *
     * Otherwise, repeated failures could consume all
     * available PostgreSQL connections.
     */
    client.release();
  }
}