const express = require('express');
const router = express.Router();
const graphController = require('../controllers/graphController');

// Define API routes
router.get('/', graphController.getFullGraph);
router.get('/stats', graphController.getGraphStats);
router.get('/full', graphController.getFullGraph);
router.get('/connections/:id', graphController.getNodeConnections);
router.get('/trace/:id', graphController.traceDocumentFlow);
router.get('/merged-data', graphController.getMergedData);

module.exports = router;
