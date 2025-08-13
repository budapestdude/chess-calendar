-- Calendar Database Schema
-- Optimized for 1400+ entries with multi-platform access

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main calendar events table
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Recurrence fields
    recurrence_rule VARCHAR(500), -- RFC 5545 RRULE format
    recurrence_id UUID, -- Reference to parent recurring event
    
    -- Organization fields
    category VARCHAR(100),
    tags TEXT[], -- Array of tags for flexible categorization
    color VARCHAR(7), -- Hex color code
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 5),
    
    -- Status and visibility
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'confidential')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Additional data as JSON for flexibility
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_datetime >= start_datetime)
);

-- Indexes for performance
CREATE INDEX idx_events_start_date ON calendar_events(start_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_end_date ON calendar_events(end_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_category ON calendar_events(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_status ON calendar_events(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_tags ON calendar_events USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_metadata ON calendar_events USING GIN(metadata) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_recurrence ON calendar_events(recurrence_id) WHERE deleted_at IS NULL;

-- Full text search index
ALTER TABLE calendar_events ADD COLUMN search_vector tsvector;
CREATE INDEX idx_events_search ON calendar_events USING GIN(search_vector);

-- Update search vector trigger
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_search_vector
    BEFORE INSERT OR UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Attachments table for files/links
CREATE TABLE event_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('file', 'link', 'image')),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    size_bytes INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE INDEX idx_attachments_event ON event_attachments(event_id);

-- Reminders/Notifications table
CREATE TABLE event_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    type VARCHAR(20) DEFAULT 'popup' CHECK (type IN ('email', 'popup', 'push', 'sms')),
    minutes_before INTEGER NOT NULL CHECK (minutes_before >= 0),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_event ON event_reminders(event_id);

-- Attendees/Participants table (if needed)
CREATE TABLE event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'attendee' CHECK (role IN ('organizer', 'attendee', 'optional')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, email)
);

CREATE INDEX idx_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_attendees_email ON event_attendees(email);

-- Sync tracking table for multi-device sync
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(255),
    sync_data JSONB
);

CREATE INDEX idx_sync_timestamp ON sync_log(timestamp);
CREATE INDEX idx_sync_device ON sync_log(device_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- View for upcoming events (performance optimization)
CREATE VIEW upcoming_events AS
SELECT * FROM calendar_events
WHERE deleted_at IS NULL
  AND end_datetime >= CURRENT_TIMESTAMP
  AND status != 'cancelled'
ORDER BY start_datetime;

-- View for past events
CREATE VIEW past_events AS
SELECT * FROM calendar_events
WHERE deleted_at IS NULL
  AND end_datetime < CURRENT_TIMESTAMP
ORDER BY start_datetime DESC;