const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/caterly-db'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'locations'");
  console.log('Locations columns:', res.rows.map(r => r.column_name).sort().join(', '));
  
  // also check some values
  const res2 = await client.query("SELECT * FROM locations LIMIT 1");
  console.log('Location sample:', res2.rows[0]);

  await client.end();
}

run().catch(console.error);
