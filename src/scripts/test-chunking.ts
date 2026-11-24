import { chunkDocumentText } from "../modules/documents/chunking/chunking.service.js";
import { chunkingConfig } from "../config/chunking.js";
import logger from "../utils/logger.js";

const testChunking = (): void => {
  try {
    const sampleText = `
Company Leave Policy

Employees receive 20 paid leaves annually.

Employees can apply for sick leave.

Employees must inform their manager before taking leave.

Unused leaves can be carried forward according to company policy.

Special leave approval requires manager authorization.
`.repeat(30);

    const chunks = chunkDocumentText(sampleText);

    console.log("\n========== CHUNKING TEST ==========\n");

    chunks.forEach((chunk, index) => {
      console.log(`CHUNK ${index + 1}`);
      console.log(`Characters: ${chunk.length}`);
      console.log("----------------------------------");
      console.log(chunk.slice(0, 200));
      console.log("\n");
    });

    // Check that no chunk exceeds the configured size.
    for (const chunk of chunks) {
      if (chunk.length > chunkingConfig.chunkSize) {
        throw new Error("Chunk exceeds maximum configured size");
      }
    }

    // Check that consecutive chunks share the expected overlap.
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i];
      const nextChunk = chunks[i + 1];

      const expectedOverlap = currentChunk.slice(
        -chunkingConfig.overlap
      );

      if (!nextChunk.startsWith(expectedOverlap)) {
        throw new Error(
          `Overlap validation failed between chunks ${i + 1} and ${i + 2}`
        );
      }
    }

    logger.info(
      {
        totalChunks: chunks.length,
        overlap: chunkingConfig.overlap,
      },
      "Chunking and overlap tests passed"
    );
  } catch (error) {
    logger.error({ err: error }, "Chunking test failed");
    process.exitCode = 1;
  }
};

testChunking();