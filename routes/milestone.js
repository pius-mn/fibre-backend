const express = require('express');
const router = express.Router();
const {
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
} = require('../utils/projectController');
const authenticateToken = require('../middleware/auth');
const checkProjectOwnership = require('../middleware/ownerShip')
const roleMiddleware = require('../middleware/roleMiddleware')
router.use(authenticateToken);

// Project routes
router.get('/projects', getAllProjects);
router.post('/projects',roleMiddleware(['editor']), addProject);
router.put('/projects/:id',roleMiddleware(['editor','admin']), updateProject);
router.delete('/projects/:id',roleMiddleware(['editor']), deleteProject);
router.get('/projects/:id', getProjectDetails);

// Milestone routes
router.post('/projects/:id/milestones',roleMiddleware(['user']),checkProjectOwnership, addMilestoneToProject);
router.get('/dependencies', getAllDependencies);

// Dependency routes
router.post('/projects/:id/dependencies',roleMiddleware(['user']),checkProjectOwnership, addDependencyToProject);
router.patch('/projects/:id/dependencies/:dependencyId',roleMiddleware(['user']),checkProjectOwnership, clearDependency);
router.get('/milestones', getAllMilestones);

// Report routes
router.get('/projects/:id/reports', getMilestoneTimeReport);

module.exports = router;