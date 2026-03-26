const dataMergerService = require('../services/dataMergerService');
const queryService = require('../services/queryService');
const graphBuilderService = require('../services/graphBuilderService');
const graphService = require('../services/graphService');

async function runReport() {
  console.log('Loading and parsing data...');
  const mergedData = await dataMergerService.getMergedData();
  
  // Build the graph into memory
  graphBuilderService.buildGraph(mergedData);
  
  const nodes = graphService.getNodes();
  const edges = graphService.getEdges();

  console.log(`\n=== GRAPH QUALITY REPORT ===\n`);
  console.log(`Total Nodes Built: ${nodes.length}`);
  console.log(`Total Edges Created: ${edges.length}`);

  // 1. Ensure no duplicate nodes exist
  const uniqueIds = new Set(nodes.map(n => n.id));
  console.log(`\n--- 1. Duplicate Nodes Check ---`);
  if (uniqueIds.size === nodes.length) {
    console.log('✅ PASS: No duplicate nodes found (Map structure enforced uniqueness).');
  } else {
    console.log(`❌ FAIL: Found ${nodes.length - uniqueIds.size} duplicates!`);
  }

  // 2. Check if all nodes are properly connected (Detect orphans)
  let orphanCount = 0;
  nodes.forEach(n => {
    const outgoing = graphService.getOutgoingEdges(n.id);
    const incoming = graphService.getIncomingEdges(n.id);
    if (outgoing.length === 0 && incoming.length === 0) {
      orphanCount++;
    }
  });
  console.log(`\n--- 2. Node Connectivity Check ---`);
  if (orphanCount === 0) {
    console.log('✅ PASS: All nodes have at least one connection.');
  } else {
    console.log(`⚠️ WARNING: Found ${orphanCount} orphaned nodes (0 edges).`);
  }

  // 3. Detect missing links (e.g., Deliveries without Invoices)
  console.log(`\n--- 3. Flow Completion Check ---`);
  let deliveriesWithoutInvoices = 0;
  let salesOrderWithoutDelivery = 0;

  nodes.filter(n => n.label === 'Delivery').forEach(del => {
    const outgoing = graphService.getOutgoingEdges(del.id);
    const hasInvoice = outgoing.some(e => e.relationship === 'HAS_INVOICE');
    if (!hasInvoice) deliveriesWithoutInvoices++;
  });

  nodes.filter(n => n.label === 'SalesOrder').forEach(so => {
    const outgoing = graphService.getOutgoingEdges(so.id);
    const hasDelivery = outgoing.some(e => e.relationship === 'HAS_DELIVERY');
    if (!hasDelivery) salesOrderWithoutDelivery++;
  });

  console.log(`Deliveries missing Invoices: ${deliveriesWithoutInvoices}`);
  console.log(`Sales Orders missing Deliveries: ${salesOrderWithoutDelivery}`);

  // 4. Print sample flow
  console.log(`\n--- 4. Sample Flow Verification ---`);
  // Find a SalesOrder that actually has a delivery and invoice
  const sampleOrder = nodes.find(n => n.label === 'SalesOrder' && graphService.getOutgoingEdges(n.id).length > 0);
  if (sampleOrder) {
    const flow = queryService.traceDocumentFlow(sampleOrder.id);
    console.log(`Tracing Valid Flow for SalesOrder: ${sampleOrder.id}`);
    const flowPath = flow.edges.map(e => `  ${e.source} -> [${e.relationship}] -> ${e.target}`);
    console.log(flowPath.join('\n'));
  } else {
    console.log('No applicable SalesOrders found to trace.');
  }
  
  console.log(`\n============================\n`);
  process.exit(0);
}

runReport().catch(console.error);
