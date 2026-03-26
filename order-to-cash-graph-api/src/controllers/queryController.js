const llmService = require('../services/llmService');
const queryService = require('../services/queryService');

function formatTopProducts(products) {
  if (!products.length) return 'No product data found in project dataset.';
  const lines = products.map(
    (p, i) => `${i + 1}. Product ${p.id} - linked orders: ${p.orderCount}`
  );
  return `Top products from project data:\n${lines.join('\n')}`;
}

function formatIncompleteOrders(orders) {
  if (!orders.length) return 'No incomplete sales orders found in project dataset.';
  const lines = orders.map(
    (o, i) =>
      `${i + 1}. Sales Order ${o.salesOrder} | Status: ${o.status} | Date: ${o.date || 'N/A'}`
  );
  return `Incomplete orders from project data:\n${lines.join('\n')}`;
}

function formatTrace(flow, id) {
  if (!flow) return `Document ${id} was not found in project dataset.`;
  const nodesByType = flow.nodes.reduce((acc, n) => {
    acc[n.label] = (acc[n.label] || 0) + 1;
    return acc;
  }, {});
  const typeSummary = Object.entries(nodesByType)
    .map(([label, count]) => `${label}: ${count}`)
    .join(', ');

  const edgePreview = flow.edges
    .slice(0, 12)
    .map((e) => `${e.source} --${e.relationship}--> ${e.target}`)
    .join('\n');

  return [
    `Trace for document ${id} from project data:`,
    `- Nodes: ${flow.nodes.length}`,
    `- Edges: ${flow.edges.length}`,
    `- Breakdown: ${typeSummary || 'N/A'}`,
    edgePreview ? '\nFlow preview:\n' + edgePreview : ''
  ].join('\n');
}

function extractIds(text) {
  const matches = text.match(/\b\d{5,}\b/g) || [];
  return Array.from(new Set(matches));
}

function buildGroundedPrompt(userQuery, context) {
  return [
    'You are the Order-to-Cash Graph Assistant.',
    'Answer ONLY using the JSON context below.',
    'Do not use outside knowledge.',
    'If the answer is not present in context, reply exactly: "Not found in project data."',
    'Keep answer concise and factual.',
    '',
    `User question: ${userQuery}`,
    '',
    'Context JSON:',
    JSON.stringify(context, null, 2)
  ].join('\n');
}

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

  const cleanQuery = query.trim();
  const lower = cleanQuery.toLowerCase();
  const ids = extractIds(cleanQuery);

  try {
    // Deterministic intent handlers to avoid hallucinations.
    if (lower.includes('top product')) {
      const topProducts = queryService.getTopProducts();
      return res.status(200).json({
        success: true,
        answer: formatTopProducts(topProducts)
      });
    }

    if (lower.includes('incomplete') && lower.includes('order')) {
      const incompleteOrders = queryService.getIncompleteOrders();
      return res.status(200).json({
        success: true,
        answer: formatIncompleteOrders(incompleteOrders)
      });
    }

    if (ids.length > 0) {
      const flow = queryService.traceDocumentFlow(ids[0]);
      return res.status(200).json({
        success: true,
        answer: formatTrace(flow, ids[0])
      });
    }

    // Grounded fallback for generic project questions.
    const stats = queryService.getOverallStats();
    const context = {
      project: 'Order-to-Cash Graph',
      availableIntents: [
        'trace document by ID',
        'top products',
        'incomplete orders',
        'overall stats'
      ],
      stats
    };

    const prompt = buildGroundedPrompt(cleanQuery, context);
    const answer = await llmService.askGemini(prompt);

    return res.status(200).json({
      success: true,
      answer
    });
  } catch (err) {
    console.error('QUERY ERROR:', err);
    const message = err && err.message ? err.message : 'LLM failed';
    const statusCode =
      message.includes('Missing Gemini API key') ? 503 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'LLM failed',
      error: message
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
