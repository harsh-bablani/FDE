const llmService = require('../services/llmService');

async function handleQuery(req, res) {
  console.log('Incoming /api/query request body:', req.body);

  if (!req.body || typeof req.body !== 'object') {
    console.warn('Invalid request body');
    return res.status(400).json({
      success: false,
      message: 'Invalid request body',
      error: 'Request body must be JSON with { query: "..." }'
    });
  }

  const { query } = req.body;
  console.log('Parsed query:', query);

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid query',
      error: 'Query must be a non-empty string'
    });
  }

  try {
    const answer = await llmService.askGemini(query.trim());

    return res.status(200).json({
      success: true,
      answer
    });
  } catch (err) {
    console.error('QUERY ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'LLM failed',
      error: err.message
    });
  }
}

async function testGemini(req, res) {
  try {
    const test = await llmService.askGemini('Say hello');
    return res.status(200).json({ success: true, test });
  } catch (err) {
    console.error('TEST GEMINI ERROR:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleQuery,
  testGemini
};
