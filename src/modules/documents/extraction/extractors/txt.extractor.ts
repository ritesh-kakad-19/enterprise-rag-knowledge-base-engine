
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

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
// This prevents unsafe file paths and path traversal.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract plain text from an uploaded TXT document.
 */
export const extractTxtText = async (
  input: DocumentExtractionInput
): Promise<DocumentExtractionResult> => {
  // Ensure this extractor receives a TXT document.
  if (path.extname(input.originalFilename).toLowerCase() !== ".txt") {
    throw new ApiError(400, "This extractor only supports TXT files");
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

  // Ensure the resolved path remains inside the upload directory.
  if (!filePath.startsWith(`${UPLOAD_DIRECTORY}${path.sep}`)) {
    throw new ApiError(400, "Invalid document path");
  }

  // Verify that the uploaded file exists and is a regular file.
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
      throw new ApiError(404, "Uploaded TXT file was not found");
    }

    throw error;
  }

  try {
    // Read the file as a binary Buffer.
    const fileBuffer = await readFile(filePath);

    // Decode UTF-8 text strictly.
    // Invalid UTF-8 data will throw an error instead of silently
    // replacing invalid characters.
    const decoder = new TextDecoder("utf-8", {
      fatal: true,
    });

    const extractedText = decoder.decode(fileBuffer).trim();

    // Reject empty or whitespace-only documents.
    if (!extractedText) {
      throw new ApiError(
        422,
        "No extractable text found in the TXT document"
      );
    }

    logger.info(
      {
        documentId: input.documentId,
        extractedCharacters: extractedText.length,
      },
      "TXT text extraction completed"
    );

    return {
      text: extractedText,
      documentType: "txt",
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
      "TXT text extraction failed"
    );

    // Return a safe error message.
    throw new ApiError(
      422,
      "Unable to extract text from this TXT document. The file may contain invalid UTF-8 data."
    );
  }
};
