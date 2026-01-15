#!/usr/bin/env node

const Database = require('better-sqlite3');
const db = new Database('calendar-2026.db', { readonly: true });

const command = process.argv[2];
const arg = process.argv[3];

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

switch(command) {
  case 'stats':
    const total = db.prepare('SELECT COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL').get();
    const byContinent = db.prepare("SELECT continent, COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL AND continent != '' GROUP BY continent ORDER BY count DESC").all();
    const byFormat = db.prepare("SELECT format, COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL AND format != '' GROUP BY format ORDER BY count DESC").all();
    
    console.log('\n📊 Calendar Statistics');
    console.log('=' .repeat(50));
    console.log(`Total Events: ${total.count}`);
    
    console.log('\nBy Continent:');
    byContinent.forEach(c => console.log(`  ${c.continent}: ${c.count}`));
    
    console.log('\nBy Format:');
    byFormat.forEach(f => console.log(`  ${f.format}: ${f.count}`));
    break;

  case 'upcoming':
    const limit = arg || 10;
    const upcoming = db.prepare(`
      SELECT title, location, start_datetime, format, continent 
      FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND date(start_datetime) >= date('now')
      ORDER BY start_datetime ASC 
      LIMIT ?
    `).all(limit);
    
    console.log(`\n📅 Next ${limit} Upcoming Events`);
    console.log('=' .repeat(70));
    upcoming.forEach(e => {
      console.log(`\n• ${e.title}`);
      console.log(`  📍 ${e.location || 'Location TBA'}`);
      console.log(`  📅 ${formatDate(e.start_datetime)}`);
      if (e.format) console.log(`  🎯 Format: ${e.format}`);
    });
    break;

  case 'search':
    if (!arg) {
      console.log('Usage: node query-calendar.js search <term>');
      process.exit(1);
    }
    const results = db.prepare(`
      SELECT title, location, start_datetime, players 
      FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND (title LIKE ? OR location LIKE ? OR players LIKE ?)
      ORDER BY start_datetime ASC
      LIMIT 20
    `).all(`%${arg}%`, `%${arg}%`, `%${arg}%`);
    
    console.log(`\n🔍 Search Results for "${arg}"`);
    console.log('=' .repeat(70));
    if (results.length === 0) {
      console.log('No events found');
    } else {
      results.forEach(e => {
        console.log(`\n• ${e.title}`);
        console.log(`  📍 ${e.location || 'Location TBA'}`);
        console.log(`  📅 ${formatDate(e.start_datetime)}`);
        if (e.players && e.players.includes(arg)) {
          console.log(`  👥 Players: ${e.players.substring(0, 100)}...`);
        }
      });
    }
    break;

  case 'player':
    if (!arg) {
      console.log('Usage: node query-calendar.js player <name>');
      process.exit(1);
    }
    const playerEvents = db.prepare(`
      SELECT title, location, start_datetime, format 
      FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND players LIKE ?
      ORDER BY start_datetime ASC
    `).all(`%${arg}%`);
    
    console.log(`\n♟️  Events featuring "${arg}"`);
    console.log('=' .repeat(70));
    if (playerEvents.length === 0) {
      console.log('No events found for this player');
    } else {
      console.log(`Found ${playerEvents.length} events:\n`);
      playerEvents.forEach(e => {
        console.log(`• ${e.title}`);
        console.log(`  📍 ${e.location || 'Location TBA'}`);
        console.log(`  📅 ${formatDate(e.start_datetime)}`);
        if (e.format) console.log(`  🎯 ${e.format}`);
        console.log();
      });
    }
    break;

  case 'continent':
    if (!arg) {
      console.log('Usage: node query-calendar.js continent <name>');
      console.log('Available: Europe, North America, Asia, South America, Africa, Oceania');
      process.exit(1);
    }
    const continentEvents = db.prepare(`
      SELECT title, location, start_datetime, format 
      FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND continent = ?
      ORDER BY start_datetime ASC
      LIMIT 20
    `).all(arg);
    
    console.log(`\n🌍 Events in ${arg}`);
    console.log('=' .repeat(70));
    if (continentEvents.length === 0) {
      console.log('No events found for this continent');
    } else {
      continentEvents.forEach(e => {
        console.log(`\n• ${e.title}`);
        console.log(`  📍 ${e.location}`);
        console.log(`  📅 ${formatDate(e.start_datetime)}`);
      });
    }
    break;

  default:
    console.log('\n🗓️  Chess Calendar Query Tool');
    console.log('=' .repeat(50));
    console.log('\nUsage:');
    console.log('  node query-calendar.js stats              - Show statistics');
    console.log('  node query-calendar.js upcoming [count]   - Show upcoming events');
    console.log('  node query-calendar.js search <term>      - Search events');
    console.log('  node query-calendar.js player <name>      - Find player events');
    console.log('  node query-calendar.js continent <name>   - Events by continent');
    console.log('\nExamples:');
    console.log('  node query-calendar.js upcoming 5');
    console.log('  node query-calendar.js search "Tata Steel"');
    console.log('  node query-calendar.js player Carlsen');
    console.log('  node query-calendar.js continent Europe');
}

db.close();