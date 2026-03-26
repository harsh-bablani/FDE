const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.API_KEY;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MODEL_FALLBACKS = [DEFAULT_MODEL, 'gemini-1.5-flash'];

console.log('Gemini key loaded:', Boolean(GEMINI_API_KEY));
console.log('Gemini default model:', DEFAULT_MODEL);

function getClient() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Missing Gemini API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY) on the server.'
    );
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

async function askGemini(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt must be a non-empty string');
  }

  try {
    const genAI = getClient();
    let lastError = null;

    for (const modelName of MODEL_FALLBACKS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`Gemini response (${modelName}):`, text);
        return text;
      } catch (modelError) {
        lastError = modelError;
        console.warn(`Gemini failed for model ${modelName}:`, modelError.message);
      }
    }

    throw lastError || new Error('Gemini request failed for all configured models');
  } catch (error) {
    console.error('GEMINI ERROR:', error);
    throw new Error(`Gemini failed — ${error.message || 'unknown error'}`);
  }
}

module.exports = {
  askGemini
};
