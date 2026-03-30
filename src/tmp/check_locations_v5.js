const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/caterly-db'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'locations'");
  fs.writeFileSync('locations_cols.json', JSON.stringify(res.rows.map(r => r.column_name).sort(), null, 2));
  await client.end();
}

run().catch(console.error);
