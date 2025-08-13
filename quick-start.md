# Quick Start - Access Your Chess Calendar

## Current Setup
Your chess calendar database is running locally at: **http://localhost:3000**

## How to Access Your Calendar:

### 1. 📱 Apple Calendar (Mac/iPhone/iPad)
1. Open Calendar app
2. File → New Calendar Subscription
3. Enter: `http://localhost:3000/api/events.ics`
4. Set auto-refresh (hourly/daily)
5. All 1459 chess tournaments will appear!

### 2. 📅 Google Calendar
1. Open Google Calendar
2. Click + next to "Other calendars"
3. Select "From URL"
4. Enter: `http://localhost:3000/api/events.ics`
5. Click "Add calendar"

### 3. 🌐 Web Browser
Just open: **http://localhost:3000**
- View all tournaments
- Add new events
- Search players
- Filter by continent/format
- Upload CSV files

### 4. 📱 Mobile Apps
To access from your phone when on same WiFi:
1. Find your computer's IP address:
   - Mac: `ifconfig | grep inet`
   - Windows: `ipconfig`
2. Replace `localhost` with your IP
   - Example: `http://192.168.1.100:3000`

### 5. 💻 Programmatic Access

**JavaScript (fetch upcoming events):**
```javascript
fetch('http://localhost:3000/api/events/upcoming')
  .then(res => res.json())
  .then(events => console.log(events));
```

**Python (search for player):**
```python
import requests
events = requests.get('http://localhost:3000/api/players/search?name=Carlsen').json()
print(f"Found {len(events)} events with Carlsen")
```

**Command Line (get stats):**
```bash
curl http://localhost:3000/api/stats
```

## API Endpoints

| What You Want | URL |
|--------------|-----|
| All events | http://localhost:3000/api/events |
| Upcoming only | http://localhost:3000/api/events/upcoming |
| Search player | http://localhost:3000/api/players/search?name=NAME |
| Filter by continent | http://localhost:3000/api/events/continent/Europe |
| Calendar file (.ics) | http://localhost:3000/api/events.ics |
| Web interface | http://localhost:3000 |

## Making It Available Online

### Option 1: Quick Share (ngrok)
```bash
# Install ngrok
brew install ngrok  # Mac
# or download from ngrok.com

# Share your calendar
ngrok http 3000

# You'll get a public URL like:
# https://abc123.ngrok.io
# Share this with anyone!
```

### Option 2: Deploy to Cloud (Free)
1. **Railway.app** (easiest)
   - Push to GitHub
   - Connect Railway to your repo
   - Auto-deploys in 2 minutes

2. **Render.com**
   - Similar to Railway
   - Free tier available

3. **Heroku**
   - Requires credit card but has free tier

## Your Database Stats
- **Total Events**: 1459 chess tournaments
- **Database Size**: ~2 MB (very efficient!)
- **Coverage**: 2025 full year
- **Continents**: 6 (all inhabited continents)
- **Formats**: Classical, Rapid, Blitz, Bullet, Freestyle

## Files You Have

| File | Purpose |
|------|---------|
| `calendar.db` | SQLite database with all events |
| `calendar-api.js` | REST API server |
| `index.html` | Web interface |
| `app.js` | Frontend JavaScript |
| `query-calendar.js` | Command-line query tool |
| `import-chess-calendar.js` | CSV import tool |

## Need Help?
- View integration guide: `integration-guide.md`
- Check API status: http://localhost:3000/health
- Restart server: `node calendar-api.js`

## Example: Add to Your Website
```html
<iframe 
  src="http://localhost:3000" 
  width="100%" 
  height="600"
  frameborder="0">
</iframe>
```

That's it! Your chess calendar is ready to use everywhere!