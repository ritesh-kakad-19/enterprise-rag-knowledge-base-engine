-- =========================================================
-- Step 9.1: Create document_chunks table
-- Purpose:
-- Store document chunks and their Gemini embeddings.
-- =========================================================


-- Ensure pgvector extension is available.
-- This extension allows PostgreSQL to store and search vectors.
CREATE EXTENSION IF NOT EXISTS vector;


-- =========================================================
-- Create document_chunks table
-- =========================================================

CREATE TABLE IF NOT EXISTS document_chunks (

    -- Unique identifier for each chunk.
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),


    -- Reference to the original uploaded document.
    -- If a document is deleted, its chunks will also be deleted.
    document_id UUID NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,


    -- Position of the chunk inside the document.
    -- Example: 0, 1, 2, 3...
    chunk_index INTEGER NOT NULL
        CHECK (chunk_index >= 0),


    -- Actual text content of the chunk.
    chunk_text TEXT NOT NULL
        CHECK (length(trim(chunk_text)) > 0),


    -- Gemini embedding vector.
    -- Our Step 8 configuration uses 768 dimensions.
    embedding VECTOR(768) NOT NULL,


    -- Model used to generate the embedding.
    embedding_model TEXT NOT NULL,


    -- Number of dimensions in the embedding.
    embedding_dimensions INTEGER NOT NULL
        CHECK (embedding_dimensions = 768),


    -- Number of characters in the chunk.
    character_count INTEGER NOT NULL
        CHECK (character_count >= 0),


    -- Starting character position in the cleaned document text.
    start_char INTEGER NOT NULL
        CHECK (start_char >= 0),


    -- Ending character position.
    -- The end position is exclusive.
    end_char INTEGER NOT NULL
        CHECK (end_char >= start_char),


    -- Timestamp when the chunk was stored.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),


    -- Prevent duplicate chunk indexes for the same document.
    UNIQUE (document_id, chunk_index)

);


-- =========================================================
-- Index for document-related queries
-- =========================================================

-- The UNIQUE constraint above creates an index on
-- (document_id, chunk_index).
-- This index supports queries that filter by document_id.
--
-- We do not need a separate document_id index at this stage.


-- =========================================================
-- Migration completed
-- =========================================================