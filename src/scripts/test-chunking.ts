import { chunkDocumentText } from "../modules/documents/chunking/chunking.service.js";
import { chunkingConfig } from "../config/chunking.js";
import logger from "../utils/logger.js";

const testChunking = (): void => {
  try {
    const documentId = "11111111-1111-4111-8111-111111111111";

    const sampleText = `
Company Leave Policy

Employees receive 20 paid leaves annually.

Employees can apply for sick leave.

Employees must inform their manager before taking leave.

Unused leaves can be carried forward according to company policy.

Special leave approval requires manager authorization.
`.repeat(30);

    const chunks = chunkDocumentText(
      sampleText,
      documentId
    );

    console.log("\n========== CHUNKING TEST ==========\n");

    chunks.forEach((chunk) => {
      console.log(`CHUNK ${chunk.chunkIndex}`);
      console.log(`Document ID: ${chunk.documentId}`);
      console.log(`Characters: ${chunk.characterCount}`);
      console.log(`Start: ${chunk.startChar}`);
      console.log(`End: ${chunk.endChar}`);
      console.log("----------------------------------");
      console.log(chunk.text.slice(0, 200));
      console.log("\n");
    });

    // Verify maximum chunk size.
    for (const chunk of chunks) {
      if (chunk.characterCount > chunkingConfig.chunkSize) {
        throw new Error("Chunk exceeds maximum configured size");
      }

      // Verify metadata matches the actual chunk text.
      if (chunk.characterCount !== chunk.text.length) {
        throw new Error("Chunk character count is incorrect");
      }

      // Verify character positions.
      if (
        chunk.endChar - chunk.startChar !== chunk.characterCount
      ) {
        throw new Error("Chunk character positions are incorrect");
      }

      // Verify document ID.
      if (chunk.documentId !== documentId) {
        throw new Error("Incorrect document ID in chunk metadata");
      }
    }

    // Verify overlap between consecutive chunks.
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i];
      const nextChunk = chunks[i + 1];

      const expectedOverlap = currentChunk.text.slice(
        -chunkingConfig.overlap
      );

      if (!nextChunk.text.startsWith(expectedOverlap)) {
        throw new Error(
          `Overlap validation failed between chunks ${i} and ${i + 1}`
        );
      }
    }

    logger.info(
      {
        totalChunks: chunks.length,
        documentId,
        overlap: chunkingConfig.overlap,
      },
      "Chunking metadata tests passed"
    );
  } catch (error) {
    logger.error({ err: error }, "Chunking test failed");
    process.exitCode = 1;
  }
};

testChunking();