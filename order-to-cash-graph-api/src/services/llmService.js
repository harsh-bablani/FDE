const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
console.log('Gemini Key Loaded:', !!process.env.GEMINI_API_KEY);

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn('GEMINI_API_KEY is missing. Gemini LLM calls will fail.');
}

async function askGemini(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt must be a non-empty string');
  }

  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash'
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('Gemini response:', text);
    return text;
  } catch (error) {
    console.error('GEMINI ERROR:', error);
    throw new Error(`Gemini failed — ${error.message || 'unknown error'}`);
  }
}

module.exports = {
  askGemini
};
