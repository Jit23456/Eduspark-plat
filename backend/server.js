require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/coach', require('./routes/coach'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/events', require('./routes/events'));

// System actor: manual trigger for demos ("run nightly jobs now")
const systemJobs = require('./jobs/system');
const { authenticate, requireAdmin } = require('./middleware/auth');
app.post('/api/system/run-jobs', authenticate, requireAdmin, (req, res) => {
  res.json(systemJobs.runAll({ force: !!req.body.force_billing }));
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'fvca-backend', time: new Date() }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((err, _req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  systemJobs.start();
  console.log(`==================================================`);
  console.log(` FVCA Platform API running on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(`==================================================`);
});
