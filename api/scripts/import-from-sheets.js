const { google } = require('googleapis');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://calendar_user:your_secure_password_here@localhost:5432/calendar_db'
});

async function importFromGoogleSheets() {
  try {
    console.log('Starting Google Sheets import...');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || 'YOUR_SPREADSHEET_ID_HERE';
    const range = 'Sheet1!A:Z';
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in sheet');
      return;
    }

    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const dataRows = rows.slice(1);

    console.log(`Found ${dataRows.length} events to import`);

    const client = await pool.connect();
    await client.query('BEGIN');

    let imported = 0;
    let failed = 0;

    for (const row of dataRows) {
      try {
        const eventData = {};
        headers.forEach((header, index) => {
          eventData[header] = row[index] || null;
        });

        const title = eventData.title || eventData.event_name || eventData.name || 'Untitled Event';
        const description = eventData.description || eventData.details || '';
        const location = eventData.location || eventData.venue || '';
        
        let startDate = parseDate(eventData.start_date || eventData.date || eventData.start);
        let endDate = parseDate(eventData.end_date || eventData.end || eventData.start_date || eventData.date);
        
        if (!startDate) {
          console.warn(`Skipping event "${title}" - no valid date found`);
          failed++;
          continue;
        }

        if (!endDate || endDate < startDate) {
          endDate = new Date(startDate);
          endDate.setHours(startDate.getHours() + 1);
        }

        const category = eventData.category || eventData.type || 'General';
        const tags = parseTags(eventData.tags || eventData.labels || '');
        const priority = parseInt(eventData.priority) || 0;
        const color = eventData.color || generateColorFromCategory(category);
        
        const allDay = 
          eventData.all_day === 'TRUE' || 
          eventData.all_day === 'true' || 
          eventData.all_day === '1' ||
          (!eventData.start_time && !eventData.end_time);

        const metadata = {};
        headers.forEach(header => {
          if (!['title', 'description', 'location', 'start_date', 'end_date', 
               'category', 'tags', 'priority', 'color', 'all_day'].includes(header)) {
            if (eventData[header]) {
              metadata[header] = eventData[header];
            }
          }
        });

        await client.query(
          `INSERT INTO calendar_events 
           (title, description, location, start_datetime, end_datetime, all_day,
            category, tags, color, priority, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [title, description, location, startDate, endDate, allDay,
           category, tags, color, priority, metadata]
        );

        imported++;
        
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} events...`);
        }
      } catch (error) {
        console.error(`Failed to import event: ${error.message}`);
        failed++;
      }
    }

    await client.query('COMMIT');
    client.release();

    console.log('\\n=== Import Complete ===');
    console.log(`Successfully imported: ${imported} events`);
    console.log(`Failed to import: ${failed} events`);
    console.log(`Total processed: ${dataRows.length} rows`);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  dateStr = dateStr.toString().trim();
  
  const formats = [
    /^\\d{4}-\\d{2}-\\d{2}$/,
    /^\\d{2}\\/\\d{2}\\/\\d{4}$/,
    /^\\d{1,2}\\/\\d{1,2}\\/\\d{4}$/,
    /^\\d{4}\\/\\d{2}\\/\\d{2}$/,
  ];
  
  try {
    if (dateStr.match(/^\\d+$/)) {
      const excelDate = parseInt(dateStr);
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) return date;
    }
    
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  
  return null;
}

function parseTags(tagStr) {
  if (!tagStr) return [];
  
  return tagStr
    .split(/[,;|]/)
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

function generateColorFromCategory(category) {
  const colors = {
    'meeting': '#4285F4',
    'personal': '#34A853',
    'work': '#EA4335',
    'holiday': '#FBBC04',
    'birthday': '#9C27B0',
    'appointment': '#00ACC1',
    'task': '#FF5722',
    'reminder': '#795548',
    'general': '#607D8B'
  };
  
  const lowerCategory = category.toLowerCase();
  return colors[lowerCategory] || colors['general'];
}

importFromGoogleSheets();