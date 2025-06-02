const { queryDB } = require('../utils/db');

const checkProjectOwnership = async (req, res, next) => {
  const projectId = req.params.id;
  const userId = req.user?.userId;

  

  if (req.user?.role === 'user') {
    const project = await queryDB(
      'SELECT id FROM projects WHERE id = $1 AND assigned_user_id = $2',
      [projectId, userId]
    );

    if (project.length === 0) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
  }

  next();
};

module.exports = checkProjectOwnership;
