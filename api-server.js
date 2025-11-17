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
const BACKUP_DIR = process.env.NODE_ENV === 'production' ? '/app/backups' : './backups';
const db = new Database(DB_PATH, { readonly: false });

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Backup management functions
async function createBackup(reason = 'manual') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `calendar_${reason}_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    
    // Use SQLite backup API for safe copying
    db.backup(backupPath);
    
    // Create metadata file (wait a bit for backup to complete)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const metadataPath = path.join(BACKUP_DIR, `${backupName}.meta.json`);
    const metadata = {
      filename: backupName,
      timestamp: new Date().toISOString(),
      reason: reason,
      originalSize: fs.statSync(DB_PATH).size,
      backupSize: fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0,
      eventCount: db.prepare('SELECT COUNT(*) as count FROM calendar_events WHERE deleted_at IS NULL').get().count
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Backup created: ${backupName} (${reason})`);
    return { success: true, backupName, metadata };
  } catch (error) {
    console.error('Error creating backup:', error);
    return { success: false, error: error.message };
  }
}

function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = [];
    
    files.filter(file => file.endsWith('.db')).forEach(dbFile => {
      const metaFile = `${dbFile}.meta.json`;
      const dbPath = path.join(BACKUP_DIR, dbFile);
      const metaPath = path.join(BACKUP_DIR, metaFile);
      
      let metadata = {
        filename: dbFile,
        timestamp: fs.statSync(dbPath).mtime.toISOString(),
        reason: 'unknown',
        backupSize: fs.statSync(dbPath).size,
        eventCount: 'unknown'
      };
      
      // Load metadata if available
      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          metadata = { ...metadata, ...metaData };
        } catch (e) {
          console.warn('Failed to parse metadata for', dbFile);
        }
      }
      
      backups.push(metadata);
    });
    
    // Sort by timestamp (newest first)
    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

async function restoreFromBackup(backupFilename) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' };
    }
    
    // Create a backup of current state before restoring
    const preRestoreBackup = await createBackup('pre-restore');
    if (!preRestoreBackup.success) {
      return { success: false, error: 'Failed to create pre-restore backup' };
    }
    
    // Close current database connection
    db.close();
    
    // Copy backup file over current database
    fs.copyFileSync(backupPath, DB_PATH);
    
    // Reconnect to database (this is tricky - would need app restart in production)
    console.log(`Database restored from backup: ${backupFilename}`);
    
    return { 
      success: true, 
      message: `Database restored from ${backupFilename}`,
      preRestoreBackup: preRestoreBackup.backupName
    };
  } catch (error) {
    console.error('Error restoring backup:', error);
    return { success: false, error: error.message };
  }
}

