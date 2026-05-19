require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const spreadRoutes = require('./routes/spread');
const { errorMiddleware, getRecentErrors, logInfo } = require('./services/errorLogger');
const { getQueueStatus } = require('./services/exporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Root health check (Railway default)
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Health check with queue + memory status
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    renderQueue: getQueueStatus(),
  });
});

// Admin endpoint to view recent errors (could be protected with auth in future)
app.get('/api/admin/errors', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({ errors: getRecentErrors(limit) });
});

// Spread generation routes
app.use('/api', spreadRoutes);

// Error handler — must be LAST middleware
app.use(errorMiddleware);

app.listen(PORT, () => {
  logInfo(`Yearbook AI server running on port ${PORT}`);
});

module.exports = app;
