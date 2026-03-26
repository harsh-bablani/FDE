const fs = require('fs');
const readline = require('readline');
const path = require('path');
const graphService = require('./graphService');
const config = require('../config');

// Ingest JSONL files
async function ingestFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      processRecord(record);
    } catch (err) {
      console.error(`Error parsing JSON from ${filePath}: ${err.message}`);
    }
  }
}

function processRecord(record) {
  // Extract common fields depending on entity type
  // Simple assumption: record has 'type', 'id', and optionally links to other entities
  const { type, id, ...props } = record;
  if (!type || !id) return; // invalid record

  graphService.addNode(id, type, props);

  // Build relationships based on type
  if (type === 'Delivery' && props.salesOrderId) {
    graphService.addEdge(props.salesOrderId, id, 'HAS_DELIVERY');
  }
  if (type === 'Invoice' && props.deliveryId) {
    graphService.addEdge(props.deliveryId, id, 'HAS_INVOICE');
  }
  if (type === 'JournalEntry' && props.invoiceId) {
    graphService.addEdge(props.invoiceId, id, 'HAS_JOURNAL_ENTRY');
  }
  if (type === 'Payment' && props.journalEntryId) {
    graphService.addEdge(props.journalEntryId, id, 'HAS_PAYMENT');
  }
}

async function startIngestion() {
  const dataDir = path.resolve(process.cwd(), config.dataPath);
  if (!fs.existsSync(dataDir)) {
    console.log(`Creating data directory at ${dataDir}`);
    fs.mkdirSync(dataDir, { recursive: true });
    return;
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.jsonl'));
  for (const file of files) {
    console.log(`Ingesting ${file}...`);
    await ingestFile(path.join(dataDir, file));
  }
  console.log(`Graph loaded: ${graphService.nodes.size} nodes, ${graphService.edges.length} edges`);
}

module.exports = {
  startIngestion,
  ingestFile
};
