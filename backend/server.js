require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Requests wait for schema + seed to finish (relevant on cold starts).
app.use((_req, _res, next) => { db.ready.then(() => next()).catch(next); });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/payments', require('./routes/payments'));

app.get('/health', (_req, res) => res.json({
  status: 'ok', service: 'eduspark-backend',
  database: db.usePg ? 'supabase-postgres' : 'sqlite',
  time: new Date(),
}));
app.get('/', (_req, res) => res.json({ service: 'eduspark-backend', docs: '/health' }));

app.use((err, _req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// On Vercel the app is exported as a serverless handler (see api/index.js).
if (require.main === module) {
  db.ready.then(() => {
    app.listen(PORT, () => {
      console.log('==================================================');
      console.log(` Eduspark API running on port ${PORT}`);
      console.log(` Database: ${db.usePg ? 'Supabase (Postgres)' : 'SQLite (local)'}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log('==================================================');
    });
  });
}

module.exports = app;
