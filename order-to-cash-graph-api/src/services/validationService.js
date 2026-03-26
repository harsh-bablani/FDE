function validate(data) {
  console.log('\n--- Data Validation Report ---');
  let isValid = true;

  for (const [entityName, records] of Object.entries(data)) {
    console.log(`\nDataset: ${entityName}`);
    console.log(`Count: ${records.length}`);

    if (records.length === 0) {
      console.warn(`[WARNING] Dataset ${entityName} is missing or empty!`);
      isValid = false;
    } else {
      console.log(`Sample Record:`, JSON.stringify(records[0], null, 2));
    }
  }

  console.log('\n------------------------------\n');
  return isValid;
}

module.exports = { validate };
