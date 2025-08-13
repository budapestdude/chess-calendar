# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chess Calendar Database system that provides both SQLite and PostgreSQL implementations for storing and accessing chess tournament data. The project includes a REST API, web interface, and import/export capabilities for managing 1400+ chess tournaments.

## Architecture

### Database Layer
- **Primary**: SQLite database (`calendar.db`) for the main deployment using `better-sqlite3`
- **Alternative**: PostgreSQL support via Docker Compose for scalable deployments
- Chess tournament specific schema with fields for format, rounds, continent, players, etc.
- Soft delete support and full-text search capabilities

### API Layer
- **Main API**: `calendar-api.js` - Express server with SQLite backend (port 3000)
- **PostgreSQL API**: `api/server.js` - Express server with PostgreSQL backend
- RESTful endpoints for CRUD operations, search, filtering, and statistics
- ICS/iCal export endpoint for calendar subscriptions
- CORS enabled for cross-origin access

### Frontend
- `index.html` + `app.js`: Web interface for viewing and managing tournaments
- Features: search, filtering by continent/format, CSV upload, single event creation
- Direct API integration via fetch

## Commands

### Development
```bash
# Start the SQLite API server
node calendar-api.js
# or
npm start

# Start PostgreSQL stack (if using Docker)
docker-compose up -d

# Import CSV data
node import-chess-calendar.js "Chess Calendar - Sheet1 (1).csv"

# Query database from CLI
node query-calendar.js
```

### API Development (PostgreSQL version)
```bash
cd api
npm install
npm start  # Start server
npm run dev  # Start with nodemon
npm run import  # Import from Google Sheets
```

### Deployment
```bash
# Deploy to Railway (see DEPLOY-TO-RAILWAY.md)
git add .
git commit -m "Update calendar"
git push

# The app auto-deploys to Railway on push
```

## Key API Endpoints

- `GET /api/events` - List events with pagination and filters
- `GET /api/events/upcoming` - Get upcoming tournaments
- `GET /api/events/continent/:continent` - Filter by continent
- `GET /api/players/search?name=` - Search by player name
- `GET /api/stats` - Get database statistics
- `GET /api/events.ics` - Calendar subscription feed
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Soft delete event

## Database Schema Key Fields

### Chess Tournament Specific
- `event_type`, `format`, `rounds` - Tournament classification
- `continent`, `location`, `venue` - Geographic data
- `players` - Participant names (searchable)
- `prize_fund`, `special` - Tournament details
- `url`, `landing`, `live_games` - External links

### Standard Calendar Fields
- `title`, `description`, `start_datetime`, `end_datetime`
- `created_at`, `updated_at`, `deleted_at` (soft delete)

## Environment Variables

For PostgreSQL deployment:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - For authentication (if enabled)
- `NODE_ENV` - Set to 'production' for deployment
- `PORT` - Server port (default: 3000)

## Testing & Validation

Currently no automated tests. Manual testing approach:
1. Start server: `node calendar-api.js`
2. Check health: `curl http://localhost:3000/health`
3. Test API: `curl http://localhost:3000/api/stats`
4. Web interface: Open http://localhost:3000

## Important Notes

- The SQLite implementation (`calendar-api.js`) is the primary/active version
- Database file `calendar.db` contains 1457+ chess tournaments
- No authentication by default - add JWT middleware for production
- Soft deletes are used (records marked with `deleted_at` timestamp)
- CSV import expects specific column mapping (see import-chess-calendar.js)
- Railway deployment uses SQLite with persistent storage