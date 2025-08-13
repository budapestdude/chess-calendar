const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/events', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      category, 
      search, 
      limit = 100, 
      offset = 0,
      sort = 'start_datetime',
      order = 'ASC'
    } = req.query;

    let query = `
      SELECT * FROM calendar_events 
      WHERE deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 0;

    if (start_date) {
      params.push(start_date);
      query += ` AND end_datetime >= $${++paramCount}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND start_datetime <= $${++paramCount}`;
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${++paramCount}`;
    }

    if (search) {
      params.push(search);
      query += ` AND search_vector @@ plainto_tsquery('english', $${++paramCount})`;
    }

    const allowedSortFields = ['start_datetime', 'end_datetime', 'created_at', 'updated_at', 'title'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'start_datetime';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortField} ${sortOrder}`;
    
    params.push(limit);
    query += ` LIMIT $${++paramCount}`;
    
    params.push(offset);
    query += ` OFFSET $${++paramCount}`;

    const result = await pool.query(query, params);
    
    const countQuery = `
      SELECT COUNT(*) FROM calendar_events 
      WHERE deleted_at IS NULL
      ${start_date ? `AND end_datetime >= '${start_date}'` : ''}
      ${end_date ? `AND start_datetime <= '${end_date}'` : ''}
      ${category ? `AND category = '${category}'` : ''}
      ${search ? `AND search_vector @@ plainto_tsquery('english', '${search}')` : ''}
    `;
    
    const countResult = await pool.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      start_datetime,
      end_datetime,
      all_day,
      timezone,
      recurrence_rule,
      category,
      tags,
      color,
      priority,
      status,
      visibility,
      metadata
    } = req.body;

    if (!title || !start_datetime || !end_datetime) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, start_datetime, end_datetime' 
      });
    }

    const result = await pool.query(
      `INSERT INTO calendar_events 
       (title, description, location, start_datetime, end_datetime, all_day, 
        timezone, recurrence_rule, category, tags, color, priority, 
        status, visibility, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [title, description, location, start_datetime, end_datetime, 
       all_day || false, timezone || 'UTC', recurrence_rule, category, 
       tags || [], color, priority || 0, status || 'confirmed', 
       visibility || 'public', metadata || {}]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existingEvent = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    if (existingEvent.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const allowedFields = [
      'title', 'description', 'location', 'start_datetime', 'end_datetime',
      'all_day', 'timezone', 'recurrence_rule', 'category', 'tags',
      'color', 'priority', 'status', 'visibility', 'metadata'
    ];

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        updateFields.push(`${field} = $${paramCount}`);
        updateValues.push(updates[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateValues.push(id);
    const query = `
      UPDATE calendar_events 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hard_delete } = req.query;

    if (hard_delete === 'true') {
      await pool.query('DELETE FROM calendar_events WHERE id = $1', [id]);
    } else {
      await pool.query(
        'UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

app.post('/api/events/batch', async (req, res) => {
  const client = await pool.connect();
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    await client.query('BEGIN');
    const results = [];

    for (const event of events) {
      const result = await client.query(
        `INSERT INTO calendar_events 
         (title, description, location, start_datetime, end_datetime, all_day, 
          timezone, recurrence_rule, category, tags, color, priority, 
          status, visibility, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [event.title, event.description, event.location, event.start_datetime, 
         event.end_datetime, event.all_day || false, event.timezone || 'UTC', 
         event.recurrence_rule, event.category, event.tags || [], event.color, 
         event.priority || 0, event.status || 'confirmed', 
         event.visibility || 'public', event.metadata || {}]
      );
      results.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ 
      message: `Successfully created ${results.length} events`,
      ids: results.map(r => r.id)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in batch insert:', error);
    res.status(500).json({ error: 'Failed to insert events' });
  } finally {
    client.release();
  }
});

app.get('/api/events/recurring/:parent_id', async (req, res) => {
  try {
    const { parent_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM calendar_events WHERE recurrence_id = $1 AND deleted_at IS NULL ORDER BY start_datetime',
      [parent_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recurring events:', error);
    res.status(500).json({ error: 'Failed to fetch recurring events' });
  }
});

app.get('/api/sync/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const { since } = req.query;
    
    let query = 'SELECT * FROM sync_log WHERE device_id != $1';
    const params = [device_id];
    
    if (since) {
      query += ' AND timestamp > $2';
      params.push(since);
    }
    
    query += ' ORDER BY timestamp ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sync data:', error);
    res.status(500).json({ error: 'Failed to fetch sync data' });
  }
});

app.listen(PORT, () => {
  console.log(`Calendar API server running on port ${PORT}`);
});