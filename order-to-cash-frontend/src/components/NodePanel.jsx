import React from 'react';

function NodePanel({ node, onClose }) {
  if (!node) return null;

  return (
    <div className="node-panel card">
      <div className="panel-header">
        <h2>{node.label || node.type} Details</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="panel-body">
        <div className="property-group">
          <strong>Document ID:</strong> {node.id}
        </div>
        
        <h3>Raw Properties</h3>
        <div className="json-tree">
          {Object.entries(node.properties || {}).map(([key, val]) => (
            <div key={key} className="property-row">
              <span className="prop-key">{key}:</span>
              <span className="prop-val">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NodePanel;
