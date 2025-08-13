const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.NODE_ENV === 'production' ? '/app/calendar.db' : 'calendar.db';
const db = new Database(DB_PATH, { readonly: false });

// Enhanced CORS configuration to allow all origins
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false, // Set to false for public API
  optionsSuccessStatus: 200
}));

// Additional CORS headers for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());
app.use(express.static(__dirname));

// Get all events or filter by query parameters
app.get('/api/events', (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      location,
      continent,
      type,
      format,
      search,
      limit = 100, 
      offset = 0
    } = req.query;

    let query = `
      SELECT * FROM calendar_events 
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (start_date) {
      query += ` AND date(end_datetime) >= date(?)`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND date(start_datetime) <= date(?)`;
      params.push(end_date);
    }

    if (location) {
      query += ` AND location LIKE ?`;
      params.push(`%${location}%`);
    }

    if (continent) {
      query += ` AND continent = ?`;
      params.push(continent);
    }

    if (type) {
      query += ` AND event_type = ?`;
      params.push(type);
    }

    if (format) {
      query += ` AND format = ?`;
      params.push(format);
    }

    if (search) {
      query += ` AND (title LIKE ? OR location LIKE ? OR players LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY start_datetime ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const stmt = db.prepare(query);
    const events = stmt.all(...params);
    
    // Get total count
    let countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) as count FROM');
    countQuery = countQuery.replace(/ORDER BY.+$/, '');
    const countStmt = db.prepare(countQuery);
    const countParams = params.slice(0, -2); // Remove limit and offset
    const { count } = countStmt.get(...countParams);

    res.json({
      data: events,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + events.length < count
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get upcoming events
app.get('/api/events/upcoming', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND date(start_datetime) >= date('now')
      ORDER BY start_datetime ASC 
      LIMIT 20
    `);
    const events = stmt.all();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// Get events by continent
app.get('/api/events/continent/:continent', (req, res) => {
  try {
    const { continent } = req.params;
    const stmt = db.prepare(`
      SELECT * FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND continent = ?
      ORDER BY start_datetime ASC
    `);
    const events = stmt.all(continent);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events by continent' });
  }
});

// Get event by ID
app.get('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM calendar_events WHERE id = ? AND deleted_at IS NULL');
    const event = stmt.get(id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Search players
app.get('/api/players/search', (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Player name required' });
    }
    
    const stmt = db.prepare(`
      SELECT * FROM calendar_events 
      WHERE deleted_at IS NULL 
        AND players LIKE ?
      ORDER BY start_datetime ASC
    `);
    const events = stmt.all(`%${name}%`);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search players' });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const totalEvents = db.prepare('SELECT COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL').get();
    const byContinent = db.prepare('SELECT continent, COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL AND continent != "" GROUP BY continent').all();
    const byType = db.prepare('SELECT event_type, COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL AND event_type != "" GROUP BY event_type').all();
    const byFormat = db.prepare('SELECT format, COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL AND format != "" GROUP BY format').all();
    
    res.json({
      total_events: totalEvents.count,
      by_continent: byContinent,
      by_type: byType,
      by_format: byFormat
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Add new event
app.post('/api/events', (req, res) => {
  try {
    // Validate required fields
    if (!req.body.title || !req.body.start_datetime || !req.body.url) {
      return res.status(400).json({ 
        error: 'Missing required fields. Title, start date, and URL are required.' 
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO calendar_events (
        title, location, start_datetime, end_datetime, 
        event_type, format, rounds, url, special, continent, 
        category, live_games, prize_fund, description, venue, 
        landing, players
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      req.body.title,
      req.body.location || '',
      req.body.start_datetime,
      req.body.end_datetime || req.body.start_datetime,
      req.body.event_type || '',
      req.body.format || '',
      req.body.rounds || null,
      req.body.url,
      req.body.special || '',
      req.body.continent || '',
      req.body.category || '',
      req.body.live_games || '',
      req.body.prize_fund || '',
      req.body.description || '',
      req.body.venue || '',
      req.body.landing || '',
      req.body.players || ''
    );
    
    res.status(201).json({ id: info.lastInsertRowid, message: 'Event created successfully' });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
app.put('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const stmt = db.prepare(`
      UPDATE calendar_events 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    const info = stmt.run(...values, id);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (soft delete)
app.delete('/api/events/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Generate ICS/iCal format for calendar apps
app.get('/api/events.ics', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM calendar_events WHERE deleted_at IS NULL ORDER BY start_datetime').all();
    
    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Chess Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Chess Tournaments
X-WR-TIMEZONE:UTC
`;

    events.forEach(event => {
      // Format dates to iCal format (YYYYMMDDTHHMMSSZ)
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };
      
      const start = formatDate(event.start_datetime);
      const end = formatDate(event.end_datetime);
      
      // Escape special characters in text fields
      const escapeText = (text) => {
        if (!text) return '';
        return text.replace(/\\/g, '\\\\')
                  .replace(/;/g, '\\;')
                  .replace(/,/g, '\\,')
                  .replace(/\n/g, '\\n');
      };
      
      ics += `BEGIN:VEVENT
UID:chess-${event.id}@chesscalendar.local
DTSTART:${start}
DTEND:${end}
SUMMARY:${escapeText(event.title)}
LOCATION:${escapeText(event.location)}
URL:${event.url}
DESCRIPTION:${escapeText(event.description || `${event.format || ''} ${event.event_type || ''} chess tournament`)}
CATEGORIES:${event.format || 'Chess'}
STATUS:CONFIRMED
END:VEVENT
`;
    });
    
    ics += 'END:VCALENDAR';
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chess-tournaments.ics"');
    res.send(ics);
  } catch (error) {
    console.error('Error generating ICS:', error);
    res.status(500).json({ error: 'Failed to generate calendar file' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'connected' });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Chess Calendar API',
    version: '1.0.0',
    endpoints: {
      'GET /api/events': 'Get all events with filtering',
      'GET /api/events/upcoming': 'Get upcoming events',
      'GET /api/events/continent/:continent': 'Get events by continent',
      'GET /api/events/:id': 'Get event by ID',
      'GET /api/players/search?name=': 'Search events by player name',
      'GET /api/stats': 'Get statistics',
      'POST /api/events': 'Create new event',
      'PUT /api/events/:id': 'Update event',
      'DELETE /api/events/:id': 'Delete event'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Chess Calendar API running at http://localhost:${PORT}`);
  console.log(`\n📊 Try these endpoints:`);
  console.log(`   http://localhost:${PORT}/api/events`);
  console.log(`   http://localhost:${PORT}/api/events/upcoming`);
  console.log(`   http://localhost:${PORT}/api/stats`);
  console.log(`   http://localhost:${PORT}/api/players/search?name=Carlsen`);
  console.log(`\n🌐 Open the web interface:`);
  console.log(`   http://localhost:${PORT}`);
});