const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : '';

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await client.connect();
  try {
    console.log('--- Orders Table Columns ---');
    const ordersColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `);
    console.log(ordersColumns.rows.map(r => `${r.column_name}: ${r.data_type}`).join(', '));

    console.log('--- Locations Table Columns ---');
    const locationColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'locations'
    `);
    console.log(locationColumns.rows.map(r => `${r.column_name}: ${r.data_type}`).join(', '));
  } finally {
    await client.end();
  }
}

run().catch(console.error);
