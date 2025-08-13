const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://calendar_user:your_secure_password_here@localhost:5432/calendar_db'
});

async function importFromCSV(filePath) {
  const events = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        events.push(row);
      })
      .on('end', async () => {
        console.log(`Parsed ${events.length} events from CSV`);
        
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          let imported = 0;
          let failed = 0;
          
          for (const event of events) {
            try {
              const title = event.title || event.Title || event.name || event.Name || 'Untitled Event';
              const description = event.description || event.Description || '';
              const location = event.location || event.Location || '';
              
              let startDate = parseDate(event.start_date || event.start || event.Start);
              let endDate = parseDate(event.end_date || event.end || event.End);
              
              if (!startDate) {
                console.warn(`Skipping event "${title}" - no valid date`);
                failed++;
                continue;
              }
              
              if (!endDate || endDate < startDate) {
                endDate = new Date(startDate);
                endDate.setHours(startDate.getHours() + 1);
              }
              
              const category = event.category || event.Category || 'General';
              const tags = parseTags(event.tags || event.Tags || '');
              const allDay = event.all_day === 'true' || event.all_day === 'TRUE';
              
              await client.query(
                `INSERT INTO calendar_events 
                 (title, description, location, start_datetime, end_datetime, 
                  all_day, category, tags)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [title, description, location, startDate, endDate, 
                 allDay, category, tags]
              );
              
              imported++;
            } catch (error) {
              console.error(`Failed to import event: ${error.message}`);
              failed++;
            }
          }
          
          await client.query('COMMIT');
          
          console.log(`\\nImport complete:`);
          console.log(`  Imported: ${imported}`);
          console.log(`  Failed: ${failed}`);
          
          resolve({ imported, failed });
        } catch (error) {
          await client.query('ROLLBACK');
          reject(error);
        } finally {
          client.release();
          await pool.end();
        }
      })
      .on('error', reject);
  });
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  
  return null;
}

function parseTags(tagStr) {
  if (!tagStr) return [];
  return tagStr.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
}

const csvFile = process.argv[2];
if (!csvFile) {
  console.error('Usage: node import-from-csv.js <path-to-csv-file>');
  process.exit(1);
}

importFromCSV(csvFile)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
  });