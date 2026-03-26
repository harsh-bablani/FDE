const { GoogleGenerativeAI } = require('@google/generative-ai');
const queryService = require('./queryService');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn('GEMINI_API_KEY is not set; LLM requests will use local fallback query service.');
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

async function queryGraphWithLLM(userMessage) {
  if (!genAI) {
    const normalized = userMessage.toLowerCase();
    const docId = parseDocumentId(userMessage);

    if ((normalized.includes('trace') || normalized.includes('flow')) && docId) {
      const graphDataFetched = queryService.traceDocumentFlow(docId);
      if (!graphDataFetched || graphDataFetched.nodes.length === 0) {
        return {
          answer: `Could not find a document flow for ID ${docId}. Please verify the ID and try again.`,
          graphDataFetched: null
        };
      }
      return {
        answer: `Trace result for ${docId}: ${graphDataFetched.nodes.length} nodes and ${graphDataFetched.edges.length} edges found.`,
        graphDataFetched
      };
    }

    if (normalized.includes('top product') || normalized.includes('top products')) {
      const graphDataFetched = queryService.getTopProducts();
      return {
        answer: `Top products by order count: ${graphDataFetched.map(p => `${p.id} (${p.orderCount})`).join(', ')}`,
        graphDataFetched
      };
    }

    if (normalized.includes('incomplete')) {
      const graphDataFetched = queryService.getIncompleteOrders();
      return {
        answer: `Incomplete orders: ${graphDataFetched.map(o => `${o.salesOrder} (${o.status})`).join(', ')}`,
        graphDataFetched
      };
    }

    return {
      answer: 'LLM is not configured (missing GEMINI_API_KEY) and your request does not match built-in automations. Use a specific phrase like "trace <id>", "top products", or "incomplete orders".',
      graphDataFetched: null
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: tools,
      systemInstruction: systemInstruction,
    });

    // Start a chat session, allowing multiple turns if it calls a tool
    const chat = model.startChat();
    
    // First round: send the user prompt
    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    
    // Check if the model decided to call a function
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0]; // Take the first tool call
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
          throw new Error(`Unknown function: ${call.name}`);
        }
      } catch (err) {
        toolResponseData = { error: err.message || "Failed to execute backend graph query" };
      }

      // Second round: send the function result back to the model
      const toolResultObj = [
        {
          functionResponse: {
            name: call.name,
            response: toolResponseData
          }
        }
      ];
      
      const followUpResult = await chat.sendMessage(toolResultObj);
      return {
        answer: followUpResult.response.text(),
        graphDataFetched: toolResponseData
      };
      
    } else {
      // Model responded directly (either didn't need a tool, or guardrail hit)
      return {
        answer: response.text(),
        graphDataFetched: null
      };
    }
  } catch (error) {
    console.error('LLM Query Error:', error);
    throw new Error('Failed to process LLM query: ' + error.message);
  }
}

module.exports = {
  queryGraphWithLLM
};
