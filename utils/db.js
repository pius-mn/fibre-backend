const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL pool
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/milestone_tracker',
  max: 10,
  idleTimeoutMillis: 10000,
});

// Test DB connection
(async () => {
  try {
    const client = await db.connect();
    console.log('✅ Connected to PostgreSQL database');
    client.release();
  } catch (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.message);
    process.exit(1);
  }
})();

// Query helper
const queryDB = async (query, params = []) => {
  const client = await db.connect();
  try {
    const res = await client.query(query, params);
    return res.rows;
  } catch (err) {
    console.error('❌ Database query error:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await db.end();
    console.log('✅ PostgreSQL pool closed gracefully');
  } catch (err) {
    console.error('❌ Error closing PostgreSQL pool:', err.message);
  } finally {
    process.exit(0);
  }
});

module.exports = { db, queryDB };
