const { queryDB,db } = require('./db');
const {
  checkProjectExists,
  checkMilestoneExists,
  checkDependenciesCleared,
} = require('./helpers');

// Helper function for error handling
const handleError = (res, error, message = 'Internal Server Error', statusCode = 500) => {
 
  res.status(statusCode).json({ message, error: error.message });
};

// Helper function for input validation
const validateInput = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
};

// Get all projects
const getAllProjects = async (req, res) => {
  try {
    let query, values;
    if (req.user?.role === 'user') {
      query = `
        SELECT p.*, u.username AS assigned_username 
        FROM projects p
        LEFT JOIN users u ON p.assigned_user_id = u.id
        WHERE p.assigned_user_id = $1
        ORDER BY p.id`;
      values = [req.user.userId];
    } else {
      query = `
        SELECT p.*, u.username AS assigned_username 
        FROM projects p
        LEFT JOIN users u ON p.assigned_user_id = u.id
        ORDER BY 
          CASE WHEN p.assigned_user_id IS NULL THEN 0 ELSE 1 END, 
          p.id`;
      values = [];
    }

    const projects = await queryDB(query, values);
    res.status(200).json(projects);
  } catch (err) {
    handleError(res, err, 'Error fetching projects');
  }
};

const getAllMilestones = async (req, res) => {
  try {
    const query = 'SELECT * FROM milestones';
    const milestones = await queryDB(query);
    res.status(200).json(milestones);
  } catch (err) {
    handleError(res, err, 'Error fetching milestones');
  }
};

const getAllDependencies = async (req, res) => {
  try {
    const query = 'SELECT * FROM dependencies';
    const dependencies = await queryDB(query);
    res.status(200).json(dependencies);
  } catch (err) {
    handleError(res, err, 'Error fetching dependencies');
  }
};

// Add a new project
const addProject = async (req, res) => {
  const { title, description, project_id, distance } = req.body;
  try {
    validateInput(req.body, ['title']);
    const result = await queryDB(
      'INSERT INTO projects (title, description, project_id, distance) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, description, project_id, distance]
    );
    res.status(201).json({ message: 'Project created', projectId: result[0].id });
  } catch (error) {
    handleError(res, error, error.message, 400);
  }
};

