const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false
}));

// Serve static files
app.use(express.static(__dirname));

// Serve special events JSON with explicit CORS headers
app.get('/special-events.json', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'special-events.json'));
});

// Serve all events JSON with explicit CORS headers
app.get('/events.json', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'events.json'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>Chess Calendar API</h1>
    <p>Available endpoints:</p>
    <ul>
      <li><a href="/special-events.json">Special Events (63 tournaments)</a></li>
      <li><a href="/events.json">All Events (1459 tournaments)</a></li>
      <li><a href="/calendar.html">Calendar HTML</a></li>
      <li><a href="/health">Health Check</a></li>
    </ul>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Special events: http://localhost:${PORT}/special-events.json`);
});