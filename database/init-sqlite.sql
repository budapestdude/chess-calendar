-- SQLite Calendar Database Schema
-- Optimized for chess tournament calendar data

-- Main calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    all_day INTEGER DEFAULT 0,
    
    -- Chess tournament specific fields
    event_type TEXT,
    format TEXT,
    rounds INTEGER,
    url TEXT,
    special TEXT,
    continent TEXT,
    category TEXT,
    live_games TEXT,
    prize_fund TEXT,
    venue TEXT,
    landing TEXT,
    players TEXT,
    
    -- Organization fields
    tags TEXT, -- Comma-separated tags
    color TEXT,
    priority INTEGER DEFAULT 0,
    
    -- Status and visibility
    status TEXT DEFAULT 'confirmed',
    visibility TEXT DEFAULT 'public',
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional data as JSON
    metadata TEXT DEFAULT '{}',
    
    -- Soft delete support
    deleted_at DATETIME
);

-- Indexes for performance
CREATE INDEX idx_events_start_date ON calendar_events(start_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_end_date ON calendar_events(end_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_location ON calendar_events(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_type ON calendar_events(event_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_continent ON calendar_events(continent) WHERE deleted_at IS NULL;