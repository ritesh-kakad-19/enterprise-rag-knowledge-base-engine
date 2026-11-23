import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { ApiError } from "../../../../utils/ApiError.js";
import logger from "../../../../utils/logger.js";

import type {
  DocumentExtractionInput,
  DocumentExtractionResult,
} from "../document-extraction.types.js";

// All uploaded documents are stored inside this directory.
const UPLOAD_DIRECTORY = path.resolve(
  process.cwd(),
  "storage",
  "uploads"
);

// Generated filenames are UUIDs, so only accept UUID-shaped filenames.
// This prevents path traversal through the stored filename.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract text from an uploaded PDF.
 */
export const extractPdfText = async (
  input: DocumentExtractionInput
): Promise<DocumentExtractionResult> => {
  // We only accept PDF documents in this extractor.
  if (path.extname(input.originalFilename).toLowerCase() !== ".pdf") {
    throw new ApiError(400, "This extractor only supports PDF files");
  }

  // Validate the stored filename before constructing the file path.
  if (!UUID_PATTERN.test(input.storedFilename)) {
    throw new ApiError(400, "Invalid stored document filename");
  }

  // Construct the path using the trusted upload directory.
  const filePath = path.resolve(
    UPLOAD_DIRECTORY,
    input.storedFilename
  );

  // Extra protection: ensure the resolved path remains inside uploads.
  if (!filePath.startsWith(`${UPLOAD_DIRECTORY}${path.sep}`)) {
    throw new ApiError(400, "Invalid document path");
  }

  // Check that the file exists and is a regular file.
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
      throw new ApiError(404, "Uploaded PDF file was not found");
    }

    throw error;
  }

  let loadingTask: ReturnType<typeof getDocument> | undefined;

  try {
    // Read the PDF as binary data.
    const fileBuffer = await readFile(filePath);

    // PDF.js expects binary PDF data as a Uint8Array.
    const pdfData = new Uint8Array(fileBuffer);

    // Load the PDF document.
    loadingTask = getDocument({
      data: pdfData,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;

    // Get the total number of pages.
    const pageCount = pdfDocument.numPages;

    if (pageCount === 0) {
      throw new ApiError(422, "The PDF does not contain any pages");
    }

    const extractedPages: string[] = [];

    // Extract text from every page, one page at a time.
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);

      try {
        const textContent = await page.getTextContent();

        // PDF.js returns different item types.
        // We only need items containing actual text.
        const pageText = textContent.items
          .map((item) => {
            if ("str" in item) {
              return item.str;
            }

            return "";
          })
          .join(" ")
          .trim();

        extractedPages.push(pageText);
      } finally {
        // Release resources associated with the current page.
        page.cleanup();
      }
    }

    // Combine all pages while preserving page boundaries.
    const extractedText = extractedPages
      .join("\n\n")
      .trim();

    // A scanned PDF may contain images instead of selectable text.
    if (!extractedText) {
      throw new ApiError(
        422,
        "No extractable text found. This PDF may be scanned and require OCR."
      );
    }

    logger.info(
      {
        documentId: input.documentId,
        pageCount,
        extractedCharacters: extractedText.length,
      },
      "PDF text extraction completed"
    );

    return {
      text: extractedText,
      pageCount,
      documentType: "pdf",
    };
  } catch (error) {
    // Preserve expected application errors.
    if (error instanceof ApiError) {
      throw error;
    }

    // Log the technical error internally.
    logger.error(
      {
        err: error,
        documentId: input.documentId,
      },
      "PDF text extraction failed"
    );

    // Do not expose internal PDF.js or filesystem errors to the client.
    throw new ApiError(
      422,
      "Unable to extract text from this PDF. The file may be corrupted or password-protected."
    );
  } finally {
    // Release PDF.js resources even when extraction fails.
    if (loadingTask) {
      await loadingTask.destroy().catch((error) => {
        logger.warn(
          { err: error, documentId: input.documentId },
          "Failed to release PDF.js resources"
        );
      });
    }
  }
};