const updateProject = async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;
  const updates = req.body;

  try {
    const allowedFields = {
      admin: ['assigned_user_id'],
      editor: ['title', 'description', 'distance', 'project_id'],
    };

    if (!allowedFields[role]) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const filteredUpdates = Object.keys(updates)
      .filter(field => allowedFields[role].includes(field))
      .reduce((obj, key) => ({ ...obj, [key]: updates[key] }), {});

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    const setClause = Object.keys(filteredUpdates)
      .map((field, i) => `${field} = $${i + 1}`)
      .join(', ');

    const query = `UPDATE projects SET ${setClause} WHERE id = $${Object.keys(filteredUpdates).length + 1}`;
    const params = [...Object.values(filteredUpdates), id];

    const result = await queryDB(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete a project by ID
const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await queryDB('DELETE FROM projects WHERE id = $1', [id]);
    if (result.rowCount > 0) {
      res.json({ message: 'Project deleted' });
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error) {
    handleError(res, error);
  }
};

const getProjectDetails = async (req, res) => {
  const { id } = req.params;
  try {
    let projectQuery, projectParams;

    if (req.user?.role === 'user') {
      projectQuery = `
        SELECT p.*, COALESCE(u.username, 'Unassigned') AS username
        FROM projects p
        LEFT JOIN users u ON p.assigned_user_id = u.id
        WHERE p.id = $1 AND p.assigned_user_id = $2
      `;
      projectParams = [id, req.user.userId];
    } else {
      projectQuery = `
        SELECT p.*, COALESCE(u.username, 'Unassigned') AS username
        FROM projects p
        LEFT JOIN users u ON p.assigned_user_id = u.id
        WHERE p.id = $1
      `;
      projectParams = [id];
    }

    const projectResults = await queryDB(projectQuery, projectParams);

    if (projectResults.length === 0) {
      return res.status(200).json({
        project: [],
        milestones: [],
        dependencies: []
      });
    }

    const project = projectResults[0];

    const [projectMilestones, projectDependencies] = await Promise.all([
      queryDB(
        `
        SELECT m.id, m.name, m.sequence, pm.completed, pm.start_time, pm.end_time
        FROM project_milestones pm 
        JOIN milestones m ON pm.milestone_id = m.id 
        WHERE pm.project_id = $1
        ORDER BY m.sequence DESC
        `,
        [id]
      ),
      queryDB(
        `
        SELECT d.id, d.name, pd.cleared 
        FROM project_dependencies pd 
        JOIN dependencies d ON pd.dependency_id = d.id 
        WHERE pd.project_id = $1
        `,
        [id]
      )
    ]);

    res.status(200).json({
      project,
      milestones: projectMilestones,
      dependencies: projectDependencies
    });
  } catch (err) {
    handleError(res, err, 'Error fetching project details', 404);
  }
};

const addMilestoneToProject = async (req, res) => {
  const { id: projectId } = req.params;
  const { milestoneId } = req.body;
  
  try {
    // Validate existence
    await Promise.all([
      checkProjectExists(projectId),
      checkMilestoneExists(milestoneId),
    ]);

    // Fetch latest milestone
    const rows  = await queryDB(
      `SELECT milestone_id, end_time
       FROM project_milestones
       WHERE project_id = $1
       ORDER BY start_time DESC
       LIMIT 1`,
      [projectId]
    );
    
    const lastMilestoneId = rows[0]?.milestone_id ?? 0;

    // Validate milestone sequence
    if (Number(milestoneId) !== Number(lastMilestoneId) + 1) {
      return res.status(409).json({
        error: `Invalid milestone sequence. Expected milestone ${Number(lastMilestoneId) + 1}`,
      });
    }
    
    // Ensure dependencies are cleared
    await checkDependenciesCleared(projectId, milestoneId);
    
    // Mark previous milestone as completed
    if (rows[0]?.end_time === null) {
      await queryDB(
        `UPDATE project_milestones
         SET end_time = CURRENT_TIMESTAMP, completed = 1
         WHERE project_id = $1 AND end_time IS NULL`,
        [projectId]
      );
    }

    const isFinalMilestone = Number(milestoneId) === 6;

    // Add new milestone
    const endTime = isFinalMilestone ? new Date() : null;
    const completed = isFinalMilestone ? 1 : 0;
    
    await queryDB(
      `INSERT INTO project_milestones
       (project_id, milestone_id, start_time, end_time, completed)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
      [projectId, milestoneId, endTime, completed]
    );
    
    

    res.status(201).json({
      message: "Milestone added successfully",
      milestoneId: Number(milestoneId),
      sequencePosition: Number(milestoneId),
    });
  } catch (err) {
    const message = err.message.toLowerCase();

    const errorMap = {
      'not found': 404,
      'must clear': 403,
      'invalid milestone sequence': 409,
    };

    const statusCode = Object.entries(errorMap).find(([key]) => message.includes(key))?.[1] || 400;

    res.status(statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
};


// Add dependency to a project
const addDependencyToProject = async (req, res) => {
  const { id: projectId } = req.params;
  const { dependencyId } = req.body;

  try {
    validateInput(req.body, ['dependencyId']);
    await checkProjectExists(projectId);

    const existingDependencies = await queryDB(
      `SELECT 1 FROM project_dependencies 
       WHERE project_id = $1 AND dependency_id = $2`,
      [projectId, dependencyId]
    );

    if (existingDependencies.length > 0) {
      return res.status(409).json({ message: 'This dependency is already added to the project.' });
    }

    // Insert with cleared = 0 (false)
    await queryDB(
      `INSERT INTO project_dependencies (project_id, dependency_id, cleared) 
       VALUES ($1, $2, $3)`,
      [projectId, dependencyId, 0]
    );

    res.status(201).json({ message: 'Dependency added to project' });
  } catch (err) {
    handleError(res, err, err.message || 'Failed to add dependency', 500);
  }
};


// Query Reports - Time spent on each milestone
const getMilestoneTimeReport = async (req, res) => {
  const { id: projectId } = req.params;
  try {
    const query = `
      SELECT m.name AS milestone,
             EXTRACT(EPOCH FROM (pm.end_time - pm.start_time))/60 AS time_spent
      FROM project_milestones pm
      JOIN milestones m ON m.id = pm.milestone_id
      WHERE pm.project_id = $1 AND pm.completed = $2;
    `;

    // Use 1 for completed = true
    const results = await queryDB(query, [projectId, 1]);

    res.status(200).json(results);
  } catch (err) {
    handleError(res, err, 'Database error');
  }
};


// Mark a dependency as cleared for a project
const clearDependency = async (req, res) => {
  const { id: projectId, dependencyId } = req.params;
  try {
    await checkProjectExists(projectId);

    const dependency = await queryDB(
      `SELECT 1 FROM project_dependencies 
       WHERE project_id = $1 AND dependency_id = $2`,
      [projectId, dependencyId]
    );

    if (dependency.length === 0) {
      return res.status(404).json({ message: 'Dependency not found for this project' });
    }

    // Update cleared to 1 (true)
    await queryDB(
      `UPDATE project_dependencies 
       SET cleared = $3 
       WHERE project_id = $1 AND dependency_id = $2`,
      [projectId, dependencyId, 1]
    );

    res.json({ message: 'Dependency marked as cleared' });
  } catch (err) {
    handleError(res, err, 'Error clearing dependency');
  }
};




module.exports = {
  getAllProjects,
  addProject,
  updateProject,
  deleteProject,
  getProjectDetails,
  addMilestoneToProject,
  addDependencyToProject,
  getMilestoneTimeReport,
  clearDependency,
  getAllDependencies,
  getAllMilestones,
};