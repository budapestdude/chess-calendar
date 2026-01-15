const fs = require('fs');
const csv = require('csv-parser');
const Database = require('better-sqlite3');
const path = require('path');

// Create/open SQLite database
const db = new Database('calendar-2026.db');

// Initialize database schema
const initSQL = fs.readFileSync('./database/init-sqlite.sql', 'utf8');
db.exec(initSQL);

// Prepare insert statement
const insertStmt = db.prepare(`
  INSERT INTO calendar_events (
    title, location, start_datetime, end_datetime, 
    event_type, format, rounds, url, special, continent, 
    category, live_games, prize_fund, description, venue, 
    landing, players
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`);

function parseDate(dateStr, year = 2025) {
  if (!dateStr) return null;
  
  // Handle dates like "January 2" by adding the year
  const months = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };
  
  // Match patterns like "January 2" or "January 10"
  const match = dateStr.match(/^(\w+)\s+(\d+)$/);
  if (match) {
    const month = months[match[1]];
    const day = match[2].padStart(2, '0');
    if (month) {
      return `${year}-${month}-${day} 00:00:00`;
    }
  }
  
  // Try parsing as-is
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }
  } catch (e) {}
  
  return null;
}

async function importChessCalendar() {
  const events = [];
  const csvFile = 'Chess Calendar - Sheet1 (1).csv';
  
  console.log('Reading CSV file...');
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        events.push(row);
      })
      .on('end', () => {
        console.log(`\nParsed ${events.length} events from CSV`);
        
        let imported = 0;
        let failed = 0;
        const errors = [];
        
        // Use a transaction for better performance
        const insertMany = db.transaction((events) => {
          for (const event of events) {
            try {
              const title = event.Name || event.name || 'Untitled Event';
              const location = event.Location || '';
              
              // Parse dates - assuming 2025 for events without year
              let startDate = parseDate(event['Start date'] || event.start_date);
              let endDate = parseDate(event['End date'] || event.end_date);
              
              if (!startDate) {
                console.warn(`⚠️  Skipping "${title}" - no valid start date`);
                failed++;
                continue;
              }
              
              // If no end date, use start date
              if (!endDate) {
                endDate = startDate;
              }
              
              // Insert the event
              insertStmt.run(
                title,
                location,
                startDate,
                endDate,
                event.Type || '',
                event.Format || '',
                parseInt(event.Rounds) || null,
                event.URL || '',
                event.Special || '',
                event.Continent || '',
                event.Category || '',
                event['Live games'] || '',
                event['Prize Fund'] || '',
                event.Description || '',
                event.Venue || '',
                event.Landing || '',
                event.Players || ''
              );
              
              imported++;
              
              if (imported % 100 === 0) {
                console.log(`  Imported ${imported} events...`);
              }
            } catch (error) {
              errors.push({ event: event.Name, error: error.message });
              failed++;
            }
          }
        });
        
        // Execute the transaction
        try {
          insertMany(events);
          
          console.log('\n' + '='.repeat(50));
          console.log('🎉 Import Complete!');
          console.log('='.repeat(50));
          console.log(`✅ Successfully imported: ${imported} events`);
          if (failed > 0) {
            console.log(`❌ Failed to import: ${failed} events`);
            if (errors.length > 0 && errors.length <= 5) {
              console.log('\nErrors:');
              errors.forEach(e => console.log(`  - ${e.event}: ${e.error}`));
            }
          }
          console.log(`📊 Total processed: ${events.length} rows`);
          console.log('\n📁 Database saved as: calendar-2026.db');
          
          // Show sample of imported data
          console.log('\n📋 Sample of imported events:');
          const samples = db.prepare('SELECT title, location, start_datetime FROM calendar_events LIMIT 5').all();
          samples.forEach(s => {
            console.log(`  • ${s.title} - ${s.location} (${s.start_datetime})`);
          });
          
          resolve({ imported, failed });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Check if required modules are installed
try {
  require.resolve('csv-parser');
  require.resolve('better-sqlite3');
} catch (e) {
  console.log('Installing required dependencies...');
  require('child_process').execSync('npm install csv-parser better-sqlite3', { stdio: 'inherit' });
}

// Run the import
importChessCalendar()
  .then(() => {
    console.log('\n✨ You can now query your calendar database!');
    db.close();
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Import failed:', error);
    db.close();
    process.exit(1);
  });