import assert from "node:assert/strict";

import {
  validateEmbeddingVector,
  toPgVectorLiteral,
  VectorValidationError,
} from "../modules/embeddings/vector.utils.js";

import { env } from "../config/env.js";


console.log("\n========== VECTOR UTILITIES TEST ==========\n");


// =========================================================
// Test 1: Validate a correct vector
// =========================================================

const validVector = [0.12, -0.45, 0.78];

validateEmbeddingVector(validVector, 3);

console.log("Test 1 passed: Valid vector");


// =========================================================
// Test 2: Convert vector into pgvector format
// =========================================================

const vectorLiteral = toPgVectorLiteral(
  validVector,
  3,
);

assert.equal(
  vectorLiteral,
  "[0.12,-0.45,0.78]",
);

console.log("Test 2 passed: Vector conversion");


// =========================================================
// Test 3: Reject incorrect dimensions
// =========================================================

assert.throws(
  () => validateEmbeddingVector([0.1, 0.2], 3),
  VectorValidationError,
);

console.log("Test 3 passed: Dimension validation");


// =========================================================
// Test 4: Reject empty vector
// =========================================================

assert.throws(
  () => validateEmbeddingVector([], 3),
  VectorValidationError,
);

console.log("Test 4 passed: Empty vector validation");


// =========================================================
// Test 5: Reject NaN
// =========================================================

assert.throws(
  () => validateEmbeddingVector([0.1, NaN, 0.3], 3),
  VectorValidationError,
);

console.log("Test 5 passed: NaN validation");


// =========================================================
// Test 6: Reject Infinity
// =========================================================

assert.throws(
  () => validateEmbeddingVector([0.1, Infinity, 0.3], 3),
  VectorValidationError,
);

console.log("Test 6 passed: Infinity validation");


// =========================================================
// Test 7: Reject invalid expected dimensions
// =========================================================

assert.throws(
  () => validateEmbeddingVector([0.1, 0.2], 0),
  VectorValidationError,
);

console.log("Test 7 passed: Expected dimensions validation");


// =========================================================
// Test 8: Verify configured 768-dimensional vector
// =========================================================

const configuredVector = Array.from(
  { length: env.GEMINI_EMBEDDING_DIMENSIONS },
  (_, index) => index / 1000,
);

validateEmbeddingVector(
  configuredVector,
  env.GEMINI_EMBEDDING_DIMENSIONS,
);

const configuredVectorLiteral = toPgVectorLiteral(
  configuredVector,
  env.GEMINI_EMBEDDING_DIMENSIONS,
);

assert.equal(
  configuredVectorLiteral.startsWith("["),
  true,
);

assert.equal(
  configuredVectorLiteral.endsWith("]"),
  true,
);

assert.equal(
  configuredVectorLiteral.slice(1, -1).split(",").length,
  env.GEMINI_EMBEDDING_DIMENSIONS,
);

console.log(
  `Test 8 passed: ${env.GEMINI_EMBEDDING_DIMENSIONS}-dimensional vector`,
);


// =========================================================
// All tests completed
// =========================================================

console.log("\nAll vector utility tests passed.\n");