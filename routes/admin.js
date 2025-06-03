const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleMiddleware');
const { queryDB } = require('../utils/db');

router.use(authenticateToken); // Protect all admin routes


router.get('/projects', roleMiddleware(['admin']), async (req, res) => {
    try {
      const result = await queryDB(`
        SELECT 
          p.*, 
          COALESCE(STRING_AGG(u.username, ', '), '') AS assigned_users
        FROM projects p
        LEFT JOIN project_users pu ON p.id = pu.project_id
        LEFT JOIN users u ON pu.user_id = u.id
        GROUP BY p.id
        ORDER BY p.id DESC
      `);
      res.json(result);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  



  

// Assign a project to a user (Admin only)
router.put('/assign/:projectId', roleMiddleware(['admin']), async (req, res) => {
    const { userId } = req.body;
    const { projectId } = req.params;
  
    if (!userId) {
      return res.status(400).json({ message: 'User ID must be provided' });
    }
  
    try {
      const existingAssignment = await queryDB(
        'SELECT * FROM project_users WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );
  
      if (existingAssignment.length > 0) {
        return res.status(400).json({ message: 'User is already assigned to this project' });
      }
  
      await queryDB(
        'INSERT INTO project_users (project_id, user_id) VALUES ($1, $2)',
        [projectId, userId]
      );
  
      res.json({ message: 'User assigned to project successfully' });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
 
  

module.exports = router;
