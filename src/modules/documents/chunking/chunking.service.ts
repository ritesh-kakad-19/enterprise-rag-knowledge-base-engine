import { chunkingConfig } from "../../../config/chunking.js";
import { ApiError } from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";
import type { DocumentChunk } from "./chunking.types.js";

/**
 * Finds the best splitting position within the maximum chunk size.
 *
 * Prefers:
 * paragraph -> line -> sentence -> word.
 */
const findSplitPosition = (
  text: string,
  maxLength: number
): number => {
  const separators = chunkingConfig.separators;

  let bestPosition = -1;

  for (const separator of separators) {
    // Ensure the entire separator fits within maxLength.
    const searchPosition = maxLength - separator.length;

    const position = text.lastIndexOf(
      separator,
      searchPosition
    );

    if (position !== -1) {
      const splitPosition = position + separator.length;

      if (splitPosition > bestPosition) {
        bestPosition = splitPosition;
      }
    }
  }

  // If no suitable boundary exists, split at maxLength.
  return bestPosition > 0 ? bestPosition : maxLength;
};

/**
 * Divides cleaned document text into chunks with overlap
 * and attaches metadata to each chunk.
 */
export const chunkDocumentText = (
  cleanedText: string,
  documentId: string
): DocumentChunk[] => {
  if (typeof cleanedText !== "string" || !cleanedText.trim()) {
    throw new ApiError(400, "Document text cannot be empty");
  }

  if (typeof documentId !== "string" || !documentId.trim()) {
    throw new ApiError(400, "Document ID is required");
  }

  const { chunkSize, overlap } = chunkingConfig;

  try {
    // Keep the original cleaned text so character offsets
    // remain accurate relative to this input.
    const text = cleanedText;

    const chunks: DocumentChunk[] = [];

    let start = 0;

    while (start < text.length) {
      const remainingLength = text.length - start;

      let end: number;

      // If remaining text fits into one chunk,
      // use the rest of the document.
      if (remainingLength <= chunkSize) {
        end = text.length;
      } else {
        const remainingText = text.slice(start);

        const splitPosition = findSplitPosition(
          remainingText,
          chunkSize
        );

        end = start + splitPosition;
      }

      // Extract text using the calculated positions.
      const chunkText = text.slice(start, end);

      if (!chunkText.length) {
        throw new Error("Unable to create a valid document chunk");
      }

      // Create metadata for this chunk.
      const chunk: DocumentChunk = {
        documentId,
        chunkIndex: chunks.length,
        text: chunkText,
        characterCount: chunkText.length,
        startChar: start,
        endChar: end,
      };

      chunks.push(chunk);

      // Stop after processing the final part of the document.
      if (end === text.length) {
        break;
      }

      // Start the next chunk before the current chunk ends
      // to preserve the configured overlap.
      const nextStart = end - overlap;

      // Safety check to prevent an infinite loop.
      if (nextStart <= start) {
        throw new Error("Invalid chunk overlap configuration");
      }

      start = nextStart;
    }

    logger.info(
      {
        documentId,
        totalCharacters: text.length,
        totalChunks: chunks.length,
        chunkSize,
        overlap,
      },
      "Document chunking with metadata completed"
    );

    return chunks;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error(
      { err: error, documentId },
      "Document chunking failed"
    );

    throw new ApiError(500, "Failed to chunk document text");
  }
};