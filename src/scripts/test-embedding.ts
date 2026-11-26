import { generateEmbeddings } from "../modules/embeddings/embedding.service.js";

// Test with actual text.
const sampleTexts = [
  "Employees receive 15 days of paid annual leave.",
  "The company office is located in Mumbai.",
];

const testEmbedding = async (): Promise<void> => {
  try {
    console.log("========== EMBEDDING TEST ==========");

    // This calls the real Gemini API.
    const result = await generateEmbeddings(
      sampleTexts,
      "RETRIEVAL_DOCUMENT",
      "Employee Policy"
    );

    console.log("Model:", result.model);
    console.log("Dimensions:", result.dimensions);
    console.log("Total embeddings:", result.embeddings.length);

    // Print the actual vector values.
    result.embeddings.forEach((embedding, index) => {
      console.log(`\nEmbedding ${index}`);

      console.log("Dimensions:", embedding.dimensions);

      // Print only the first 10 numbers to keep output readable.
      console.log(
        "First 10 values:",
        embedding.values.slice(0, 10)
      );
    });

    console.log("\nEmbedding API test passed");
  } catch (error) {
    console.error("Embedding test failed:");

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exitCode = 1;
  }
};

testEmbedding();