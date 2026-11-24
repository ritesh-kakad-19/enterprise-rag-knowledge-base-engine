import { chunkingConfig } from "../../../config/chunking.js";
import { ApiError } from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";

/**
 * Finds the best splitting position within the maximum chunk size.
 *
 * Prefers meaningful boundaries such as:
 * paragraph -> line -> sentence -> word.
 */
const findSplitPosition = (
  text: string,
  maxLength: number
): number => {
  const separators = chunkingConfig.separators;

  let bestPosition = -1;

  for (const separator of separators) {
    const position = text.lastIndexOf(separator, maxLength - 1);

    if (position !== -1) {
      const splitPosition = position + separator.length;

      if (splitPosition > bestPosition) {
        bestPosition = splitPosition;
      }
    }
  }

  // If no suitable boundary exists, split at the maximum size.
  return bestPosition > 0 ? bestPosition : maxLength;
};

/**
 * Divides document text into smaller chunks with overlapping content.
 *
 * Example:
 * Chunk 1: Characters 0-2000
 * Chunk 2: Characters 1800-3800
 * Chunk 3: Characters 3600-5600
 *
 * Each consecutive chunk shares 200 characters.
 */
export const chunkDocumentText = (cleanedText: string): string[] => {
  if (typeof cleanedText !== "string" || !cleanedText.trim()) {
    throw new ApiError(400, "Document text cannot be empty");
  }

  const { chunkSize, overlap } = chunkingConfig;

  try {
    const text = cleanedText.trim();
    const chunks: string[] = [];

    let start = 0;

    while (start < text.length) {
      // If remaining text fits into one chunk, save it.
      const remainingLength = text.length - start;

      if (remainingLength <= chunkSize) {
        chunks.push(text.slice(start));
        break;
      }

      // Look for a meaningful splitting position.
      const remainingText = text.slice(start);
      const splitPosition = findSplitPosition(
        remainingText,
        chunkSize
      );

      const end = start + splitPosition;

      // Extract the current chunk without trimming its boundaries.
      const chunk = text.slice(start, end);

      if (!chunk.length) {
        throw new Error("Unable to create a valid document chunk");
      }

      chunks.push(chunk);

      // Move the starting position backwards to preserve overlap.
      const nextStart = end - overlap;

      // Safety check: every iteration must make forward progress.
      if (nextStart <= start) {
        throw new Error("Invalid chunk overlap configuration");
      }

      start = nextStart;
    }

    logger.info(
      {
        totalCharacters: text.length,
        totalChunks: chunks.length,
        chunkSize,
        overlap,
      },
      "Document chunking with overlap completed"
    );

    return chunks;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error(
      { err: error },
      "Document chunking failed"
    );

    throw new ApiError(500, "Failed to chunk document text");
  }
};