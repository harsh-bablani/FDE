const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.API_KEY;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const PREFERRED_MODELS = Array.from(
  new Set([
    DEFAULT_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ])
);
const API_VERSIONS = ['v1', 'v1beta'];
const modelCache = new Map();

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

async function getCandidateModels(apiKey, apiVersion) {
  const cacheKey = `${apiVersion}:${apiKey.slice(0, 6)}`;
  const cached = modelCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 10 * 60 * 1000) {
    return cached.models;
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/${apiVersion}/models?key=` +
    encodeURIComponent(apiKey);
  const response = await fetch(endpoint);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiMessage =
      data?.error?.message ||
      `HTTP ${response.status} while listing models`;
    throw new Error(apiMessage);
  }

  const allModels = Array.isArray(data?.models) ? data.models : [];
  const generateModels = allModels
    .filter((m) =>
      Array.isArray(m.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m) => (m.name || '').replace(/^models\//, ''))
    .filter(Boolean);

  const preferredPresent = PREFERRED_MODELS.filter((m) => generateModels.includes(m));
  const flashModels = generateModels.filter((m) => m.includes('flash'));
  const otherModels = generateModels.filter((m) => !m.includes('flash')).slice(0, 3);
  const candidates = Array.from(new Set([...preferredPresent, ...flashModels, ...otherModels]));

  if (!candidates.length) {
    throw new Error(`No generateContent-capable models found on ${apiVersion}`);
  }

  modelCache.set(cacheKey, { timestamp: now, models: candidates });
  return candidates;
}

async function askGemini(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt must be a non-empty string');
  }

  try {
    const apiKey = getApiKey();
    let lastError = null;

    for (const apiVersion of API_VERSIONS) {
      let candidateModels = [];
      try {
        candidateModels = await getCandidateModels(apiKey, apiVersion);
      } catch (listError) {
        lastError = listError;
        console.warn(`Gemini model list failed for ${apiVersion}:`, listError.message);
        continue;
      }

      for (const modelName of candidateModels) {
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
