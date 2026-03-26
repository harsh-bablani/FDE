const { GoogleGenerativeAI } = require('@google/generative-ai');
const queryService = require('./queryService');

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
console.log('API KEY:', API_KEY ? 'SET' : 'MISSING');

let genAI = null;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  console.warn('No API_KEY/GEMINI_API_KEY set; will use local fallback query handling.');
}

const tools = [
  {
    functionDeclarations: [
      {
        name: 'trace_document_flow',
        description: 'Traces the end-to-end flow of an SAP document (Sales Order, Delivery, Invoice, etc.) by finding all connected documents in the graph. Should be used when users ask to trace a document or find its lifecycle.',
        parameters: {
          type: 'OBJECT',
          properties: {
            documentId: {
              type: 'STRING',
              description: 'The exact alphanumeric ID of the document (e.g., 740506, 9400000249, 80737721).'
            }
          },
          required: ['documentId']
        }
      },
      {
        name: 'get_neighborhood',
        description: 'Fetches the direct 1-degree neighborhood connections of a specific SAP document node. Use this to find immediate parents or children.',
        parameters: {
          type: 'OBJECT',
          properties: {
            documentId: {
              type: 'STRING',
              description: 'The exact alphanumeric document ID to fetch.'
            }
          },
          required: ['documentId']
        }
      },
      {
        name: 'get_top_products',
        description: 'Fetches the top products based on sales order volume and connection metrics.'
      },
      {
        name: 'get_incomplete_orders',
        description: 'Fetches a list of incomplete sales orders that have not finished their delivery or goods movement lifecycle.'
      }
    ]
  }
];

const systemInstruction = `You are an expert AI Assistant specialized in analyzing SAP Order-to-Cash (O2C) graphs.
Your primary job is to help users query sales orders, deliveries, invoices, journal entries, payments, customers, and products.

### GUARDRAILS & BOUNDARIES
1. ONLY answer questions related to the Order-to-Cash process and the provided SAP entities.
2. If a user asks an unrelated question (e.g., "Who is Elon Musk?", "Write a poem", general programming, outside topics, or non-SAP/business dataset questions), you MUST literally respond word-for-word exactly: "This system is designed to answer questions related to the provided dataset only."
3. DO NOT hallucinate data. If the graph data returned explicitly lacks information, state clearly that the document is missing or not linked in the system.

### DATA STRUCTURE
- Customers map to SalesOrders (PLACED_ORDER)
- SalesOrders map to Deliveries (HAS_DELIVERY)
- SalesOrders map to Products (CONTAINS_PRODUCT)
- Invoices map to JournalEntries (HAS_JOURNAL_ENTRY)
- JournalEntries map to Payments (HAS_PAYMENT)

### INSTRUCTIONS
1. Analyze the user's natural language request.
2. If the user asks for document details or metrics (like top products), call the appropriate tool.
3. Synthesize the raw JSON graph data into a natural, easy-to-read summary for the user. Do not expose raw JSON in your final answer unless asked.`;

function parseDocumentId(message) {
  const match = message.match(/\b(\d{4,14})\b/);
  return match ? match[1] : null;
}

function runLocalQuery(userMessage) {
  const normalized = userMessage.trim().toLowerCase();
  const docId = parseDocumentId(userMessage);

  if ((normalized.includes('trace') || normalized.includes('flow')) && docId) {
    const graphDataFetched = queryService.traceDocumentFlow(docId);
    if (!graphDataFetched || graphDataFetched.nodes.length === 0) {
      return {
        success: false,
        answer: `Could not find a document flow for ID ${docId}. Please verify the ID and try again.`,
        error: `Document ${docId} not found`,
        graphDataFetched: null
      };
    }
    return {
      success: true,
      answer: `Trace result for ${docId}: ${graphDataFetched.nodes.length} nodes and ${graphDataFetched.edges.length} edges found.`,
      graphDataFetched
    };
  }

  if (normalized.includes('top product') || normalized.includes('top products')) {
    const graphDataFetched = queryService.getTopProducts();
    return {
      success: true,
      answer: `Top products by order count: ${graphDataFetched.map(p => `${p.id} (${p.orderCount})`).join(', ')}`,
      graphDataFetched
    };
  }

  if (normalized.includes('incomplete')) {
    const graphDataFetched = queryService.getIncompleteOrders();
    return {
      success: true,
      answer: `Incomplete orders: ${graphDataFetched.map(o => `${o.salesOrder} (${o.status})`).join(', ')}`,
      graphDataFetched
    };
  }

  return {
    success: true,
    answer: 'This system is designed to answer questions related to the provided dataset only.',
    graphDataFetched: null
  };
}

async function queryGraphWithLLM(userMessage) {
  console.log('queryGraphWithLLM called with:', userMessage);

  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return {
      success: false,
      error: 'Empty query',
      answer: 'Please send a non-empty query string.',
      graphDataFetched: null
    };
  }

  const trimmedQuery = userMessage.trim();

  if (!genAI) {
    console.log('No LLM key available, using local fallback');
    return runLocalQuery(trimmedQuery);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: tools,
      systemInstruction: systemInstruction,
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(trimmedQuery);
    const response = result.response;
    console.log('LLM model response:', response);

    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      console.log('LLM selected function call:', call.name, 'args:', call.args);
      let toolResponseData = null;

      try {
        if (call.name === 'trace_document_flow') {
          const { documentId } = call.args;
          toolResponseData = queryService.traceDocumentFlow(documentId);
        } else if (call.name === 'get_neighborhood') {
          const { documentId } = call.args;
          toolResponseData = queryService.getNodeConnections(documentId);
        } else if (call.name === 'get_top_products') {
          toolResponseData = queryService.getTopProducts();
        } else if (call.name === 'get_incomplete_orders') {
          toolResponseData = queryService.getIncompleteOrders();
        } else {
          return {
            success: false,
            answer: 'Unknown tool request from LLM.',
            error: `Unknown function: ${call.name}`,
            graphDataFetched: null
          };
        }
      } catch (err) {
        console.error('Tool execution error:', err);
        return {
          success: false,
          answer: 'Failed to execute backend graph query.',
          error: err.message,
          graphDataFetched: null
        };
      }

      const toolResultObj = [{
        functionResponse: {
          name: call.name,
          response: toolResponseData
        }
      }];

      const followUpResult = await chat.sendMessage(toolResultObj);
      return {
        success: true,
        answer: followUpResult.response.text(),
        graphDataFetched: toolResponseData
      };
    }

    // no function call from LLM; plain answer
    return {
      success: true,
      answer: response.text(),
      graphDataFetched: null
    };
  } catch (error) {
    console.error('LLM Query Error:', error);

    const localFallbackResult = runLocalQuery(trimmedQuery);
    if (localFallbackResult && localFallbackResult.success) {
      return {
        ...localFallbackResult,
        answer: `${localFallbackResult.answer} (LLM failed; using local fallback.)`
      };
    }

    return {
      success: false,
      answer: 'Unable to process query right now. Please try again later.',
      error: error.message,
      graphDataFetched: null
    };
  }
}

module.exports = {
  queryGraphWithLLM
};
