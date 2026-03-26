const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.API_KEY;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MODEL_FALLBACKS = Array.from(
  new Set([
    DEFAULT_MODEL,
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ])
);
const API_VERSIONS = ['v1', 'v1beta'];

console.log('Gemini key loaded:', Boolean(GEMINI_API_KEY));
console.log('Gemini default model:', DEFAULT_MODEL);

function getApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Missing Gemini API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY) on the server.'
    );
  }
  return GEMINI_API_KEY;
}

async function callGemini(modelName, apiVersion, prompt, apiKey) {
  const endpoint =
    `https://generativelanguage.googleapis.com/${apiVersion}/models/` +
    `${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiMessage =
      data?.error?.message ||
      `HTTP ${response.status} from Gemini API`;
    throw new Error(apiMessage);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }
  return text;
}

async function askGemini(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt must be a non-empty string');
  }

  try {
    const apiKey = getApiKey();
    let lastError = null;

    for (const modelName of MODEL_FALLBACKS) {
      for (const apiVersion of API_VERSIONS) {
        try {
          const text = await callGemini(modelName, apiVersion, prompt, apiKey);
          console.log(`Gemini response (${apiVersion}/${modelName}):`, text);
          return text;
        } catch (modelError) {
          lastError = modelError;
          console.warn(
            `Gemini failed for ${apiVersion}/${modelName}:`,
            modelError.message
          );
        }
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
