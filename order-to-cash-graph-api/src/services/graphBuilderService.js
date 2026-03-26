const graphService = require('./graphService');

function buildGraph(data) {
  const nodesMap = new Map();
  const edges = [];
  const edgesSet = new Set();

  const addNode = (id, type, properties) => {
    if (!id) return;
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, type, properties });
    }
  };

  const addEdge = (source, target, relationship) => {
    if (!source || !target) return;
    const edgeKey = `${source}-${relationship}-${target}`;
    if (!edgesSet.has(edgeKey)) {
      edgesSet.add(edgeKey);
      edges.push({ source, target, relationship });
    }
  };

  // Helper arrays for fallback linkage if data is missing relationship fields
  const salesOrders = data.salesOrders || [];
  const deliveries = data.deliveries || [];

  // MOCK PRODUCTS: Since the dataset lacks line items, we'll assign pseudo-products
  const MOCK_PRODUCTS = ['PROD-A100', 'PROD-B200', 'PROD-C300', 'PROD-X999'];
  MOCK_PRODUCTS.forEach(p => addNode(p, 'Product', { name: p, type: 'Finished Goods' }));

  // 1. Sales Orders & Customers & Products
  (data.salesOrders || []).forEach((so, index) => {
    addNode(so.salesOrder, 'SalesOrder', so);
    
    // Customer parsing
    if (so.soldToParty) {
      addNode(so.soldToParty, 'Customer', { customerId: so.soldToParty });
      addEdge(so.soldToParty, so.salesOrder, 'PLACED_ORDER');
    }

    // Synthesize Product mapping (SalesOrderItem -> Product)
    const mockProduct = MOCK_PRODUCTS[index % MOCK_PRODUCTS.length];
    addEdge(so.salesOrder, mockProduct, 'CONTAINS_PRODUCT');
  });

  // 2. Deliveries
  (data.deliveries || []).forEach((del, index) => {
    addNode(del.deliveryDocument, 'Delivery', del);
    
    // Fallback to sequential mapping if the mock data lacks `referenceDocument`
    const fallbackSO = salesOrders[index % salesOrders.length];
    const refDoc = del.referenceDocument || (fallbackSO ? fallbackSO.salesOrder : null);
    
    addEdge(refDoc, del.deliveryDocument, 'HAS_DELIVERY');
  });

  // 3. Invoices
  (data.invoices || []).forEach((inv, index) => {
    const invId = inv.billingDocument || inv.invoice || inv.accountingDocument;
    addNode(invId, 'Invoice', inv);
    
    // Fallback to sequential mapping if the mock data lacks `referenceDocument`
    const fallbackDel = deliveries[index % deliveries.length];
    const refDoc = inv.referenceDocument || (fallbackDel ? fallbackDel.deliveryDocument : null);
    
    addEdge(refDoc, invId, 'HAS_INVOICE');
    
    if (inv.accountingDocument) {
      addEdge(invId, inv.accountingDocument, 'HAS_JOURNAL_ENTRY');
    }
  });

  // 4. Journal Entries
  (data.journalEntries || []).forEach((je, index) => {
    addNode(je.accountingDocument, 'JournalEntry', je);
    addEdge(je.accountingDocument, je.clearingAccountingDocument, 'HAS_PAYMENT');
  });

  // 5. Payments
  (data.payments || []).forEach(pay => {
    addNode(pay.accountingDocument, 'Payment', pay);
  });

  const graph = {
    nodes: Array.from(nodesMap.values()),
    edges
  };

  // Keep compatibility with the existing global graph service
  graphService.loadGraph(graph.nodes, graph.edges);

  return graph;
}

module.exports = { buildGraph };
