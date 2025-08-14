const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// List of available JSON endpoints
const availableEndpoints = [
  'events.json - All tournaments',
  'special-events.json - Top/Special tournaments',
  'womens-events.json - Women\'s tournaments',
  'youth-events.json - Youth/Junior tournaments',
  'world-championships.json - World Championships',
  'online-events.json - Online tournaments',
  'national-championships.json - National Championships',
  'upcoming-events.json - Next 30 days',
  'europe-events.json - Europe tournaments',
  'asia-events.json - Asia tournaments',
  'americas-events.json - Americas tournaments',
  'africa-events.json - Africa tournaments',
  'oceania-events.json - Oceania tournaments',
  'classical-events.json - Classical format',
  'rapid-events.json - Rapid format',
  'blitz-events.json - Blitz format',
  'bullet-events.json - Bullet format',
  'freestyle-events.json - Freestyle format'
];

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`Request: ${req.method} ${req.url}`);

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const html = `
      <h1>Chess Calendar API</h1>
      <h2>Available Endpoints:</h2>
      <ul>
        ${availableEndpoints.map(endpoint => 
          `<li><a href="/${endpoint.split(' - ')[0]}">${endpoint}</a></li>`
        ).join('')}
      </ul>
      <p><a href="/calendar.html">View Calendar</a></p>
    `;
    res.end(html);
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date() }));
  } else if (req.url.endsWith('.json')) {
    // Serve any JSON file
    const filename = req.url.substring(1); // Remove leading /
    const filePath = path.join(__dirname, filename);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found', file: filename }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      }
    });
  } else if (req.url === '/calendar.html') {
    // Serve the calendar HTML
    const filePath = path.join(__dirname, 'calendar.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Calendar page not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});