const Database = require('better-sqlite3');
const fs = require('fs');

// Open the database
const db = new Database('calendar.db', { readonly: true });

// Helper function to write JSON file
function writeJSON(filename, data, description) {
  const jsonData = {
    data: data,
    total: data.length,
    description: description,
    generated: new Date().toISOString()
  };
  fs.writeFileSync(`${filename}.json`, JSON.stringify(jsonData, null, 2));
  console.log(`✅ Exported ${data.length} events to ${filename}.json - ${description}`);
}

// 1. ALL EVENTS
const allEvents = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  ORDER BY start_datetime ASC
`).all();
writeJSON('events', allEvents, 'All tournaments');

// 2. SPECIAL/TOP EVENTS
const specialEvents = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE LOWER(special) = 'yes' AND deleted_at IS NULL
  ORDER BY start_datetime ASC
`).all();
writeJSON('special-events', specialEvents, 'Top/Special tournaments only');

// 3. WOMEN'S EVENTS
const womensEvents = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  AND (
    LOWER(title) LIKE '%women%' 
    OR LOWER(title) LIKE '%female%' 
    OR LOWER(title) LIKE '%girls%'
    OR LOWER(category) LIKE '%women%'
  )
  ORDER BY start_datetime ASC
`).all();
writeJSON('womens-events', womensEvents, "Women's tournaments");

// 4. EVENTS BY CONTINENT
const continents = ['Europe', 'Asia', 'Americas', 'Africa', 'Oceania'];
continents.forEach(continent => {
  const events = db.prepare(`
    SELECT * FROM calendar_events 
    WHERE LOWER(continent) = LOWER(?) AND deleted_at IS NULL
    ORDER BY start_datetime ASC
  `).all(continent);
  writeJSON(`${continent.toLowerCase()}-events`, events, `${continent} tournaments`);
});

// 5. EVENTS BY FORMAT
const formats = ['Classical', 'Rapid', 'Blitz', 'Bullet', 'Freestyle'];
formats.forEach(format => {
  const events = db.prepare(`
    SELECT * FROM calendar_events 
    WHERE LOWER(format) = LOWER(?) AND deleted_at IS NULL
    ORDER BY start_datetime ASC
  `).all(format);
  writeJSON(`${format.toLowerCase()}-events`, events, `${format} format tournaments`);
});

// 6. YOUTH EVENTS
const youthEvents = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  AND (
    LOWER(title) LIKE '%youth%' 
    OR LOWER(title) LIKE '%junior%' 
    OR LOWER(title) LIKE '%u20%'
    OR LOWER(title) LIKE '%u18%'
    OR LOWER(title) LIKE '%u16%'
    OR LOWER(title) LIKE '%u14%'
    OR LOWER(title) LIKE '%u12%'
    OR LOWER(title) LIKE '%u10%'
    OR LOWER(title) LIKE '%u8%'
    OR LOWER(category) LIKE '%youth%'
    OR LOWER(category) LIKE '%junior%'
  )
  ORDER BY start_datetime ASC
`).all();
writeJSON('youth-events', youthEvents, 'Youth/Junior tournaments');

// 7. WORLD CHAMPIONSHIPS
const worldChampionships = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  AND (
    LOWER(title) LIKE '%world championship%'
    OR LOWER(title) LIKE '%world cup%'
    OR LOWER(title) LIKE '%candidates%'
    OR LOWER(title) LIKE '%olympiad%'
  )
  ORDER BY start_datetime ASC
`).all();
writeJSON('world-championships', worldChampionships, 'World Championships & Olympiads');

// 8. ONLINE EVENTS
const onlineEvents = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  AND (
    LOWER(location) LIKE '%online%'
    OR LOWER(format) LIKE '%online%'
    OR LOWER(title) LIKE '%online%'
    OR LOWER(title) LIKE '%chess.com%'
    OR LOWER(title) LIKE '%lichess%'
  )
  ORDER BY start_datetime ASC
`).all();
writeJSON('online-events', onlineEvents, 'Online tournaments');

// 9. UPCOMING EVENTS (next 30 days)
const upcomingEvents = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  AND date(start_datetime) >= date('now')
  AND date(start_datetime) <= date('now', '+30 days')
  ORDER BY start_datetime ASC
`).all();
writeJSON('upcoming-events', upcomingEvents, 'Upcoming tournaments (next 30 days)');

// 10. NATIONAL CHAMPIONSHIPS
const nationalChampionships = db.prepare(`
  SELECT * FROM calendar_events 
  WHERE deleted_at IS NULL
  AND (
    LOWER(title) LIKE '%national championship%'
    OR LOWER(title) LIKE '%championship%'
    AND (
      LOWER(title) LIKE '%usa%'
      OR LOWER(title) LIKE '%british%'
      OR LOWER(title) LIKE '%french%'
      OR LOWER(title) LIKE '%german%'
      OR LOWER(title) LIKE '%russian%'
      OR LOWER(title) LIKE '%indian%'
      OR LOWER(title) LIKE '%chinese%'
    )
  )
  ORDER BY start_datetime ASC
`).all();
writeJSON('national-championships', nationalChampionships, 'National Championships');

// Print summary
console.log('\n📊 Summary of exported categories:');
console.log('================================');
console.log(`Total events: ${allEvents.length}`);
console.log(`Special/Top events: ${specialEvents.length}`);
console.log(`Women's events: ${womensEvents.length}`);
console.log(`Youth events: ${youthEvents.length}`);
console.log(`World Championships: ${worldChampionships.length}`);
console.log(`Online events: ${onlineEvents.length}`);
console.log(`National Championships: ${nationalChampionships.length}`);
console.log(`Upcoming (30 days): ${upcomingEvents.length}`);
console.log('\nBy Continent:');
continents.forEach(continent => {
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM calendar_events 
    WHERE LOWER(continent) = LOWER(?) AND deleted_at IS NULL
  `).get(continent).count;
  console.log(`  ${continent}: ${count}`);
});
console.log('\nBy Format:');
formats.forEach(format => {
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM calendar_events 
    WHERE LOWER(format) = LOWER(?) AND deleted_at IS NULL
  `).get(format).count;
  console.log(`  ${format}: ${count}`);
});

db.close();