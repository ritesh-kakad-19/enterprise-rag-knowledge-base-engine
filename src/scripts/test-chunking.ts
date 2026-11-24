import { chunkDocumentText } from "../modules/documents/chunking/chunking.service.js";
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
`.repeat(3);

    const chunks = chunkDocumentText(sampleText);

    console.log("\n========== CHUNKING TEST ==========\n");

    chunks.forEach((chunk, index) => {
      console.log(`CHUNK ${index + 1}`);
      console.log(`Characters: ${chunk.length}`);
      console.log("----------------------------------");
      console.log(chunk.slice(0, 200));
      console.log("\n");
    });

    // Verify that no chunk exceeds the configured maximum.
    const oversizedChunks = chunks.filter(
      (chunk) => chunk.length > 2000
    );

    if (oversizedChunks.length > 0) {
      throw new Error("Some chunks exceed the configured chunk size");
    }

    logger.info(
      { totalChunks: chunks.length },
      "Chunking test passed"
    );
  } catch (error) {
    logger.error({ err: error }, "Chunking test failed");
    process.exitCode = 1;
  }
};

testChunking();