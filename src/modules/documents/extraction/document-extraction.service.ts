import path from "node:path";

import { ApiError } from "../../../utils/ApiError.js";
import logger from "../../../utils/logger.js";

import { extractPdfText } from "./extractors/pdf.extractor.js";
import { extractDocxText } from "./extractors/docx.extractor.js";
import { extractTxtText } from "./extractors/txt.extractor.js";

import { cleanExtractedText } from "./text-cleaner.js";

import type {
  DocumentExtractionInput,
  DocumentExtractionResult,
} from "./document-extraction.types.js";

// MIME types supported by our document extraction system.
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

/**
 * Extract and clean text from an uploaded document.
 *
 * This service:
 * 1. Identifies the document format.
 * 2. Validates the document MIME type.
 * 3. Calls the appropriate extractor.
 * 4. Cleans the extracted text.
 * 5. Returns a common extraction result.
 */
export const extractDocumentText = async (
  input: DocumentExtractionInput
): Promise<DocumentExtractionResult> => {
  const extension = path.extname(input.originalFilename).toLowerCase();

  try {
    // Step 1: Identify the document format.
    const expectedMimeType = SUPPORTED_MIME_TYPES[extension];

    if (!expectedMimeType) {
      throw new ApiError(
        400,
        "Unsupported document format. Only PDF, DOCX and TXT are supported."
      );
    }

    // Step 2: Verify that the stored MIME type matches the extension.
    // application/octet-stream is allowed because our upload middleware
    // permits it when the actual file content has been validated.
    if (
      input.mimeType !== expectedMimeType &&
      input.mimeType !== "application/octet-stream"
    ) {
      throw new ApiError(
        400,
        "Document MIME type does not match its file extension"
      );
    }

    logger.info(
      {
        documentId: input.documentId,
        originalFilename: input.originalFilename,
        documentType: extension,
      },
      "Starting document text extraction"
    );

    // Step 3: Call the appropriate extractor.
    let extractionResult: DocumentExtractionResult;

    switch (extension) {
      case ".pdf":
        extractionResult = await extractPdfText(input);
        break;

      case ".docx":
        extractionResult = await extractDocxText(input);
        break;

      case ".txt":
        extractionResult = await extractTxtText(input);
        break;

      default:
        // This is an additional safeguard.
        throw new ApiError(400, "Unsupported document format");
    }

    // Step 4: Clean the extracted text.
    const cleanedText = cleanExtractedText(
      extractionResult.text,
      input.documentId
    );

    // Step 5: Return the cleaned result while preserving metadata.
    const finalResult: DocumentExtractionResult = {
      ...extractionResult,
      text: cleanedText,
    };

    logger.info(
      {
        documentId: input.documentId,
        documentType: finalResult.documentType,
        extractedCharacters: finalResult.text.length,
        pageCount: finalResult.pageCount,
      },
      "Document extraction pipeline completed successfully"
    );

    return finalResult;
  } catch (error) {
    // Log the failure with document context.
    logger.error(
      {
        err: error,
        documentId: input.documentId,
        originalFilename: input.originalFilename,
      },
      "Document extraction pipeline failed"
    );

    // Preserve known application errors.
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      "An unexpected error occurred during document extraction"
    );
  }
};