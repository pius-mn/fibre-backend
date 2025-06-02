// models/User.js
const { queryDB } = require('../db');
const bcrypt = require('bcrypt');

const User = {
  create: (username, password, role) => {
    return new Promise((resolve, reject) => {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
      queryDB(sql, [username, hashedPassword, role], (err, results) => {
        if (err) reject(err);
        resolve(results.insertId);
      });
    });
  },

  findByUsername: (username) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE username = ?';
      queryDB(sql, [username], (err, results) => {
        if (err) reject(err);
        resolve(results[0]);
      });
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE id = ?';
      queryDB(sql, [id], (err, results) => {
        if (err) reject(err);
        resolve(results[0]);
      });
    });
  },
};

module.exports = User;
