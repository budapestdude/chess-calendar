# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chess Calendar Database system for chess tournaments. The project uses SQLite as primary storage with Express.js REST API, providing web interface and calendar subscription capabilities. Alternative PostgreSQL implementation available for scalable deployments.

**2026 Version**: The database has been migrated to `calendar-2026.db` (fresh database for 2026 events). The legacy `calendar.db` file contains 1457+ tournaments from 2025 and earlier as a historical archive.

## Architecture

### Active Implementation
- **Database**: SQLite (`calendar-2026.db`) via `better-sqlite3` - fresh database for 2026 events
- **Archive Database**: SQLite (`calendar.db`) - contains 1457+ tournaments from 2025 and earlier (read-only archive)
- **Main API**: `api-server.js` - Express server with admin authentication (default in package.json)
- **Alternative API**: `calendar-api.js` - Express server without authentication
- **Web Interface**: Static files served from root directory
- **Admin Panel**: `admin.html` - authenticated management interface at `/admin`
- **Landing Pages**: `landing-server.js` and related files for location-based services
- **Chrome Extension**: In `Calendar Chrome Extension/` folder for detecting chess tournaments on web pages
- **Static Servers**: `simple-server.js` for basic file serving

### Key Features
- Full-text search across all tournament fields
- ICS/iCal calendar subscription endpoint
- Continent and format-based filtering
- Player name search
- Soft delete support (`deleted_at` timestamps)
- CSV import/export capabilities
- Database backup/restore functionality
- Admin authentication using Bearer tokens
- JSON export for different categories (continents, formats, special events)

## Commands

```bash
# Start main server with admin auth (default)
npm start
# or
node api-server.js

# Alternative server without auth
node calendar-api.js

# Development server (same as npm start)
npm run dev

# Landing page server with location services
npm run landing
# or
node landing-server.js

# Simple static file server
npm run simple
# or
node simple-server.js

# Import CSV data
node import-chess-calendar.js "filename.csv"

# Query database CLI
node query-calendar.js

# Export special events and JSON files
npm run build-data
# or
node export-special-events.js

# Export all categories to JSON
node export-all-categories.js

# PostgreSQL stack (Docker)
docker-compose up -d

# No automated tests available
npm test  # Will show "no test specified" error
```

## Key API Endpoints

### Public Endpoints (no auth required)
- `GET /api/events` - List events with filters
- `GET /api/events/upcoming` - Upcoming tournaments
- `GET /api/events/continent/:continent` - Filter by continent
- `GET /api/events/format/:format` - Filter by format (rapid/blitz/classical)
- `GET /api/players/search?name=` - Search by player
- `GET /api/stats` - Database statistics
- `GET /api/events.ics` - Calendar subscription feed
- `GET /health` - Health check

### Admin Endpoints (requires Bearer token)
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Soft delete event
- `POST /api/events/:id/restore` - Restore soft-deleted event
- `GET /api/duplicates` - Find duplicate events
- `POST /api/duplicates/delete` - Delete duplicate events
- `GET /api/backups` - List available backups
- `POST /api/backups` - Create new backup
- `POST /api/backups/:filename/restore` - Restore from backup
- `DELETE /api/backups/:filename` - Delete backup file

## Database Schema

The `calendar_events` table contains the following key fields:

### Core Event Fields
- `id` - Primary key (auto-increment)
- `title` - Event name (required)
- `description` - Event description
- `location` - Event location
- `start_datetime` - Start date/time (required)
- `end_datetime` - End date/time (required)
- `all_day` - Boolean for all-day events
- `deleted_at` - Soft delete timestamp

### Chess-Specific Fields
- `format` - Tournament format (rapid/blitz/classical/bullet/freestyle)
- `rounds` - Number of rounds
- `continent` - Geographic region (Europe/Americas/Asia/Africa/Oceania)
- `players` - Participant names (searchable)
- `prize_fund` - Prize pool information
- `special` - Special tournament flag (yes/no)
- `event_type` - Tournament classification
- `category` - Event category
- `venue` - Specific venue information

### External Links
- `url` - Tournament website
- `landing` - Registration page
- `live_games` - Live broadcast link

## Deployment

### Railway Deployment
```bash
git add .
git commit -m "Update calendar"
git push
# Auto-deploys to Railway
```

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to 'production' for deployment
- `ADMIN_TOKEN` - Bearer token for admin operations (api-server.js)
- `DATABASE_URL` - PostgreSQL connection (if using PostgreSQL)

## Testing

Manual testing workflow:
```bash
# 1. Start server
node calendar-api.js

# 2. Health check
curl http://localhost:3000/health

# 3. Test API
curl http://localhost:3000/api/stats

# 4. Web interface
open http://localhost:3000

# 5. Admin panel (api-server.js only)
open http://localhost:3000/admin
```

## CSV Import Format

Expected columns for `import-chess-calendar.js`:
- Title, Start Date, End Date
- Location, Continent, Venue
- Format, Rounds, Event Type
- Players, Prize Fund, Special
- URL, Landing, Live Games

## File Structure

### Server Files
- `api-server.js` - Main server with admin authentication and backup functionality
- `calendar-api.js` - Public API server without authentication
- `landing-server.js` - Landing page server with location services
- `simple-server.js` - Basic static file server

### Data Management
- `import-chess-calendar.js` - CSV import utility
- `query-calendar.js` - CLI database query tool
- `export-special-events.js` - Export special events to JSON
- `export-all-categories.js` - Export all categories to separate JSON files

### Frontend Files
- `admin.html` - Admin panel interface
- `index.html` - Main web interface
- `app.js` - Frontend JavaScript
- Various HTML files for different views and widgets

### Generated JSON Files
- Continent-based: `europe-events.json`, `americas-events.json`, etc.
- Format-based: `classical-events.json`, `rapid-events.json`, `blitz-events.json`, etc.
- Special categories: `world-championships.json`, `national-championships.json`, etc.

## Important Implementation Notes

- **Primary server**: `api-server.js` (default, includes admin auth)
- **Alternative server**: `calendar-api.js` (no auth, public API only)
- **Database path**: Production uses `/app/calendar-2026.db`, development uses `./calendar-2026.db`
- **Archive database**: `calendar.db` contains 2025 and earlier tournaments (not actively used by servers)
- **Backup directory**: Production uses `/app/backups`, development uses `./backups`
- **Admin authentication**: Uses Bearer token from `ADMIN_TOKEN` environment variable (default: `your-secret-admin-token-2026` in dev)
- **CORS**: Enabled for all origins in both implementations
- **Soft deletes**: Records marked with `deleted_at`, not physically removed
- **No automated tests**: Rely on manual testing workflow
- **Railway deployment**: Uses SQLite with persistent storage volume
- **JSON exports**: Static JSON files served from root (e.g., `/europe-events.json`)
- **Homepage**: Admin panel is default homepage with login flow (redirects to `/admin`)
- **Landing pages**: Separate server implementation for location-based tournament discovery
- **Chrome Extension**: Self-contained in `Calendar Chrome Extension/` directory