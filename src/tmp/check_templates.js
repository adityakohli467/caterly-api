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
      SELECT template_key, body_html
      FROM email_templates
      WHERE is_active = TRUE
    `);
    console.log(JSON.stringify(res.rows));
  } finally {
    await client.end();
  }
}

run().catch(console.error);
