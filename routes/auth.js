const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { queryDB } = require('../utils/db'); // Postgres version of queryDB
const router = express.Router();

// Registration
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  try {
    const existingUser = await queryDB('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const inserted = await queryDB(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, role]
    );

    res.status(201).json({ message: 'User registered successfully.', userId: inserted[0].id });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const rows = await queryDB('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const tokenResult = await queryDB(
      'INSERT INTO tokens (user_id, refresh_token, expires_at) VALUES ($1, $2, $3) RETURNING id',
      [user.id, refreshToken, expiresAt]
    );

    res.json({ accessToken, refreshToken, role: user.role, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login.' });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Please provide a refresh token.' });
  }

  try {
    const tokenRecord = await queryDB('SELECT * FROM tokens WHERE refresh_token = $1', [refreshToken]);

    if (!tokenRecord.length || new Date(tokenRecord[0].expires_at) < new Date()) {
      return res.sendStatus(403); // Forbidden
    }

    const user = await queryDB('SELECT * FROM users WHERE id = $1', [tokenRecord[0].user_id]);

    const accessToken = jwt.sign(
      { userId: user[0].id, username: user[0].username, role: user[0].role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Please provide a refresh token.' });
  }

  try {
    const result = await queryDB('DELETE FROM tokens WHERE refresh_token = $1', [refreshToken]);
    if (result.rowCount === 0) {
      throw new Error('Failed to delete token from database');
    }

    res.sendStatus(204); // No Content
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
