import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Color map according to user requirements
const NODE_COLORS = {
  SalesOrder: '#3b82f6',     // Blue
  Delivery: '#f97316',       // Orange
  Invoice: '#22c55e',        // Green
  JournalEntry: '#a855f7',   // Purple
  Payment: '#ef4444',        // Red
  Unknown: '#9ca3af'         // Gray
};

function GraphViewer({ graphData, onNodeClick, selectedNode }) {
  const fgRef = useRef();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Highlight tracking
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const updateSize = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height))
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Compute graph traversal indexing to quickly find connected paths
  const graphIndex = useMemo(() => {
    const nodesById = new Map();
    const linksByNode = new Map();

    graphData.nodes.forEach(n => {
      nodesById.set(n.id, n);
      linksByNode.set(n.id, []);
    });

    graphData.links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      
      if (!linksByNode.has(src)) linksByNode.set(src, []);
      if (!linksByNode.has(tgt)) linksByNode.set(tgt, []);
      
      linksByNode.get(src).push(l);
      linksByNode.get(tgt).push(l);
    });

    return { nodesById, linksByNode };
  }, [graphData]);

  // When a node is selected (via click), calculate all connected nodes/links
  useEffect(() => {
    if (!selectedNode) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const newHighlightNodes = new Set([selectedNode.id]);
    const newHighlightLinks = new Set();
    const queue = [selectedNode.id];

    // BFS to find all connected components
    while (queue.length > 0) {
      const current = queue.shift();
      const connectedLinks = graphIndex.linksByNode.get(current) || [];
      
      connectedLinks.forEach(link => {
        const src = typeof link.source === 'object' ? link.source.id : link.source;
        const tgt = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (!newHighlightLinks.has(link)) {
          newHighlightLinks.add(link);
        }
        
        if (!newHighlightNodes.has(src)) {
          newHighlightNodes.add(src);
          queue.push(src);
        }
        if (!newHighlightNodes.has(tgt)) {
          newHighlightNodes.add(tgt);
          queue.push(tgt);
        }
      });
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  }, [selectedNode, graphIndex]);

  const getNodeColor = (node) => {
    const label = node.label || node.type;
    return NODE_COLORS[label] || NODE_COLORS.Unknown;
  };

  const drawNode = useCallback((node, ctx, globalScale) => {
    const label = node.id;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4); // slightly wider padding

    // Opacity fades if we have a selection and this node isn't in it
    const isMuted = highlightNodes.size > 0 && !highlightNodes.has(node.id);
    ctx.globalAlpha = isMuted ? 0.2 : 1.0;

    // Draw pill background
    ctx.fillStyle = getNodeColor(node);
    
    // Draw rounded rect (pill)
    ctx.beginPath();
    ctx.roundRect(
      node.x - bckgDimensions[0] / 2,
      node.y - bckgDimensions[1] / 2,
      bckgDimensions[0],
      bckgDimensions[1],
      4 // border radius
    );
    ctx.fill();

    // Draw text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; // White text for clarity against colored background
    ctx.fillText(label, node.x, node.y);

    node.__bckgDimensions = bckgDimensions;
    ctx.globalAlpha = 1.0; // Reset alpha for other draws
  }, [highlightNodes]);

  const drawPointerArea = useCallback((node, color, ctx) => {
    ctx.fillStyle = color;
    const bckgDimensions = node.__bckgDimensions;
    if (bckgDimensions) {
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
    }
  }, []);

  return (
    <div ref={containerRef} className="graph-canvas">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={drawPointerArea}
          onNodeClick={(node) => {
            fgRef.current.centerAt(node.x, node.y, 1000);
            fgRef.current.zoom(4, 2000); // Zoom in but not too close (4 instead of 8)
            onNodeClick(node);
          }}
          
          // Path fading for edges
          linkColor={link => (highlightLinks.size === 0 || highlightLinks.has(link)) ? '#94a3b8' : 'rgba(148, 163, 184, 0.1)'}
          linkWidth={link => (highlightLinks.has(link) ? 2 : 1)}
          
          // Directional Flow (DAG Left to Right)
          dagMode="lr"
          dagLevelDistance={80} // Spacing between flow steps
          
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          
          // Node physics adjustment to allow breathing room
          d3VelocityDecay={0.3}
          cooldownTicks={100}
        />
      )}
    </div>
  );
}

export default GraphViewer;
