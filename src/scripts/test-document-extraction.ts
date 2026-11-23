import pool from "../config/database.js";
import logger from "../utils/logger.js";

import { extractDocumentText } from "../modules/documents/extraction/document-extraction.service.js";

// This script expects a document UUID as a command-line argument.
const documentId = process.argv[2];

async function testDocumentExtraction() {
  try {
    if (!documentId) {
      throw new Error(
        "Please provide a document ID. Example: npm run test:extraction -- <DOCUMENT_ID>"
      );
    }

    // Step 1: Get document metadata from PostgreSQL.
    const result = await pool.query(
      `
      SELECT
        id,
        original_filename,
        stored_filename,
        mime_type
      FROM documents
      WHERE id = $1
      `,
      [documentId]
    );

    const document = result.rows[0];

    if (!document) {
      throw new Error("Document not found in the database");
    }

    logger.info(
      {
        documentId: document.id,
        filename: document.original_filename,
      },
      "Testing document extraction"
    );

    // Step 2: Prepare the extraction input.
    const extractionInput = {
      documentId: document.id,
      originalFilename: document.original_filename,
      storedFilename: document.stored_filename,
      mimeType: document.mime_type,
    };

    // Step 3: Run the complete extraction pipeline.
    const extractionResult = await extractDocumentText(
      extractionInput
    );

    // Step 4: Display the result.
    console.log("\n========== EXTRACTION RESULT ==========");

    console.log("Document ID:", document.id);
    console.log("Filename:", document.original_filename);
    console.log("Document Type:", extractionResult.documentType);
    console.log("Page Count:", extractionResult.pageCount ?? "N/A");
    console.log("Extracted Characters:", extractionResult.text.length);

    console.log("\n========== EXTRACTED TEXT ==========");

    // Display only the first 1000 characters.
    console.log(extractionResult.text.slice(0, 1000));

    console.log("\n========== TEST SUCCESSFUL ==========\n");
  } catch (error) {
    logger.error(
      { err: error },
      "Document extraction test failed"
    );

    process.exitCode = 1;
  } finally {
    // Close the PostgreSQL connection pool.
    await pool.end();
  }
}

testDocumentExtraction();