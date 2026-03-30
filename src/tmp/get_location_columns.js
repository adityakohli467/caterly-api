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
    const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'locations'
    `);
    console.log(JSON.stringify(res.rows.map(r => r.column_name)));
  } finally {
    await client.end();
  }
}

run().catch(console.error);
