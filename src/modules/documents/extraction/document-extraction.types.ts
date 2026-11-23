// Supported document formats.
export type SupportedDocumentType = "pdf" | "docx" | "txt";

// Information required to extract a document.
export interface DocumentExtractionInput {
  documentId: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
}

// Result returned after extracting document text.
export interface DocumentExtractionResult {
  text: string;

  // Optional metadata for different file formats.
  pageCount?: number;

  // Original document format.
  documentType: SupportedDocumentType;
}