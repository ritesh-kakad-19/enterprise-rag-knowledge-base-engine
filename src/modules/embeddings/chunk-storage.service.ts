import pool from "../../config/database.js";
import  logger  from "../../utils/logger.js";

import type { EmbeddedDocumentChunk } from "./embedded-chunk.types.js";

import { toPgVectorLiteral } from "./vector.utils.js";

/**
 * Represents the information returned after a chunk
 * has been successfully stored in PostgreSQL.
 */
export interface StoredDocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  createdAt: Date;
}

/**
 * Stores one embedded document chunk in PostgreSQL.
 *
 * This function:
 * 1. Validates the chunk metadata.
 * 2. Converts the embedding into a PostgreSQL vector literal.
 * 3. Inserts the chunk using a parameterized SQL query.
 * 4. Returns the stored chunk's database information.
 */
export async function storeEmbeddedChunk(
  chunk: EmbeddedDocumentChunk,
): Promise<StoredDocumentChunk> {
  try {
    // Validate document ID.
    if (!chunk.documentId) {
      throw new Error("Document ID is required.");
    }

    // Validate chunk index.
    if (
      !Number.isInteger(chunk.chunkIndex) ||
      chunk.chunkIndex < 0
    ) {
      throw new Error("Chunk index must be a non-negative integer.");
    }

    // Validate chunk text.
    if (!chunk.text || chunk.text.trim().length === 0) {
      throw new Error("Chunk text cannot be empty.");
    }

    // Validate chunk character count.
    if (chunk.characterCount !== chunk.text.length) {
      throw new Error(
        "Chunk character count does not match the chunk text.",
      );
    }

    // Validate source offsets.
    if (
      chunk.startChar < 0 ||
      chunk.endChar < chunk.startChar
    ) {
      throw new Error("Invalid chunk character offsets.");
    }

    // Validate embedding metadata.
    if (
      chunk.embeddingDimensions !== chunk.embedding.length
    ) {
      throw new Error(
        "Embedding dimensions do not match the embedding vector.",
      );
    }

    // Convert the JavaScript array into a PostgreSQL vector literal.
    // The utility also validates vector dimensions and finite values.
    const embeddingLiteral = toPgVectorLiteral(
      chunk.embedding,
      chunk.embeddingDimensions,
    );

    /*
     * IMPORTANT:
     * All values are passed as query parameters.
     *
     * $5::vector tells PostgreSQL to convert the parameter
     * into the pgvector VECTOR type.
     *
     * Do not concatenate chunk text or vector data directly
     * into the SQL query.
     */
    const query = `
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

    const result = await pool.query(query, values);

    // PostgreSQL should return exactly one inserted row.
    if (result.rowCount !== 1 || !result.rows[0]) {
      throw new Error(
        "Chunk was not successfully stored in the database.",
      );
    }

    const row = result.rows[0];

    logger.info(
      {
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        chunkId: row.id,
      },
      "Document chunk stored successfully",
    );

    return {
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      createdAt: row.created_at,
    };
  } catch (error) {
    logger.error(
      {
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        error,
      },
      "Failed to store document chunk",
    );

    // Preserve the original error for debugging.
    throw new Error("Failed to store document chunk.", {
      cause: error,
    });
  }
}