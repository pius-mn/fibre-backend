// routes/user.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleMiddleware');
const { queryDB } = require('../utils/db');

// Helper function for error handling
const handleDatabaseError = (res, error) => {
  console.error('Database error:', error);
  res.status(500).json({ message: 'Internal server error' });
};

// Protect all routes with authentication
router.use(authenticateToken);

// Get user profile data (Read)
router.get('', roleMiddleware(['admin','editor']), async (req, res) => {
  try {
    const users = await queryDB('SELECT * FROM users WHERE role=\'user\''
);
    res.json(users);
   
  } catch (error) {
    handleDatabaseError(res, error);
  }
});

// Update user profile (Update)
router.put('/profile', roleMiddleware(['User']), async (req, res) => {
  const { name, email, password } = req.body; // Password should be hashed before saving in production

  try {
    const [result] = await queryDB(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), password = COALESCE(?, password) WHERE id = ?',
      [name, email, password, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found or no changes made' });
    }
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    handleDatabaseError(res, error);
  }
});

// Get a list of user-specific projects (Read)
router.get('/projects', roleMiddleware(['User']), async (req, res) => {
  try {
    const [projects] = await queryDB(
      'SELECT * FROM projects WHERE assigned_to = ?',
      [req.user.userId]
    );
    res.json(projects);
  } catch (error) {
    handleDatabaseError(res, error);
  }
});

// Delete user account (Delete)
router.delete('/account', roleMiddleware(['User']), async (req, res) => {
  try {
    const [result] = await queryDB('DELETE FROM users WHERE id = ?', [req.user.userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    handleDatabaseError(res, error);
  }
});

module.exports = router;
