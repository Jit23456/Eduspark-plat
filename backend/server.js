require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // Allow all origins for local dev environment
  credentials: true
}));

// Body parser
app.use(express.json());

// Main API routes
app.use('/api', routes);

// Simple Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Serve DB static assets or playground if needed (optional)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(` Eduspark Backend Server running on port ${PORT} `);
  console.log(` Health check: http://localhost:${PORT}/health  `);
  console.log(`================================================`);
});
