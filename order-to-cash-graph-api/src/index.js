const express = require('express');
const cors = require('cors');
const config = require('./config');
const dataMergerService = require('./services/dataMergerService');
const validationService = require('./services/validationService');
const graphBuilderService = require('./services/graphBuilderService');
const graphService = require('./services/graphService');
const graphRoutes = require('./routes/graphRoutes');
const queryRoutes = require('./routes/queryRoutes');

const app = express();

app.use(cors({
  // Allow localhost, Vercel frontend and your Render backend URL
  origin: [
    'http://localhost:5173',
    'https://your-frontend-app.vercel.app',
    'https://fde-psi.vercel.app',
    'https://fde-19ao.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
    <h1>Order-to-Cash Graph API</h1>
    <p>The server is running successfully!</p>
    <ul>
      <li><a href="/api/graph/stats">Graph Stats</a></li>
      <li><a href="/api/graph/full">Full Graph (JSON)</a></li>
    </ul>
    <p>To use the LLM Interface, send a POST request to <code>/api/query</code>.</p>
  `);
});

app.use('/api/graph', graphRoutes);
app.use('/api/query', queryRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

async function init() {
  console.log('Starting data ingestion pipeline...');
  const mergedData = await dataMergerService.getMergedData();
  
  console.log('Validating ingested data...');
  validationService.validate(mergedData);
  
  console.log('Building graph...');
  graphBuilderService.buildGraph(mergedData);
  
  console.log(`Graph loaded: ${graphService.nodes.size} nodes, ${graphService.edges.length} edges`);

  // Render provides the PORT environment variable for production.
  // Fallback to config.port or 3001 for local development.
  const PORT = process.env.PORT || config.port || 3001;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

init().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
