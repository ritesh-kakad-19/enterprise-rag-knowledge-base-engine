import { chunkingConfig } from "../../../config/chunking.js";
import { ApiError } from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";

/**
 * Finds the best splitting position within the allowed chunk size.
 *
 * Priority:
 * 1. Paragraph boundary
 * 2. Line boundary
 * 3. Sentence boundary
 * 4. Word boundary
 *
 * If no suitable boundary exists, split at the maximum size.
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

  // If no separator is found, split at the maximum allowed size.
  return bestPosition > 0 ? bestPosition : maxLength;
};

/**
 * Divides cleaned document text into smaller chunks.
 *
 * Note: Overlap will be implemented separately in Part 7.3.
 */
export const chunkDocumentText = (cleanedText: string): string[] => {
  if (typeof cleanedText !== "string" || !cleanedText.trim()) {
    throw new ApiError(400, "Document text cannot be empty");
  }

  const { chunkSize, minChunkSize } = chunkingConfig;

  try {
    const chunks: string[] = [];

    let remainingText = cleanedText.trim();

    while (remainingText.length > 0) {
      // If remaining text fits into one chunk, save it.
      if (remainingText.length <= chunkSize) {
        chunks.push(remainingText);
        break;
      }

      // Find a meaningful boundary within the configured size.
      const splitPosition = findSplitPosition(
        remainingText,
        chunkSize
      );

      const chunk = remainingText
        .slice(0, splitPosition)
        .trim();

      if (!chunk) {
        throw new Error("Unable to create a valid document chunk");
      }

      chunks.push(chunk);

      // Continue processing the remaining text.
      remainingText = remainingText
        .slice(splitPosition)
        .trimStart();
    }

    // Avoid leaving an unnecessarily small final chunk
    // when it can safely fit into the previous chunk.
    if (chunks.length > 1) {
      const lastChunk = chunks[chunks.length - 1];
      const previousChunk = chunks[chunks.length - 2];

      if (
        lastChunk.length < minChunkSize &&
        previousChunk.length + 1 + lastChunk.length <= chunkSize
      ) {
        chunks[chunks.length - 2] =
          `${previousChunk}\n${lastChunk}`;

        chunks.pop();
      }
    }

    logger.info(
      {
        totalCharacters: cleanedText.length,
        totalChunks: chunks.length,
        chunkSize,
      },
      "Document text chunking completed"
    );

    return chunks;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error(
      { err: error },
      "Document text chunking failed"
    );

    throw new ApiError(500, "Failed to chunk document text");
  }
};