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
    const result = await llmService.queryGraphWithLLM(query.trim());

    if (!result || result.success === false) {
      console.error('Query service returned error:', result);
      return res.status(200).json({
        success: false,
        message: 'Error processing query',
        error: result && result.error ? result.error : 'Unknown query service error'
      });
    }

    return res.status(200).json({
      success: true,
      answer: result.answer,
      graphData: result.graphDataFetched || null
    });
  } catch (err) {
    console.error('Error in query controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Error processing query',
      error: err.message
    });
  }
}

module.exports = {
  handleQuery
};
