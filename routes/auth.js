const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { queryDB } = require('../utils/db'); // Postgres version of queryDB
const router = express.Router();
const saltRounds = 10;

async function findTokenByRefreshToken(refreshToken) {
  // Query only non-expired tokens (optionally add user filtering if you want)
  const tokens = await queryDB(
    'SELECT * FROM tokens WHERE expires_at > NOW()'
  );

  // Check tokens concurrently; return first matching token
  return await Promise.any(
    tokens.map(async (t) => {
      if (await bcrypt.compare(refreshToken, t.refresh_token)) return t;
      throw new Error('No match');
    })
  ).catch(() => null);
}
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const role = 'user';

  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const existingUser = await queryDB('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const inserted = await queryDB(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, role]
    );

    res.status(201).json({ message: 'User registered successfully.', userId: inserted[0].id });
  } catch (error) {
    console.error('Error registering user:', error.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
});




router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const rows = await queryDB('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid username or password.' });

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const hashedRefreshToken = await bcrypt.hash(refreshToken, saltRounds);
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await queryDB(
      'INSERT INTO tokens (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedRefreshToken, expiresAt]
    );

    res.json({ accessToken, refreshToken, role: user.role, userId: user.id,user: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login.' });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Please provide a refresh token.' });

  try {
    const tokenRecord = await findTokenByRefreshToken(refreshToken);

    if (!tokenRecord) return res.status(403).json({ message: 'Invalid or expired refresh token.' });

    const userRows = await queryDB('SELECT * FROM users WHERE id = $1', [tokenRecord.user_id]);
    const user = userRows[0];

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Please provide a refresh token.' });

  try {
    const tokenToDelete = await findTokenByRefreshToken(refreshToken);

    if (!tokenToDelete) return res.status(400).json({ message: 'Refresh token not found.' });

    await queryDB('DELETE FROM tokens WHERE id = $1', [tokenToDelete.id]);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
