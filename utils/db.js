const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 20000
});

// Test connection
(async () => {
  try {
    await db.query('SELECT 1');
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
})();

// Heartbeat monitor
setInterval(() => {
  db.query('SELECT 1').catch(err => 
    console.error('DB heartbeat failed:', err.message)
  );
}, 60000);

// Simplified query helper
const queryDB = (query, params) => 
  db.query(query, params).then(res => res.rows);

// Graceful shutdown
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    try {
      await db.end();
      console.log('PostgreSQL pool closed');
      process.exit(0);
    } catch (err) {
      console.error('Shutdown error:', err.message);
      process.exit(1);
    }
  });
});

module.exports = { queryDB };