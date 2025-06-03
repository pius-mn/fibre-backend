// routes/user.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleMiddleware');
const { queryDB } = require('../utils/db');
const bcrypt = require('bcrypt');

// Helper function for error handling
const handleDatabaseError = (res, error) => {
  console.error('Database error:', error);
  res.status(500).json({ message: 'Internal server error' });
};

// Protect all routes with authentication
router.use(authenticateToken);

// Get user profile data (Read)
// router.get('', roleMiddleware(['admin','editor']), async (req, res) => {
//   try {
//     const users = await queryDB('SELECT * FROM users WHERE role=\'user\''
// );
//     res.json(users);

//   } catch (error) {
//     handleDatabaseError(res, error);
//   }
// });

// // Update user profile (Update)
// router.put('/profile', roleMiddleware(['User']), async (req, res) => {
//   const { name, email, password } = req.body; // Password should be hashed before saving in production

//   try {
//     const [result] = await queryDB(
//       'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), password = COALESCE(?, password) WHERE id = ?',
//       [name, email, password, req.user.userId]
//     );

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: 'User not found or no changes made' });
//     }
//     res.json({ message: 'Profile updated successfully' });
//   } catch (error) {
//     handleDatabaseError(res, error);
//   }
// });

// // Get a list of user-specific projects (Read)
// router.get('/projects', roleMiddleware(['User']), async (req, res) => {
//   try {
//     const [projects] = await queryDB(
//       'SELECT * FROM projects WHERE assigned_to = ?',
//       [req.user.userId]
//     );
//     res.json(projects);
//   } catch (error) {
//     handleDatabaseError(res, error);
//   }
// });

// // Delete user account (Delete)
router.delete('/:id', roleMiddleware(['admin']), async (req, res) => {
  const userId = req.params.id;

  try {
    const query = `DELETE FROM users WHERE id = $1 RETURNING id`;
    const [deleted] = await queryDB(query, [userId]);

    if (!deleted) return res.status(404).json({ message: 'User not found.' });

    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
});


router.put('/:userId/profile', roleMiddleware(['admin', 'user', 'editor']), async (req, res) => {
  const { userId } = req.params;
  const updater = req.user;
  const updateFields = req.body;

  const isSelf = String(updater.userId) === String(userId);


  if (!isSelf) {
    return res.status(403).json({ message: 'You can only update your own profile.' });
  }

  try {
    const allowedKeys = ['username', 'password'];
    const fieldsToUpdate = {};

    for (const key of allowedKeys) {
      if (updateFields[key] !== undefined && updateFields[key] !== '') {
        fieldsToUpdate[key] = updateFields[key];
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }

    // Hash password if provided
    if (fieldsToUpdate.password) {
      fieldsToUpdate.password = await bcrypt.hash(fieldsToUpdate.password, 10);
    }

    const setString = Object.keys(fieldsToUpdate)
      .map((key, idx) => `${key} = $${idx + 1}`)
      .join(', ');
    const values = Object.values(fieldsToUpdate);
    values.push(userId); // WHERE id = $n

    const query = `
      UPDATE users SET ${setString}
      WHERE id = $${values.length}
      RETURNING id, username, role
    `;
    const [user] = await queryDB(query, values);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ message: 'Profile updated successfully.', user });
  } catch (err) {
    console.error('Error updating profile:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
});


router.put('/:id/role', roleMiddleware(['admin']), async (req, res) => {
  const userId = req.params.id;
  const updater = req.user;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ message: 'Role is required.' });
  }

  // Prevent admin from changing their own role
  if (updater.id === userId) {
    return res.status(403).json({ message: 'Admins cannot change their own role.' });
  }

  try {
    const query = `
      UPDATE users SET role = $1
      WHERE id = $2
      RETURNING id, username, role
    `;
    const [user] = await queryDB(query, [role, userId]);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ message: 'Role updated successfully.', user });
  } catch (err) {
    console.error('Error updating role:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
});



router.get('/:userId', roleMiddleware(['admin', 'user', 'editor']), async (req, res) => {
  const targetUserId = req.params.userId;
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const isSelf = String(currentUser.userId) === String(targetUserId);
  
  if (!isSelf) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const query = `
      SELECT id, username, role
      FROM users
      WHERE id = $1
    `;
    const result = await queryDB(query, [targetUserId]);
    const user = result[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('', roleMiddleware(['admin','editor']), async (req, res) => {
  try {
    const result = await queryDB(`SELECT * FROM users`);
    res.json(result);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
module.exports = router;
