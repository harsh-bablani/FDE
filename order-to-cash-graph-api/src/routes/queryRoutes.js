const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

// POST /api/query -> handles natural language queries
router.post('/', queryController.handleQuery);

module.exports = router;
