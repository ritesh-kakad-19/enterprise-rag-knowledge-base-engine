import assert from "node:assert/strict";

import pool from "../config/database.js";
import { env } from "../config/env.js";

import { extractDocumentText } from "../modules/documents/extraction/document-extraction.service.js";

import { chunkDocumentText } from "../modules/documents/chunking/chunking.service.js";

import { embedDocumentChunks } from "../modules/embeddings/document-embedding.service.js";

import type { DocumentExtractionInput } from "../modules/documents/extraction/document-extraction.types.js";


import { storeEmbeddedChunks } from "../modules/embeddings/document-chunk-batch-storage.service.js";

interface DocumentRecord {
  id: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
}

const testDocumentEmbedding = async (): Promise<void> => {
  // Get document ID from command-line arguments.
  const documentId = process.argv[2];

  if (!documentId) {
    throw new Error(
      "Please provide a document ID.\n" +
        "Example: npm run test:document-embedding -- YOUR_DOCUMENT_UUID"
    );
  }

  try {
    console.log("========== DOCUMENT EMBEDDING TEST ==========");

    // 1. Retrieve document metadata from PostgreSQL.
    const result = await pool.query<DocumentRecord>(
      `SELECT id, original_filename, stored_filename, mime_type
       FROM documents
       WHERE id = $1`,
      [documentId]
    );

    const document = result.rows[0];

    if (!document) {
      throw new Error("Document not found in database");
    }

    console.log("Document:", document.original_filename);

    // 2. Prepare extraction input.
    const extractionInput: DocumentExtractionInput = {
      documentId: document.id,
      originalFilename: document.original_filename,
      storedFilename: document.stored_filename,
      mimeType: document.mime_type,
    };

    // 3. Extract and clean document text.
    const extractionResult =
      await extractDocumentText(extractionInput);

    console.log(
      "Extracted characters:",
      extractionResult.text.length
    );

    // 4. Generate document chunks.
    const chunks = chunkDocumentText(
      extractionResult.text,
      document.id
    );

    console.log("Generated chunks:", chunks.length);

    // 5. Generate embeddings for the chunks.
    const embeddedChunks = await embedDocumentChunks(
      chunks,
      document.original_filename
    );

    console.log("Embedded chunks:", embeddedChunks.length);


      // ================================================
      // STEP 9.5: DOCUMENT CHUNK STORAGE TEST
      // ================================================

      console.log("\n========== DOCUMENT STORAGE TEST ==========\n");

      // Check whether this document already has stored chunks.
      // We don't want this test to accidentally insert duplicates.
      const existingChunksResult = await pool.query(
          `
            SELECT COUNT(*)::INTEGER AS count
            FROM document_chunks
            WHERE document_id = $1;
        `,
          [documentId],
      );

      const existingChunkCount = existingChunksResult.rows[0].count;

      if (existingChunkCount > 0) {
          throw new Error(
              `This document already has ${existingChunkCount} stored chunks. ` +
              "Use a document that has not been stored yet for this test.",
          );
      }

      console.log("Document ID:", documentId);
      console.log("Chunks generated:", embeddedChunks.length);

      // Store all embedded chunks using one transaction.
      const storedChunks = await storeEmbeddedChunks(
          embeddedChunks,
      );

      console.log("Chunks stored:", storedChunks.length);

      // Verify that the storage service returned the expected count.
      assert.equal(
          storedChunks.length,
          embeddedChunks.length,
          "Stored chunk count does not match embedded chunk count.",
      );

      console.log("Storage count test passed.");


      // Retrieve stored chunks from PostgreSQL.
      const verificationResult = await pool.query(
          `
            SELECT
                id,
                document_id,
                chunk_index,
                chunk_text,
                embedding_model,
                embedding_dimensions,
                vector_dims(embedding) AS actual_vector_dimensions,
                character_count,
                start_char,
                end_char,
                embedding::text AS embedding_text
            FROM document_chunks
            WHERE document_id = $1
            ORDER BY chunk_index ASC;
        `,
          [documentId],
      );

      const storedRows = verificationResult.rows;

      // Verify database row count.
      assert.equal(
          storedRows.length,
          embeddedChunks.length,
          "Database row count does not match expected chunk count.",
      );

      console.log("Database row count test passed.");



      // Verify each stored chunk against the original embedded chunk.
      for (let index = 0; index < embeddedChunks.length; index++) {
          const expectedChunk = embeddedChunks[index];
          const storedRow = storedRows[index];

          // Verify document ID.
          assert.equal(
              storedRow.document_id,
              expectedChunk.documentId,
              `Document ID mismatch for chunk ${index}.`,
          );

          // Verify chunk index.
          assert.equal(
              storedRow.chunk_index,
              expectedChunk.chunkIndex,
              `Chunk index mismatch for chunk ${index}.`,
          );

          // Verify chunk text.
          assert.equal(
              storedRow.chunk_text,
              expectedChunk.text,
              `Chunk text mismatch for chunk ${index}.`,
          );

          // Verify embedding model.
          assert.equal(
              storedRow.embedding_model,
              expectedChunk.embeddingModel,
              `Embedding model mismatch for chunk ${index}.`,
          );

          // Verify configured embedding dimensions.
          assert.equal(
              storedRow.embedding_dimensions,
              expectedChunk.embeddingDimensions,
              `Embedding metadata mismatch for chunk ${index}.`,
          );

          // Verify actual PostgreSQL vector dimensions.
          assert.equal(
              storedRow.actual_vector_dimensions,
              expectedChunk.embeddingDimensions,
              `Stored vector dimensions mismatch for chunk ${index}.`,
          );

          // Verify character count.
          assert.equal(
              storedRow.character_count,
              expectedChunk.characterCount,
              `Character count mismatch for chunk ${index}.`,
          );

          // Verify source offsets.
          assert.equal(
              storedRow.start_char,
              expectedChunk.startChar,
              `Start offset mismatch for chunk ${index}.`,
          );

          assert.equal(
              storedRow.end_char,
              expectedChunk.endChar,
              `End offset mismatch for chunk ${index}.`,
          );

          // Verify the stored vector is valid JSON-like vector text.
          const storedVectorText = storedRow.embedding_text;

          assert.ok(
              typeof storedVectorText === "string" &&
              storedVectorText.startsWith("[") &&
              storedVectorText.endsWith("]"),
              `Invalid stored vector format for chunk ${index}.`,
          );

          // Convert PostgreSQL vector text into a JavaScript array.
          const storedVector = storedVectorText
              .slice(1, -1)
              .split(",")
              .map(Number);

          // Verify vector length.
          assert.equal(
              storedVector.length,
              expectedChunk.embedding.length,
              `Vector length mismatch for chunk ${index}.`,
          );

          // Verify that all stored vector values are finite.
          assert.ok(
              storedVector.every(Number.isFinite),
              `Stored vector contains invalid values for chunk ${index}.`,
          );

          // Compare a few vector values to confirm that the
          // database stored the generated embedding correctly.
          for (let vectorIndex = 0; vectorIndex < 5; vectorIndex++) {
              assert.ok(
                  Math.abs(
                      storedVector[vectorIndex] -
                      expectedChunk.embedding[vectorIndex],
                  ) < 0.000001,
                  `Vector value mismatch at chunk ${index}, position ${vectorIndex}.`,
              );
          }

          console.log(
              `Chunk ${index} verified: ${storedRow.id}`,
          );
      }

      console.log("\nAll stored chunks verified successfully.");




    // 6. Verify chunk and embedding counts match.
    assert.equal(
      embeddedChunks.length,
      chunks.length,
      "Every chunk should have an embedding"
    );

    // 7. Verify each embedded chunk.
    for (let index = 0; index < embeddedChunks.length; index++) {
      const embeddedChunk = embeddedChunks[index];

      assert.equal(
        embeddedChunk.documentId,
        document.id
      );

      assert.equal(
        embeddedChunk.chunkIndex,
        index
      );

      assert.equal(
        embeddedChunk.embeddingDimensions,
        env.GEMINI_EMBEDDING_DIMENSIONS
      );

      assert.equal(
        embeddedChunk.embedding.length,
        env.GEMINI_EMBEDDING_DIMENSIONS
      );

      assert.ok(
        embeddedChunk.embedding.every(Number.isFinite),
        `Chunk ${index} contains invalid embedding values`
      );
    }

    // Display details of the first embedded chunk.
    const firstChunk = embeddedChunks[0];

    console.log("\nFirst embedded chunk:");
    console.log("Chunk index:", firstChunk.chunkIndex);
    console.log("Text:", firstChunk.text.slice(0, 200));
    console.log("Characters:", firstChunk.characterCount);
    console.log("Embedding dimensions:", firstChunk.embeddingDimensions);

    console.log(
      "First 10 embedding values:",
      firstChunk.embedding.slice(0, 10)
    );

    console.log("\nDocument embedding test passed");
  } finally {
    await pool.end();
  }
};

testDocumentEmbedding().catch((error: unknown) => {
  console.error("\nDocument embedding test failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});