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

app.use(cors());
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

  app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });
}

init().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
