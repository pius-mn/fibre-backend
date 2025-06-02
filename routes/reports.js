const express = require("express");
const router = express.Router();
const { queryDB } = require("../utils/db"); // Make sure queryDB uses pg or pg-promise

router.get("", async (req, res) => {
  const { type, value, projectId, duration } = req.query;

  try {
    let query = "";
    let params = [];

    switch (type) {
      case "projects":
        query = `
          SELECT p.id, p.title, u.username, p.description, p.distance, p.project_id,
                 COALESCE((
                   SELECT m.name 
                   FROM project_milestones pm
                   JOIN milestones m ON pm.milestone_id = m.id
                   WHERE pm.project_id = p.id AND pm.completed = 1
                   ORDER BY pm.end_time DESC LIMIT 1
                 ), 'Not Started') AS status
          FROM projects p
          JOIN users u ON p.assigned_user_id = u.id
          ORDER BY p.id DESC`;
        break;

      case "single_project":
        query = `
          SELECT p.id, p.title, u.username, p.description, p.distance, p.project_id,
                 COALESCE((
                   SELECT m.name 
                   FROM project_milestones pm
                   JOIN milestones m ON pm.milestone_id = m.id
                   WHERE pm.project_id = p.id AND pm.completed = 1
                   ORDER BY pm.end_time DESC LIMIT 1
                 ), 'Not Started') AS status
          FROM projects p
          JOIN users u ON p.assigned_user_id = u.id
          WHERE p.id = $1`;
        params = [projectId];
        break;

      case "projects_by_user":
        query = `
          SELECT p.id, p.title, u.username, p.description, p.distance, p.project_id,
                 COALESCE((
                   SELECT m.name 
                   FROM project_milestones pm
                   JOIN milestones m ON pm.milestone_id = m.id
                   WHERE pm.project_id = p.id AND pm.completed = 1
                   ORDER BY pm.end_time DESC LIMIT 1
                 ), 'Not Started') AS status
          FROM projects p
          JOIN users u ON p.assigned_user_id = u.id
          WHERE p.assigned_user_id = $1`;
        params = [value];
        break;

      case "projects_by_milestone":
        query = `
          SELECT 
            p.id, p.title, u.username, p.description, p.distance, p.project_id,
            COALESCE(m.name, 'Not Started') AS status
          FROM projects p
          JOIN users u ON p.assigned_user_id = u.id
          LEFT JOIN (
            SELECT 
              pm1.project_id,
              pm1.milestone_id
            FROM project_milestones pm1
            WHERE pm1.milestone_id = (
              SELECT MAX(pm2.milestone_id)
              FROM project_milestones pm2
              WHERE pm2.project_id = pm1.project_id
            )
          ) AS latest_milestone ON p.id = latest_milestone.project_id
          LEFT JOIN milestones m ON latest_milestone.milestone_id = m.id
          WHERE 
            (latest_milestone.milestone_id = $1 AND $1::int > 0) OR
            (latest_milestone.milestone_id IS NULL AND $1::int = 0)`;
        params = [value];
        break;

      case "project_duration_by_milestone":
        const durationInt = parseInt(duration);
        if (isNaN(durationInt)) {
          return res.status(400).json({ error: "Invalid duration parameter" });
        }

        query = `
          WITH CurrentMilestones AS (
            SELECT 
              pm.project_id,
              pm.milestone_id,
              pm.start_time,
              ROW_NUMBER() OVER (
                PARTITION BY pm.project_id 
                ORDER BY pm.start_time DESC
              ) AS milestone_order
            FROM project_milestones pm
            WHERE pm.end_time IS NULL
          )
          SELECT 
            p.id,
            p.title,
            u.username,
            m.name AS milestone,
            DATE_PART('day', NOW() - cm.start_time) AS duration_days
          FROM projects p
          JOIN users u ON p.assigned_user_id = u.id
          JOIN CurrentMilestones cm ON p.id = cm.project_id 
            AND cm.milestone_order = 1
          JOIN milestones m ON cm.milestone_id = m.id
          WHERE cm.milestone_id = $1
            AND DATE_PART('day', NOW() - cm.start_time) >= $2`;
        params = [value, durationInt];
        break;

      default:
        return res.status(400).json({ error: "Invalid report type" });
    }

    const results = await queryDB(query, params);
    res.json(results);
  } catch (error) {
    console.error("Report fetch error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

module.exports = router;
