const fs = require('fs');
const readline = require('readline');
const path = require('path');
const config = require('../config');

async function getMergedData() {
  const dataDir = path.resolve(process.cwd(), config.dataPath);
  
  const result = {
    salesOrders: [],
    deliveries: [],
    invoices: [],
    journalEntries: [],
    payments: []
  };

  if (!fs.existsSync(dataDir)) {
    return result;
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.jsonl'));

  // Helper to determine the target array based on filename
  const getTargetArray = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.startsWith('sales_order')) return result.salesOrders;
    if (lower.startsWith('outbound_delivery') || lower.startsWith('delivery')) return result.deliveries;
    if (lower.startsWith('invoice') || lower.startsWith('billing')) return result.invoices;
    if (lower.startsWith('journal_entry')) return result.journalEntries;
    if (lower.startsWith('payment')) return result.payments;
    // Fallback based on specific user file mentions
    return null; 
  };

  // Process all files concurrently
  const processPromises = files.map(async (file) => {
    const targetArray = getTargetArray(file);
    if (!targetArray) return; // Skip files that don't match any entity

    const filePath = path.join(dataDir, file);
    const fileStream = fs.createReadStream(filePath);
    
    // We use crlfDelay to handle all typical newline characters
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        targetArray.push(record);
      } catch (err) {
        console.warn(`[DataMerger] Failed to parse line in ${file}: ${err.message}`);
      }
    }
  });

  await Promise.all(processPromises);

  return result;
}

module.exports = {
  getMergedData
};
