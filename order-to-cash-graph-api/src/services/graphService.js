// In-memory graph structure
class GraphService {
  constructor() {
    this.nodes = new Map(); // key: id, value: { id, label, props }
    this.edges = [];        // array of { source, target, relationship, props }
    // adjacency list for quick traversal
    this.adjList = new Map(); 
  }

  addNode(id, label, props = {}) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, label, props });
      this.adjList.set(id, []);
    }
  }

  addEdge(source, target, relationship, props = {}) {
    // Ensure nodes exist even if minimal
    if (!this.nodes.has(source)) this.addNode(source, 'Unknown');
    if (!this.nodes.has(target)) this.addNode(target, 'Unknown');

    const edge = { source, target, relationship, props };
    this.edges.push(edge);
    this.adjList.get(source).push(edge);
    // Adding reverse adjacency list for upstream traversals
    if (!this.reverseAdjList) this.reverseAdjList = new Map();
    if (!this.reverseAdjList.has(target)) this.reverseAdjList.set(target, []);
    this.reverseAdjList.get(target).push(edge);
  }

  getNodes() {
    return Array.from(this.nodes.values());
  }

  getEdges() {
    return this.edges;
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getOutgoingEdges(id) {
    return this.adjList.get(id) || [];
  }

  getIncomingEdges(id) {
    return this.reverseAdjList ? (this.reverseAdjList.get(id) || []) : [];
  }
  
  loadGraph(nodesArray, edgesArray) {
    this.clear();
    this.reverseAdjList = new Map();

    nodesArray.forEach(n => {
      // Ensure we preserve label if the previous code used type
      const label = n.type || n.label || 'Unknown';
      this.nodes.set(n.id, { id: n.id, label, props: n.properties });
      this.adjList.set(n.id, []);
    });

    edgesArray.forEach(e => {
      this.edges.push(e);

      // Create dummy nodes if missing
      if (!this.nodes.has(e.source)) {
        this.nodes.set(e.source, { id: e.source, label: 'Unknown', props: {} });
        this.adjList.set(e.source, []);
      }
      if (!this.nodes.has(e.target)) {
        this.nodes.set(e.target, { id: e.target, label: 'Unknown', props: {} });
        this.adjList.set(e.target, []);
      }

      this.adjList.get(e.source).push(e);

      if (!this.reverseAdjList.has(e.target)) {
        this.reverseAdjList.set(e.target, []);
      }
      this.reverseAdjList.get(e.target).push(e);
    });
  }

  clear() {
    this.nodes.clear();
    this.edges = [];
    this.adjList.clear();
    if (this.reverseAdjList) this.reverseAdjList.clear();
  }
}

// Export a singleton instance
module.exports = new GraphService();
