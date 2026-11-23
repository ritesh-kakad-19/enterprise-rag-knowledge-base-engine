import { ApiError } from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";

/**
 * Clean and normalize extracted document text.
 *
 * This function:
 * 1. Normalizes Unicode characters.
 * 2. Standardizes line endings.
 * 3. Removes unnecessary control characters.
 * 4. Removes invisible formatting characters.
 * 5. Normalizes spaces and tabs.
 * 6. Preserves meaningful paragraph boundaries.
 */
export const cleanExtractedText = (
  rawText: string,
  documentId?: string
): string => {
  if (typeof rawText !== "string") {
    throw new ApiError(400, "Extracted document text must be a string");
  }

  try {
    let cleanedText = rawText;

    // Step 1: Normalize Unicode characters.
    // For example, visually equivalent characters may have
    // different internal Unicode representations.
    cleanedText = cleanedText.normalize("NFC");

    // Step 2: Convert Windows and old Mac line endings into Unix format.
    cleanedText = cleanedText.replace(/\r\n?/g, "\n");

    // Step 3: Remove null bytes and unwanted control characters.
    // Keep newline (\n) and tab (\t) because they can contain
    // useful document formatting information.
    cleanedText = cleanedText.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    );

    // Step 4: Remove common invisible formatting characters.
    // These characters can appear in copied or exported documents.
    cleanedText = cleanedText.replace(
      /[\u200B\u200C\u200D\uFEFF]/g,
      ""
    );

    // Step 5: Replace tabs and repeated horizontal spaces with one space.
    cleanedText = cleanedText.replace(/[^\S\n]+/g, " ");

    // Step 6: Remove spaces at the beginning and end of each line.
    cleanedText = cleanedText
      .split("\n")
      .map((line) => line.trim())
      .join("\n");

    // Step 7: Reduce three or more consecutive newlines to two.
    // This preserves paragraph separation without excessive blank lines.
    cleanedText = cleanedText.replace(/\n{3,}/g, "\n\n");

    // Step 8: Remove unnecessary whitespace from the document edges.
    cleanedText = cleanedText.trim();

    // Step 9: Reject documents that contain no useful text.
    if (!cleanedText) {
      throw new ApiError(
        422,
        "Document contains no readable text after cleaning"
      );
    }

    logger.debug(
      {
        documentId,
        originalCharacters: rawText.length,
        cleanedCharacters: cleanedText.length,
      },
      "Document text cleaning completed"
    );

    return cleanedText;
  } catch (error) {
    // Preserve expected application errors.
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error(
      { err: error, documentId },
      "Document text cleaning failed"
    );

    throw new ApiError(500, "Failed to clean extracted document text");
  }
};