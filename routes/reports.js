const express = require("express");
const router = express.Router();
const { queryDB } = require("../utils/db");
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

router.get("/", async (req, res) => {
  const { userId, role } = req.user;

  const params = [];
  let whereClause = "";

  if (role === "user") {
    params.push(userId);
    whereClause = "WHERE p.assigned_user_id = $1";
  }

  const projectQuery = `
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
      SELECT DISTINCT ON (project_id)
        project_id, milestone_id, completed
      FROM project_milestones
      ORDER BY project_id, id DESC
    ) lm ON p.id = lm.project_id
    LEFT JOIN users u ON p.assigned_user_id = u.id
    ${whereClause}
  `;

  const milestoneQuery = `
    SELECT id, name, sequence
    FROM milestones
    ORDER BY sequence ASC
  `;

  try {
    const [projects, milestoneName] = await Promise.all([
      queryDB(projectQuery, params),
      queryDB(milestoneQuery),
    ]);

    res.status(200).json({ projects, milestoneName });
  } catch (err) {
    console.error("Error fetching data:", err.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

module.exports = router;
