const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/caterly-db'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT order_comments, pickup_delivery_notes, delivery_details, delivery_contact FROM orders WHERE order_id = 800');
  console.log(JSON.stringify(res.rows[0], null, 2));
  await client.end();
}

run().catch(console.error);
