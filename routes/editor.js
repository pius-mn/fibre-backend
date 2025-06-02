const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleMiddleware');
const { queryDB } = require('../utils/db'); 

router.use(authenticateToken, roleMiddleware(['editor']));

const handleDatabaseError = (res, error, message = 'Internal server error') => {
  console.error(message, error);
  res.status(500).json({ message });
};

router.get('/projects', async (req, res) => {
  try {
    const { rows } = await queryDB(
      'SELECT * FROM projects WHERE editor_id = $1',
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    
    handleDatabaseError(res, error);
  }
});

router.post('/projects', async (req, res) => {
  const { title, description, distance, project_id } = req.body;

  if (!title || !project_id || !distance) {
    return res.status(400).json({ message: 'Title, project_id, and distance are required' });
  }
  console.log("error")
  try {
    const { rows } = await queryDB(
      `INSERT INTO projects (title, description, distance, project_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [title, description, distance, project_id]
    );

    res.status(201).json({
      id: rows[0].id,
      title,
      description,
      distance,
      project_id
    });
  } catch (error) {
    console.log("error",error)
    handleDatabaseError(res, error);
  }
});


router.put('/projects/:id', async (req, res) => {
  const { title, description, status } = req.body;
  const { id } = req.params;

  if (!title && !description && !status) {
    return res.status(400).json({ message: 'At least one field is required to update' });
  }

  try {
    const { rowCount } = await queryDB(
      `UPDATE projects
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status)
       WHERE id = $4 AND editor_id = $5`,
      [title, description, status, id, req.user.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'Project not found or not authorized to update' });
    }

    const { rows } = await queryDB(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    res.json(rows[0]);
  } catch (error) {
    handleDatabaseError(res, error);
  }
});

router.delete('/projects/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await queryDB(
      'DELETE FROM projects WHERE id = $1 AND editor_id = $2',
      [id, req.user.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'Project not found or not authorized to delete' });
    }

    res.json({ message: 'Project deleted successfully', id });
  } catch (error) {
    handleDatabaseError(res, error);
  }
});

module.exports = router;
