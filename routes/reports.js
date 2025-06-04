const express = require("express");
const router = express.Router();
const { queryDB } = require("../utils/db");
router.use(authenticateToken);

router.get("", roleMiddleware(['admin','editor']),async (req, res) => {
  try {
    const [projects, milestoneName] = await Promise.all([
      queryDB(`
        SELECT 
          p.id AS project_id, 
          p.title, 
          p.project_id AS project_code, 
          p.distance, 
          p.assigned_user_id,
          COALESCE(u.username, 'Unassigned') AS username,
          COALESCE(lm.milestone_id, 0) AS milestone_id,
          COALESCE(lm.completed, 0) AS completed
        FROM projects p
        LEFT JOIN (
          SELECT DISTINCT ON (project_id) project_id, milestone_id, completed
          FROM project_milestones
          ORDER BY project_id, id DESC
        ) lm ON p.id = lm.project_id
        LEFT JOIN users u ON p.assigned_user_id = u.id;
      `),
      queryDB("SELECT id, name, sequence FROM milestones ORDER BY sequence ASC;"),
    ]);

    res.status(200).json({ projects, milestoneName });
  } catch (error) {
    console.error("Error fetching reports:", error.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

module.exports = router;