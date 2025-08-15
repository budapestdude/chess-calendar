# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chess Calendar Database system with 1400+ tournaments. The project uses SQLite as primary storage with Express.js REST API, providing web interface and calendar subscription capabilities. Alternative PostgreSQL implementation available for scalable deployments.

## Architecture

### Active Implementation
- **Database**: SQLite (`calendar.db`) via `better-sqlite3` - contains 1457+ tournaments
- **Main API**: `calendar-api.js` - Express server on port 3000
- **Alternative API**: `api-server.js` - Express server with admin authentication
- **Web Interface**: `index.html` + `app.js` - tournament viewing, search, CSV upload
- **Admin Panel**: `admin.html` - authenticated management interface

### Key Features
- Full-text search across all tournament fields
- ICS/iCal calendar subscription endpoint
- Continent and format-based filtering
- Player name search
- Soft delete support (`deleted_at` timestamps)
- CSV import/export capabilities

## Commands

```bash
# Start main SQLite server
node calendar-api.js
# or
npm start

# Alternative server with admin auth
node api-server.js

# Simple static server
npm run simple

# Import CSV data
node import-chess-calendar.js "filename.csv"

# Query database CLI
node query-calendar.js

# Export special events
npm run build-data

# PostgreSQL stack (Docker)
docker-compose up -d
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

## Database Schema

### Chess-Specific Fields
- `format` - Tournament format (rapid/blitz/classical/bullet/freestyle)
- `rounds` - Number of rounds
- `continent` - Geographic region (Europe/Americas/Asia/Africa/Oceania)
- `players` - Participant names (searchable)
- `prize_fund` - Prize pool information
- `special` - Special tournament flag (yes/no)
- `event_type` - Tournament classification

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

## Important Implementation Notes

- **Primary server**: `calendar-api.js` (no auth, public API)
- **Admin server**: `api-server.js` (Bearer auth required)
- **Database path**: Production uses `/app/calendar.db`, development uses `./calendar.db`
- **CORS**: Enabled for all origins in both implementations
- **Soft deletes**: Records marked with `deleted_at`, not physically removed
- **No automated tests**: Rely on manual testing workflow
- **Railway deployment**: Uses SQLite with persistent storage volume