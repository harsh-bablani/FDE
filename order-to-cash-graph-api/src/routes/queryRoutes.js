const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

// POST /api/query -> handles natural language queries
router.post('/', queryController.handleQuery);

// GET /api/query/test-gemini -> quick LLM connectivity test
router.get('/test-gemini', queryController.testGemini);

module.exports = router;
