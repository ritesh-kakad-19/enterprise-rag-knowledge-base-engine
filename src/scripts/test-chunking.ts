import assert from "node:assert/strict";

import { chunkDocumentText } from "../modules/documents/chunking/chunking.service.js";
import { chunkingConfig } from "../config/chunking.js";
import { ApiError } from "../utils/ApiError.js";

// A fixed ID is sufficient for testing the chunking service.
// These tests do not insert anything into the database.
const documentId = "11111111-1111-4111-8111-111111111111";

const testEmptyText = (): void => {
  console.log("\nTest 1: Empty text");

  assert.throws(
    () => chunkDocumentText("", documentId),
    (error: unknown) =>
      error instanceof ApiError && error.statusCode === 400,
    "Empty text should throw a 400 ApiError"
  );

  console.log("Empty text test passed");
};

const testWhitespaceText = (): void => {
  console.log("\nTest 2: Whitespace-only text");

  assert.throws(
    () => chunkDocumentText("   \n\t  ", documentId),
    (error: unknown) =>
      error instanceof ApiError && error.statusCode === 400,
    "Whitespace-only text should throw a 400 ApiError"
  );

  console.log("Whitespace-only text test passed");
};

const testShortText = (): void => {
  console.log("\nTest 3: Short text");

  const shortText = "This is a short document for testing.";

  const chunks = chunkDocumentText(shortText, documentId);

  // Short text should fit inside a single chunk.
  assert.equal(chunks.length, 1);

  // The chunk should contain the complete original text.
  assert.equal(chunks[0].text, shortText);

  // Metadata should be correct.
  assert.equal(chunks[0].documentId, documentId);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[0].startChar, 0);
  assert.equal(chunks[0].endChar, shortText.length);
  assert.equal(chunks[0].characterCount, shortText.length);

  console.log("Short text test passed");
};

const testLongText = (): void => {
  console.log("\nTest 4: Long text");

  // Create a document large enough to require multiple chunks.
  const longText = Array.from(
    { length: 150 },
    (_, index) =>
      `Sentence ${index}: This is sample content used to test the document chunking system.`
  ).join("\n\n");

  const chunks = chunkDocumentText(longText, documentId);

  // A long document should produce more than one chunk.
  assert.ok(chunks.length > 1, "Long text should create multiple chunks");

  // Every chunk must respect the configured maximum size.
  for (const chunk of chunks) {
    assert.ok(
      chunk.characterCount <= chunkingConfig.chunkSize,
      `Chunk ${chunk.chunkIndex} exceeds the configured chunk size`
    );
  }

  // First chunk starts at the beginning of the document.
  assert.equal(chunks[0].startChar, 0);

  // Last chunk ends at the end of the document.
  assert.equal(chunks[chunks.length - 1].endChar, longText.length);

  console.log(`Long text test passed: ${chunks.length} chunks created`);
};

const testOverlap = (): void => {
  console.log("\nTest 5: Overlap correctness");

  const longText = Array.from(
    { length: 150 },
    (_, index) =>
      `Sentence ${index}: Testing overlap between neighboring chunks.`
  ).join("\n\n");

  const chunks = chunkDocumentText(longText, documentId);
  const overlap = chunkingConfig.overlap;

  assert.ok(chunks.length > 1, "Overlap test requires multiple chunks");

  for (let index = 1; index < chunks.length; index++) {
    const previousChunk = chunks[index - 1];
    const currentChunk = chunks[index];

    // The next chunk should start before the previous chunk ends.
    assert.equal(
      currentChunk.startChar,
      previousChunk.endChar - overlap,
      `Incorrect overlap position between chunks ${index - 1} and ${index}`
    );

    // The shared text should match exactly.
    const previousOverlap = previousChunk.text.slice(-overlap);
    const currentOverlap = currentChunk.text.slice(0, overlap);

    assert.equal(
      currentOverlap,
      previousOverlap,
      `Overlap text does not match between chunks ${index - 1} and ${index}`
    );
  }

  console.log(`Overlap test passed: ${overlap} characters shared`);
};

const testMetadata = (): void => {
  console.log("\nTest 6: Metadata correctness");

  const sourceText = Array.from(
    { length: 150 },
    (_, index) =>
      `Sentence ${index}: Metadata should match the original source text.`
  ).join("\n\n");

  const chunks = chunkDocumentText(sourceText, documentId);

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];

    // Every chunk must belong to the correct document.
    assert.equal(chunk.documentId, documentId);

    // Chunk indexes should start at zero and increase sequentially.
    assert.equal(chunk.chunkIndex, index);

    // Character count must match the actual chunk text.
    assert.equal(chunk.characterCount, chunk.text.length);

    // Offsets must correctly describe the chunk's position.
    assert.equal(
      chunk.endChar - chunk.startChar,
      chunk.characterCount
    );

    // Chunk text must match the corresponding source text.
    assert.equal(
      chunk.text,
      sourceText.slice(chunk.startChar, chunk.endChar)
    );
  }

  console.log("Metadata test passed");
};

const runChunkingTests = (): void => {
  console.log("========== CHUNKING TESTS ==========");

  testEmptyText();
  testWhitespaceText();
  testShortText();
  testLongText();
  testOverlap();
  testMetadata();

  console.log("\n========== ALL TESTS PASSED ==========");
};

try {
  runChunkingTests();
} catch (error) {
  console.error("\nChunking tests failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
}
