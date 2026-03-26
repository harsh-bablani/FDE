const llmService = require('../services/llmService');

async function handleQuery(req, res) {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter in request body' });
    }

    const result = await llmService.queryGraphWithLLM(query);
    
    res.json({
      success: true,
      answer: result.answer,
      graphData: result.graphDataFetched
    });
  } catch (err) {
    console.error('Error in query controller:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleQuery
};
