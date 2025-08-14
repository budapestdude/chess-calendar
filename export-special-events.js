const Database = require('better-sqlite3');
const fs = require('fs');

// Open the database
const db = new Database('calendar.db', { readonly: true });

// Get only special events
const stmt = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE LOWER(special) = 'yes' AND deleted_at IS NULL
  ORDER BY start_datetime ASC
`);

const specialEvents = stmt.all();

// Also get all events for reference
const allStmt = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  ORDER BY start_datetime ASC
`);

const allEvents = allStmt.all();

// Write special events to separate file
const specialJsonData = {
  data: specialEvents,
  total: specialEvents.length,
  generated: new Date().toISOString()
};

fs.writeFileSync('special-events.json', JSON.stringify(specialJsonData, null, 2));

// Update main events.json with all events (for backward compatibility)
const allJsonData = {
  data: allEvents,
  total: allEvents.length,
  generated: new Date().toISOString()
};

fs.writeFileSync('events.json', JSON.stringify(allJsonData, null, 2));

console.log(`✅ Exported ${specialEvents.length} special events to special-events.json`);
console.log(`✅ Exported ${allEvents.length} total events to events.json`);

// List some of the special events
console.log('\nSpecial events include:');
specialEvents.slice(0, 10).forEach(event => {
  console.log(`  - ${event.title}`);
});

db.close();