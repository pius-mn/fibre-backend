const { queryDB } = require('./db');

const checkProjectExists = async (projectId) => {
  const rows = await queryDB(
    'SELECT 1 FROM projects WHERE id = $1 LIMIT 1',
    [projectId]
  );

  if (rows.length === 0) {
    throw new Error('Project not found');
  }

};

const checkMilestoneExists = async (milestoneId) => {
  const rows = await queryDB(
    'SELECT id FROM milestones WHERE id = $1',
    [milestoneId]
  );

  if (rows.length === 0) {
    throw new Error('Milestone not found');
  }
};

const checkMilestoneSequence = async (projectId, milestoneId) => {
  const rows = await queryDB(
    `SELECT milestone_id FROM project_milestones 
     WHERE project_id = $1 AND completed = FALSE 
     ORDER BY milestone_id DESC LIMIT 1`,
    [projectId]
  );

  if (rows.length > 0) {
    const lastMilestoneId = parseInt(rows[0].milestone_id);
    if (parseInt(milestoneId) !== lastMilestoneId + 1) {
      throw new Error(`You must complete milestone ${lastMilestoneId} before adding milestone ${milestoneId}`);
    }
  } else if (parseInt(milestoneId) !== 1) {
    throw new Error('You must start with milestone 1');
  }
};

const checkDependenciesCleared = async (projectId, milestoneId) => {
  if (parseInt(milestoneId) === 3) {
    const rows = await queryDB(
      `SELECT 1 FROM project_dependencies 
       WHERE project_id = $1 AND cleared = $2`,
      [projectId, 0]  // 0 means not cleared
    );

    if (rows.length > 0) {
      throw new Error('You must clear all dependencies before adding milestone 3');
    }
  }
};


module.exports = {
  checkProjectExists,
  checkMilestoneExists,
  checkMilestoneSequence,
  checkDependenciesCleared,
};
