const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleMiddleware');
const { queryDB } = require('../utils/db');
const bcrypt = require('bcrypt');

// Protect all routes with authentication
router.use(authenticateToken);

// Delete user account (Admin only)
router.delete('/:id', roleMiddleware(['admin']), async (req, res) => {
  const userId = req.params.id;
  const currentUser = req.user;

  // Prevent self-deletion
  if (String(currentUser.userId) === String(userId)) {
    return res.status(403).json({ message: 'Cannot delete your own account' });
  }

  try {
    const [deleted] = await queryDB(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );

    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put('/:userId/profile', roleMiddleware(['admin', 'user', 'editor']), async (req, res) => {
  const { userId } = req.params;
  const currentUser = req.user;
  const { username, password } = req.body;

  // Authorization check
  if (String(currentUser.userId) !== String(userId)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Validate inputs
  if (username && username.trim().length < 3) {
    return res.status(400).json({ message: 'Username must be 3+ characters' });
  }
  
  if (password && password.length < 6) {
    return res.status(400).json({ message: 'Password must be 6+ characters' });
  }

  try {
    // Check username uniqueness if updating
    if (username) {
      const [existing] = await queryDB(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.trim(), userId]
      );
      
      if (existing) {
        return res.status(409).json({ message: 'Username already taken' });
      }
    }

    // Prepare update data
    const updateData = {};
    if (username) updateData.username = username.trim();
    if (password) updateData.password = await bcrypt.hash(password, 10);
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    // Build dynamic query
    const setClauses = [];
    const values = [];
    Object.entries(updateData).forEach(([key, value], index) => {
      setClauses.push(`${key} = $${index + 1}`);
      values.push(value);
    });
    values.push(userId);

    const [updatedUser] = await queryDB(
      `UPDATE users 
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, username, role`,
      values
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Username already taken' });
    }
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user role (Admin only)
router.put('/:id/role', roleMiddleware(['admin']), async (req, res) => {
  const userId = req.params.id;
  const currentUser = req.user;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ message: 'Role is required' });
  }

  // Prevent self-role change
  if (String(currentUser.userId) === String(userId)) {
    return res.status(403).json({ message: 'Cannot change your own role' });
  }

  try {
    const [user] = await queryDB(
      `UPDATE users SET role = $1
       WHERE id = $2
       RETURNING id, username, role`,
      [role, userId]
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      message: 'Role updated successfully',
      user 
    });
  } catch (err) {
    console.error('Update role error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user profile
router.get('/:userId', roleMiddleware(['admin', 'user', 'editor']), async (req, res) => {
  const targetUserId = req.params.userId;
  const currentUser = req.user;

  // Authorization check
  if (String(currentUser.userId) !== String(targetUserId)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const [user] = await queryDB(
      `SELECT id, username, role
       FROM users
       WHERE id = $1`,
      [targetUserId]
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Fetch user error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (Admin/Editor only)
router.get('', roleMiddleware(['admin','editor']), async (req, res) => {
  try {
   

    // Get users with pagination
    const users = await queryDB(
      `SELECT id, username, role 
       FROM users`
    );


    res.json(users);
  } catch (err) {
    console.error('Get users error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;