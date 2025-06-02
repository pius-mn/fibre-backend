const express = require('express');
const cors = require('cors');
const milestoneRoutes = require('./routes/milestone');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Test Route
app.get('/api/test', (req, res) => {
  res.status(200).json({ message: 'API is working correctly!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', milestoneRoutes);
app.use('/api/user', userRoutes);


// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
