import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GraphViewer from './components/GraphViewer';
import NodePanel from './components/NodePanel';
import ChatPanel from './components/ChatPanel';
import './App.css';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('740506'); // Default to a known Sales Order

  const fetchGraphData = (query) => {
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    
    // Use the trace endpoint instead of full graph to avoid clutter
    const endpoint = query ? `http://localhost:3000/api/graph/trace/${query}` : `http://localhost:3000/api/graph/full`;
    
    axios.get(endpoint)
      .then(response => {
        setGraphData({
          nodes: response.data.nodes || [],
          // Map edges to source and target properties required by react-force-graph
          links: (response.data.edges || []).map(edge => ({
            source: edge.source,
            target: edge.target,
            relationship: edge.relationship
          }))
        });
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching graph data:", err);
        setError(`Could not find document ${query}. It might not exist in the dataset.`);
        setLoading(false);
        setGraphData({ nodes: [], links: [] });
      });
  };

  useEffect(() => {
    // Initial fetch
    fetchGraphData(searchQuery);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchGraphData(searchQuery.trim());
    } else {
      // If empty and submitted, fetch full graph
      fetchGraphData('');
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    fetchGraphData('');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>SAP Order-to-Cash Graph</h1>
        
        <form className="search-bar" onSubmit={handleSearch}>
          <input 
            type="text" 
            placeholder="Trace Document ID (e.g. 740506)" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" disabled={loading}>Trace Flow</button>
          <button type="button" onClick={handleClear} disabled={loading} className="secondary-btn">View Full Graph</button>
        </form>
      </header>
      
      <div className="main-content">
        {loading && <div className="loading">Tracing document flow...</div>}
        {error && <div className="error">{error}</div>}
        
        {!loading && !error && graphData.nodes.length === 0 && (
          <div className="loading">No flow data found for this document.</div>
        )}
        
        {!loading && graphData.nodes.length > 0 && (
          <div className="graph-container">
            <GraphViewer 
              graphData={graphData} 
              onNodeClick={(node) => setSelectedNode(node)} 
              selectedNode={selectedNode}
            />
          </div>
        )}
        
        {selectedNode && (
          <div className="side-panel">
            <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
        )}

        <div className="chat-container">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
