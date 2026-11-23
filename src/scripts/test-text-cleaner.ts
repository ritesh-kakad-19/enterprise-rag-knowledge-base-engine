import { cleanExtractedText } from "../modules/documents/extraction/text-cleaner.js";

const sampleText = `
  Company       Employee       Policy


Employees      receive       20 paid leaves per year.



   Leave requests must be approved by HR.
`;

const cleanedText = cleanExtractedText(sampleText);

console.log("Original Text:");
console.log(sampleText);

console.log("\nCleaned Text:");
console.log(cleanedText);