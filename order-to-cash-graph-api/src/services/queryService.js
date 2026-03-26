const graphService = require('./graphService');

class QueryService {
  getFullGraph() {
    return {
      nodes: graphService.getNodes(),
      edges: graphService.getEdges()
    };
  }

  getOverallStats() {
    const nodes = graphService.getNodes();
    const countsByType = nodes.reduce((acc, node) => {
      acc[node.label] = (acc[node.label] || 0) + 1;
      return acc;
    }, {});

    return {
      totalNodes: nodes.length,
      totalEdges: graphService.getEdges().length,
      countsByType
    };
  }

  getNodeConnections(id) {
    const node = graphService.getNode(id);
    if (!node) return null;

    const outgoingEdges = graphService.getOutgoingEdges(id);
    const incomingEdges = graphService.getIncomingEdges(id);
    
    // For visualization, we need the connected nodes as well
    const connectedNodeIds = new Set();
    outgoingEdges.forEach(e => connectedNodeIds.add(e.target));
    incomingEdges.forEach(e => connectedNodeIds.add(e.source));
    
    const connectedNodes = Array.from(connectedNodeIds)
                                .map(nId => graphService.getNode(nId))
                                .filter(Boolean);

    return {
      node,
      nodes: [node, ...connectedNodes],
      edges: [...incomingEdges, ...outgoingEdges]
    };
  }

  traceDocumentFlow(startId) {
    const startNode = graphService.getNode(startId);
    if (!startNode) return null;

    const visitedNodes = new Set();
    const visitedEdges = new Set();
    const queue = [startId];
    
    // Master data node labels that shouldn't bridge distinct document flows
    const breakFanOutLabels = new Set(['Customer', 'Product']);

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visitedNodes.has(currentId)) continue;
      
      visitedNodes.add(currentId);
      const currentNode = graphService.getNode(currentId);

      // Add outgoing
      const outgoing = graphService.getOutgoingEdges(currentId);
      for (const edge of outgoing) {
        visitedEdges.add(edge);
        if (!visitedNodes.has(edge.target)) {
          // If we hit a Master Data node, we add it to the graph, but don't queue it for further expansion 
          // (prevents tracing 1 SalesOrder from expanding to ALL SalesOrders sharing the same Customer/Product)
          const targetNode = graphService.getNode(edge.target);
          if (targetNode && breakFanOutLabels.has(targetNode.label)) {
            visitedNodes.add(edge.target);
          } else {
            queue.push(edge.target);
          }
        }
      }

      // Add incoming (unless it's a master data node to avoid upstream flooding)
      // If the CURRENT node is master data, don't crawl incoming.
      if (currentNode && breakFanOutLabels.has(currentNode.label)) continue;

      const incoming = graphService.getIncomingEdges(currentId);
      for (const edge of incoming) {
        visitedEdges.add(edge);
        if (!visitedNodes.has(edge.source)) {
          const sourceNode = graphService.getNode(edge.source);
          if (sourceNode && breakFanOutLabels.has(sourceNode.label)) {
            visitedNodes.add(edge.source);
          } else {
            queue.push(edge.source);
          }
        }
      }
    }

    const nodes = Array.from(visitedNodes).map(id => graphService.getNode(id)).filter(Boolean);
    const edges = Array.from(visitedEdges);

    return { nodes, edges };
  }

  getTopProducts() {
    // Top products by connection count (simulating popularity)
    const nodes = graphService.getNodes().filter(n => n.label === 'Product');
    const productStats = nodes.map(n => {
      // Products are connected via incoming CONTAINS_PRODUCT from SalesOrder
      const incomingOrders = graphService.getIncomingEdges(n.id).length;
      return { id: n.id, orderCount: incomingOrders };
    });
    
    return productStats.sort((a, b) => b.orderCount - a.orderCount).slice(0, 5);
  }

  getIncompleteOrders() {
    // Sales orders where overallDeliveryStatus is not 'C' (Completed)
    const soNodes = graphService.getNodes().filter(n => n.label === 'SalesOrder');
    const incomplete = soNodes.filter(n => n.props && n.props.overallDeliveryStatus !== 'C');
    
    return incomplete.map(n => ({
      salesOrder: n.id,
      status: n.props.overallDeliveryStatus || 'Unknown',
      date: n.props.creationDate
    })).slice(0, 10); // Return top 10 for brevity
  }
}

module.exports = new QueryService();
