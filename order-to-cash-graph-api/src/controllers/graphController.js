const graphService = require('../services/graphService');
const queryService = require('../services/queryService');
const dataMergerService = require('../services/dataMergerService');

const getGraphStats = (req, res) => {
  try {
    const stats = queryService.getOverallStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFullGraph = (req, res) => {
  try {
    const graph = queryService.getFullGraph();
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getNodeConnections = (req, res) => {
  try {
    const { id } = req.params;
    const connections = queryService.getNodeConnections(id);
    if (!connections) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const traceDocumentFlow = (req, res) => {
  try {
    const { id } = req.params;
    const flow = queryService.traceDocumentFlow(id);
    if (!flow) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMergedData = async (req, res) => {
  try {
    const data = await dataMergerService.getMergedData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getGraphStats,
  getFullGraph,
  getNodeConnections,
  traceDocumentFlow,
  getMergedData
};
