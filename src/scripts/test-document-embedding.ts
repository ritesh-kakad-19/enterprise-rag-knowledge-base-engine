import assert from "node:assert/strict";

import pool from "../config/database.js";
import { env } from "../config/env.js";

import { extractDocumentText } from "../modules/documents/extraction/document-extraction.service.js";

import { chunkDocumentText } from "../modules/documents/chunking/chunking.service.js";

import { embedDocumentChunks } from "../modules/embeddings/document-embedding.service.js";

import type { DocumentExtractionInput } from "../modules/documents/extraction/document-extraction.types.js";

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