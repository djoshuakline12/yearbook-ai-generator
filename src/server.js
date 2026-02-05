require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const spreadRoutes = require('./routes/spread');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Spread generation routes
app.use('/api', spreadRoutes);

app.listen(PORT, () => {
  console.log(`Yearbook AI server running on port ${PORT}`);
});

module.exports = app;
