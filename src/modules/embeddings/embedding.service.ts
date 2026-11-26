import { env } from "../../config/env.js";
import { geminiClient } from "../../config/gemini.js";

import { ApiError } from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";

import type {
  EmbeddingTaskType,
  GeneratedEmbedding,
  GeneratedEmbeddings,
} from "./embedding.types.js";

// Generate embeddings for one or multiple text inputs.
export const generateEmbeddings = async (
  texts: string[],
  taskType: EmbeddingTaskType,
  title?: string
): Promise<GeneratedEmbeddings> => {
  // Validate the input array.
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new ApiError(400, "At least one text input is required");
  }

  // Validate every text before calling Gemini.
  for (let index = 0; index < texts.length; index++) {
    if (
      typeof texts[index] !== "string" ||
      !texts[index].trim()
    ) {
      throw new ApiError(
        400,
        `Text input at index ${index} cannot be empty`
      );
    }
  }

  // A title is useful for document retrieval embeddings.
  // Do not pass it for query embeddings.
  if (title && taskType !== "RETRIEVAL_DOCUMENT") {
    throw new ApiError(
      400,
      "Title can only be used with RETRIEVAL_DOCUMENT"
    );
  }

  try {
    logger.info(
      {
        textCount: texts.length,
        taskType,
        dimensions: env.GEMINI_EMBEDDING_DIMENSIONS,
      },
      "Generating embeddings"
    );

    // Call the actual Gemini Embedding API.
    const response = await geminiClient.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,

      // Gemini supports multiple text inputs in one request.
      contents: texts,

      config: {
        taskType,
        outputDimensionality: env.GEMINI_EMBEDDING_DIMENSIONS,

        // Optional document title can improve retrieval embeddings.
        ...(title && { title }),
      },
    });

    // Gemini should return one embedding for each input text.
    if (
      !response.embeddings ||
      response.embeddings.length !== texts.length
    ) {
      throw new Error(
        "Gemini returned an unexpected number of embeddings"
      );
    }

    // Validate and transform the API response.
    const embeddings: GeneratedEmbedding[] =
      response.embeddings.map((embedding, index) => {
        const values = embedding.values;

        if (!values || values.length === 0) {
          throw new Error(
            `Embedding at index ${index} is empty`
          );
        }

        // Every vector must have the configured dimension.
        if (
          values.length !== env.GEMINI_EMBEDDING_DIMENSIONS
        ) {
          throw new Error(
            `Embedding dimension mismatch at index ${index}. ` +
              `Expected ${env.GEMINI_EMBEDDING_DIMENSIONS}, ` +
              `received ${values.length}`
          );
        }

        // Check that all vector values are valid numbers.
        const hasInvalidValue = values.some(
          (value) => !Number.isFinite(value)
        );

        if (hasInvalidValue) {
          throw new Error(
            `Embedding at index ${index} contains invalid values`
          );
        }

        return {
          values,
          dimensions: values.length,
        };
      });

    logger.info(
      {
        textCount: texts.length,
        dimensions: env.GEMINI_EMBEDDING_DIMENSIONS,
      },
      "Embeddings generated successfully"
    );

    return {
      embeddings,
      model: env.GEMINI_EMBEDDING_MODEL,
      dimensions: env.GEMINI_EMBEDDING_DIMENSIONS,
    };
  } catch (error) {
    // Log the internal error for debugging.
    logger.error(
      {
        err: error,
        textCount: texts.length,
        taskType,
      },
      "Embedding generation failed"
    );

    // Avoid exposing provider error details to API clients.
    throw new ApiError(
      502,
      "Failed to generate embeddings from Gemini"
    );
  }
};