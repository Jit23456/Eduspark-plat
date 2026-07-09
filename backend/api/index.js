// Vercel serverless entry: rewrites route every request here and preserve the
// original URL, so the Express app's /api-prefixed routes match unchanged.
module.exports = require('../server');