function deleteBackup(backupFilename) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    const metaPath = path.join(BACKUP_DIR, `${backupFilename}.meta.json`);
    
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    
    return { success: true, message: `Backup ${backupFilename} deleted` };
  } catch (error) {
    console.error('Error deleting backup:', error);
    return { success: false, error: error.message };
  }
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files EXCEPT index.html (we'll handle that with routing)
app.use(express.static(__dirname, {
  index: false // Don't automatically serve index.html
}));

// Simple authentication (you should use proper auth in production)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-secret-admin-token-2025';

function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '')?.trim();
  
  // Debug logging
  console.log('Auth check:', {
    authHeader: authHeader ? authHeader.substring(0, 20) + '...' : 'NO HEADER',
    extractedToken: token ? token.substring(0, 10) + '...' : 'NO TOKEN',
    expectedToken: ADMIN_TOKEN.substring(0, 10) + '...',
    match: token === ADMIN_TOKEN
  });
  
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET all events
app.get('/api/events', (req, res) => {
  try {
    const { special, continent, format, search, limit = 5000, offset = 0 } = req.query;
    
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

// GET upcoming events
app.get('/api/events/upcoming', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      SELECT * FROM calendar_events
      WHERE deleted_at IS NULL
      AND start_datetime >= ?
      ORDER BY start_datetime ASC
      LIMIT ?
    `);

    const events = stmt.all(now, parseInt(limit));

    res.json({
      success: true,
      data: events,
      returned: events.length
    });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch upcoming events' });
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

    // Enhanced validation with detailed error messages
    const validationErrors = [];

    if (!title || title.trim() === '') {
      validationErrors.push('title is required and cannot be empty');
    }

    if (!url || url.trim() === '') {
      validationErrors.push('url is required and cannot be empty');
    } else {
      // Basic URL validation
      try {
        new URL(url);
      } catch (e) {
        validationErrors.push('url must be a valid URL format (e.g., https://example.com)');
      }
    }

    if (validationErrors.length > 0) {
      console.error('[CREATE EVENT] Validation failed:', {
        title: title || '(missing)',
        url: url || '(missing)',
        errors: validationErrors
      });
      return res.status(400).json({
        error: 'Validation failed: ' + validationErrors.join(', '),
        details: validationErrors,
        received: { title, url, start_datetime, end_datetime }
      });
    }

    // Use current date if start_datetime not provided
    const eventStartTime = start_datetime || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const eventEndTime = end_datetime || eventStartTime;

    // Log the event being created (helpful for debugging)
    console.log('[CREATE EVENT] Inserting:', {
      title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
      url,
      start_datetime: eventStartTime,
      end_datetime: eventEndTime,
      location: location || '(none)',
      format: format || '(none)',
      continent: continent || '(none)'
    });

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
      title, location || '', eventStartTime,
      eventEndTime, event_type || '',
      format || '', rounds || null, url, special || '',
      continent || '', category || '', live_games || '',
      prize_fund || '', description || '', venue || '',
      landing || '', players || ''
    );

    console.log(`[CREATE EVENT] ✓ Success: ID ${info.lastInsertRowid} - ${title}`);

    res.status(201).json({
      success: true,
      id: info.lastInsertRowid,
      message: 'Event created successfully'
    });

    // Trigger regeneration of JSON files
    regenerateJsonFiles();

  } catch (error) {
    console.error('[CREATE EVENT] ✗ Database error:', {
      error: error.message,
      code: error.code,
      title: req.body.title || '(missing)',
      url: req.body.url || '(missing)',
      stack: error.stack
    });

    // Provide more helpful error messages
    let errorMessage = 'Failed to create event';
    if (error.message.includes('UNIQUE constraint')) {
      errorMessage = 'Event already exists (duplicate detected)';
    } else if (error.message.includes('NOT NULL constraint')) {
      errorMessage = 'Missing required database field';
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message,
      code: error.code
    });
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

// Make admin the homepage - redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Serve admin page (now accessible via /admin or after login)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Legacy route for old index page (if needed)
app.get('/old-index', (req, res) => {
  res.sendFile(path.join(__dirname, 'index-old.html'));
});

app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'manage.html'));
});

// Find duplicate events
app.get('/api/duplicates', checkAuth, (req, res) => {
  try {
    // Find events with same title, location, and start_datetime
    const duplicatesQuery = `
      SELECT 
        title, 
        location, 
        start_datetime,
        GROUP_CONCAT(id) as ids,
        COUNT(*) as count
      FROM calendar_events 
      WHERE deleted_at IS NULL
      GROUP BY LOWER(title), LOWER(location), start_datetime
      HAVING COUNT(*) > 1
      ORDER BY count DESC, title
    `;
    
    const duplicateGroups = db.prepare(duplicatesQuery).all();
    
    // Get full details for each duplicate group
    const result = duplicateGroups.map(group => {
      const ids = group.ids.split(',').map(id => parseInt(id));
      const eventsQuery = `
        SELECT id, title, location, start_datetime, url, created_at
        FROM calendar_events 
        WHERE id IN (${ids.map(() => '?').join(',')})
        ORDER BY created_at ASC
      `;
      const events = db.prepare(eventsQuery).all(...ids);
      
      return {
        title: group.title,
        location: group.location,
        start_datetime: group.start_datetime,
        count: group.count,
        events: events
      };
    });
    
    res.json({ 
      success: true,
      data: result,
      total: result.length,
      totalDuplicates: result.reduce((sum, group) => sum + group.count - 1, 0)
    });
    
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// Delete duplicates (keep the oldest one)
app.post('/api/duplicates/delete', checkAuth, async (req, res) => {
  try {
    const { mode = 'auto' } = req.body; // 'auto' keeps oldest, 'manual' requires specific IDs
    
    if (mode === 'auto') {
      // Create backup before deletion
      const backup = await createBackup('duplicate-deletion');
      if (!backup.success) {
        return res.status(500).json({ error: 'Failed to create backup before deletion' });
      }
      // Find all duplicate groups and delete newer ones, keeping the oldest
      const duplicatesQuery = `
        SELECT 
          title, 
          location, 
          start_datetime,
          GROUP_CONCAT(id) as ids
        FROM calendar_events 
        WHERE deleted_at IS NULL
        GROUP BY LOWER(title), LOWER(location), start_datetime
        HAVING COUNT(*) > 1
      `;
      
      const duplicateGroups = db.prepare(duplicatesQuery).all();
      let deletedCount = 0;
      
      const deleteStmt = db.prepare('UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
      
      duplicateGroups.forEach(group => {
        const ids = group.ids.split(',').map(id => parseInt(id));
        
        // Get events sorted by creation date (oldest first)
        const eventsQuery = `
          SELECT id, created_at 
          FROM calendar_events 
          WHERE id IN (${ids.map(() => '?').join(',')})
          ORDER BY created_at ASC
        `;
        const events = db.prepare(eventsQuery).all(...ids);
        
        // Delete all but the first (oldest) one
        for (let i = 1; i < events.length; i++) {
          deleteStmt.run(events[i].id);
          deletedCount++;
        }
      });
      
      res.json({
        success: true,
        message: `Deleted ${deletedCount} duplicate events`,
        deletedCount,
        backup: backup.backupName
      });
      
      // Trigger regeneration of JSON files
      regenerateJsonFiles();
      
    } else {
      return res.status(400).json({ error: 'Only auto mode is currently supported' });
    }
    
  } catch (error) {
    console.error('Error deleting duplicates:', error);
    res.status(500).json({ error: 'Failed to delete duplicates' });
  }
});

// Backup management endpoints

// List all backups
app.get('/api/backups', checkAuth, (req, res) => {
  try {
    const backups = listBackups();
    res.json({ 
      success: true, 
      data: backups,
      total: backups.length
    });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Create manual backup
app.post('/api/backups', checkAuth, async (req, res) => {
  try {
    const { reason = 'manual' } = req.body;
    const backup = await createBackup(reason);
    
    if (backup.success) {
      res.json({
        success: true,
        message: `Backup created successfully`,
        backup: backup.backupName,
        metadata: backup.metadata
      });
    } else {
      res.status(500).json({ error: backup.error });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Restore from backup
app.post('/api/backups/:filename/restore', checkAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await restoreFromBackup(filename);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        preRestoreBackup: result.preRestoreBackup,
        warning: 'Server restart required to complete restoration. Please restart the API server.'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Delete backup
app.delete('/api/backups/:filename', checkAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const result = deleteBackup(filename);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Download backup file
app.get('/api/backups/:filename/download', checkAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(BACKUP_DIR, filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    res.download(backupPath, filename, (err) => {
      if (err) {
        console.error('Error downloading backup:', err);
        res.status(500).json({ error: 'Failed to download backup' });
      }
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// Export database as CSV
app.get('/api/export/csv', checkAuth, (req, res) => {
  try {
    // Query all non-deleted events
    const events = db.prepare(`
      SELECT 
        id,
        title,
        description,
        location,
        start_datetime,
        end_datetime,
        event_type,
        format,
        rounds,
        url,
        special,
        continent,
        category,
        live_games,
        prize_fund,
        venue,
        landing,
        players,
        tags,
        color,
        priority,
        status,
        visibility,
        created_at,
        updated_at
      FROM calendar_events 
      WHERE deleted_at IS NULL 
      ORDER BY start_datetime ASC
    `).all();
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'No events found to export' });
    }
    
    // Generate CSV content
    const headers = [
      'ID', 'Title', 'Description', 'Location', 'Start Date', 'End Date',
      'Event Type', 'Format', 'Rounds', 'URL', 'Special', 'Continent',
      'Category', 'Live Games', 'Prize Fund', 'Venue', 'Landing', 'Players',
      'Tags', 'Color', 'Priority', 'Status', 'Visibility', 'Created At', 'Updated At'
    ];
    
    // Helper function to escape CSV values
    function escapeCSV(value) {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    
    events.forEach(event => {
      const row = [
        event.id,
        event.title,
        event.description,
        event.location,
        event.start_datetime,
        event.end_datetime,
        event.event_type,
        event.format,
        event.rounds,
        event.url,
        event.special,
        event.continent,
        event.category,
        event.live_games,
        event.prize_fund,
        event.venue,
        event.landing,
        event.players,
        event.tags,
        event.color,
        event.priority,
        event.status,
        event.visibility,
        event.created_at,
        event.updated_at
      ].map(escapeCSV);
      
      csvContent += row.join(',') + '\n';
    });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `calendar_events_${timestamp}.csv`;
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
    
    // Add BOM for Excel compatibility
    res.write('\uFEFF');
    res.write(csvContent);
    res.end();
    
    console.log(`CSV export: ${events.length} events exported as ${filename}`);
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
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