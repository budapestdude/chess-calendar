const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const DB_PATH = process.env.NODE_ENV === 'production' ? '/app/calendar.db' : 'calendar.db';
const db = new Database(DB_PATH, { readonly: false });

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

// Simple authentication (you should use proper auth in production)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-secret-admin-token-2025';

function checkAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET all events
app.get('/api/events', (req, res) => {
  try {
    const { special, continent, format, search, limit = 1000, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM calendar_events WHERE deleted_at IS NULL';
    const params = [];
    
    if (special === 'yes') {
      query += ' AND LOWER(special) = ?';
      params.push('yes');
    }
    
    if (continent) {
      query += ' AND LOWER(continent) = LOWER(?)';
      params.push(continent);
    }
    
    if (format) {
      query += ' AND LOWER(format) = LOWER(?)';
      params.push(format);
    }
    
    if (search) {
      query += ' AND (title LIKE ? OR location LIKE ? OR players LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Get total count before applying limit
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countStmt = db.prepare(countQuery);
    const countResult = countStmt.get(...params);
    const totalCount = countResult.count;
    
    query += ' ORDER BY start_datetime ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = db.prepare(query);
    const events = stmt.all(...params);
    
    res.json({
      success: true,
      data: events,
      total: totalCount,
      returned: events.length
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET single event
app.get('/api/events/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM calendar_events WHERE id = ? AND deleted_at IS NULL');
    const event = stmt.get(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// CREATE new event
app.post('/api/events', checkAuth, (req, res) => {
  try {
    const {
      title, location, start_datetime, end_datetime,
      event_type, format, rounds, url, special,
      continent, category, live_games, prize_fund,
      description, venue, landing, players
    } = req.body;
    
    if (!title || !start_datetime || !url) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, start_datetime, url' 
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO calendar_events (
        title, location, start_datetime, end_datetime,
        event_type, format, rounds, url, special,
        continent, category, live_games, prize_fund,
        description, venue, landing, players,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const info = stmt.run(
      title, location || '', start_datetime,
      end_datetime || start_datetime, event_type || '',
      format || '', rounds || null, url, special || '',
      continent || '', category || '', live_games || '',
      prize_fund || '', description || '', venue || '',
      landing || '', players || ''
    );
    
    res.status(201).json({ 
      success: true,
      id: info.lastInsertRowid,
      message: 'Event created successfully'
    });
    
    // Trigger regeneration of JSON files
    regenerateJsonFiles();
    
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// UPDATE event
app.put('/api/events/:id', checkAuth, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.created_at;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Build update query dynamically
    const fields = Object.keys(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    
    const stmt = db.prepare(`
      UPDATE calendar_events 
      SET ${setClause}, updated_at = datetime('now')
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    const info = stmt.run(...values, id);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Event updated successfully'
    });
    
    // Trigger regeneration of JSON files
    regenerateJsonFiles();
    
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE event (soft delete)
app.delete('/api/events/:id', checkAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    
    let stmt;
    if (permanent === 'true') {
      // Permanent delete
      stmt = db.prepare('DELETE FROM calendar_events WHERE id = ?');
    } else {
      // Soft delete
      stmt = db.prepare("UPDATE calendar_events SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL");
    }
    
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ 
      success: true,
      message: permanent === 'true' ? 'Event permanently deleted' : 'Event deleted successfully'
    });
    
    // Trigger regeneration of JSON files
    regenerateJsonFiles();
    
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// RESTORE deleted event
app.post('/api/events/:id/restore', checkAuth, (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare("UPDATE calendar_events SET deleted_at = NULL WHERE id = ?");
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Event restored successfully'
    });
    
    // Trigger regeneration of JSON files
    regenerateJsonFiles();
    
  } catch (error) {
    console.error('Error restoring event:', error);
    res.status(500).json({ error: 'Failed to restore event' });
  }
});

// Function to regenerate JSON files after database changes
function regenerateJsonFiles() {
  exec('node export-all-categories.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Error regenerating JSON files:', error);
    } else {
      console.log('JSON files regenerated successfully');
    }
  });
}

// Serve static JSON files
app.get('/:filename.json', (req, res) => {
  const filename = req.params.filename + '.json';
  const filePath = path.join(__dirname, filename);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.header('Content-Type', 'application/json');
      res.send(data);
    }
  });
});

// Serve HTML pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'manage.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin`);
  console.log(`Management dashboard: http://localhost:${PORT}/manage`);
});