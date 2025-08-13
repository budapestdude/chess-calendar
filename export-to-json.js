const Database = require('better-sqlite3');
const fs = require('fs');

// Open the database
const db = new Database('calendar.db', { readonly: true });

// Get all events
const stmt = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  ORDER BY start_datetime ASC
`);

const events = stmt.all();

// Write to JSON file
const jsonData = {
  data: events,
  total: events.length,
  generated: new Date().toISOString()
};

fs.writeFileSync('events.json', JSON.stringify(jsonData, null, 2));

console.log(`✅ Exported ${events.length} events to events.json`);

db.close();