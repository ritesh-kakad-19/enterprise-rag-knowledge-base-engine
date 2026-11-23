import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";

import { ApiError } from "../../../../utils/ApiError.js";
import logger from "../../../../utils/logger.js";

import type {
  DocumentExtractionInput,
  DocumentExtractionResult,
} from "../document-extraction.types.js";

// Directory where uploaded documents are stored.
const UPLOAD_DIRECTORY = path.resolve(
  process.cwd(),
  "storage",
  "uploads"
);

// Only accept UUID-generated filenames.
// This prevents users from supplying paths such as ../../some-file.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract plain text from an uploaded DOCX document.
 */
export const extractDocxText = async (
  input: DocumentExtractionInput
): Promise<DocumentExtractionResult> => {
  // Ensure this extractor receives a DOCX document.
  if (path.extname(input.originalFilename).toLowerCase() !== ".docx") {
    throw new ApiError(400, "This extractor only supports DOCX files");
  }

  // Validate the stored filename.
  if (!UUID_PATTERN.test(input.storedFilename)) {
    throw new ApiError(400, "Invalid stored document filename");
  }

  // Construct the file path using our trusted upload directory.
  const filePath = path.resolve(
    UPLOAD_DIRECTORY,
    input.storedFilename
  );

  // Ensure the resolved path stays inside the upload directory.
  if (!filePath.startsWith(`${UPLOAD_DIRECTORY}${path.sep}`)) {
    throw new ApiError(400, "Invalid document path");
  }

  // Verify that the uploaded file exists.
  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      throw new ApiError(400, "Uploaded document is not a valid file");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const fsError = error as NodeJS.ErrnoException;

    if (fsError.code === "ENOENT") {
      throw new ApiError(404, "Uploaded DOCX file was not found");
    }

    throw error;
  }

  try {
    // Read the DOCX file as binary data.
    const fileBuffer = await readFile(filePath);

    // Mammoth extracts the raw text from the DOCX buffer.
    const extractionResult = await mammoth.extractRawText({
      buffer: fileBuffer,
    });

    // Remove unnecessary whitespace from the beginning and end.
    const extractedText = extractionResult.value.trim();

    // Reject documents that do not contain readable text.
    if (!extractedText) {
      throw new ApiError(
        422,
        "No extractable text found in the DOCX document"
      );
    }

    // Mammoth can return warnings about document elements.
    // Log them for debugging without exposing them to the user.
    if (extractionResult.messages.length > 0) {
      logger.warn(
        {
          documentId: input.documentId,
          warnings: extractionResult.messages,
        },
        "DOCX extraction completed with warnings"
      );
    }

    logger.info(
      {
        documentId: input.documentId,
        extractedCharacters: extractedText.length,
      },
      "DOCX text extraction completed"
    );

    return {
      text: extractedText,
      documentType: "docx",
    };
  } catch (error) {
    // Preserve application errors.
    if (error instanceof ApiError) {
      throw error;
    }

    // Log technical details internally.
    logger.error(
      {
        err: error,
        documentId: input.documentId,
      },
      "DOCX text extraction failed"
    );

    // Return a safe error message.
    throw new ApiError(
      422,
      "Unable to extract text from this DOCX document. The file may be corrupted or invalid."
    );
  }
};
