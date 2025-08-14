const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files from root directory
app.use(express.static('.'));

// Explicit routes for JSON files
app.get('/special-events.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'special-events.json'));
});

app.get('/events.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'events.json'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Root route
app.get('/', (req, res) => {
  res.send('Chess Calendar API - Working!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});