# Calendar Database Integration Guide

Your chess calendar database can be accessed by any application through the REST API running at http://localhost:3000

## 1. Web Applications

### JavaScript/React/Vue/Angular
```javascript
// Fetch upcoming events
fetch('http://localhost:3000/api/events/upcoming')
  .then(res => res.json())
  .then(events => {
    // Display events in your calendar UI
    events.forEach(event => {
      calendar.addEvent({
        title: event.title,
        start: event.start_datetime,
        end: event.end_datetime,
        url: event.url
      });
    });
  });

// Search for specific tournaments
fetch('http://localhost:3000/api/events?search=Tata%20Steel')
  .then(res => res.json())
  .then(data => console.log(data.data));
```

### jQuery/FullCalendar Integration
```javascript
$('#calendar').fullCalendar({
  events: function(start, end, timezone, callback) {
    $.ajax({
      url: 'http://localhost:3000/api/events',
      data: {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD')
      },
      success: function(doc) {
        var events = doc.data.map(event => ({
          title: event.title,
          start: event.start_datetime,
          end: event.end_datetime,
          url: event.url
        }));
        callback(events);
      }
    });
  }
});
```

## 2. Mobile Apps (iOS/Android)

### iOS (Swift)
```swift
import Foundation

class ChessCalendarAPI {
    let baseURL = "http://your-server.com:3000/api"
    
    func fetchUpcomingEvents(completion: @escaping ([Event]) -> Void) {
        guard let url = URL(string: "\(baseURL)/events/upcoming") else { return }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data else { return }
            
            do {
                let events = try JSONDecoder().decode([Event].self, from: data)
                DispatchQueue.main.async {
                    completion(events)
                }
            } catch {
                print("Error decoding events: \(error)")
            }
        }.resume()
    }
}

struct Event: Codable {
    let id: Int
    let title: String
    let location: String
    let start_datetime: String
    let end_datetime: String
    let url: String
}
```

### Android (Kotlin)
```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query

interface ChessCalendarAPI {
    @GET("events/upcoming")
    suspend fun getUpcomingEvents(): EventResponse
    
    @GET("events")
    suspend fun searchEvents(@Query("search") query: String): EventResponse
}

class CalendarRepository {
    private val api = Retrofit.Builder()
        .baseUrl("http://your-server.com:3000/api/")
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(ChessCalendarAPI::class.java)
    
    suspend fun getUpcomingEvents() = api.getUpcomingEvents()
}
```

## 3. Chrome Extension

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Chess Calendar",
  "permissions": ["http://localhost:3000/*"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

### popup.js
```javascript
// Fetch today's tournaments
fetch('http://localhost:3000/api/events/upcoming')
  .then(response => response.json())
  .then(events => {
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(e => 
      e.start_datetime.startsWith(today)
    );
    
    // Display in popup
    todayEvents.forEach(event => {
      const div = document.createElement('div');
      div.innerHTML = `
        <h3>${event.title}</h3>
        <p>${event.location}</p>
        <a href="${event.url}" target="_blank">View Details</a>
      `;
      document.body.appendChild(div);
    });
  });
```

## 4. Google Calendar Integration

### ICS/iCal Export Endpoint
Add this to your calendar-api.js:

```javascript
// Generate ICS format for calendar apps
app.get('/api/events.ics', (req, res) => {
  const events = db.prepare('SELECT * FROM calendar_events WHERE deleted_at IS NULL').all();
  
  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Chess Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Chess Tournaments
`;

  events.forEach(event => {
    const start = new Date(event.start_datetime).toISOString().replace(/[-:]/g, '').replace('.000', '');
    const end = new Date(event.end_datetime).toISOString().replace(/[-:]/g, '').replace('.000', '');
    
    ics += `BEGIN:VEVENT
UID:${event.id}@chesscalendar
DTSTART:${start}
DTEND:${end}
SUMMARY:${event.title}
LOCATION:${event.location}
URL:${event.url}
DESCRIPTION:${event.description || ''}
END:VEVENT
`;
  });
  
  ics += 'END:VCALENDAR';
  
  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', 'attachment; filename="chess-calendar.ics"');
  res.send(ics);
});
```

Then subscribe to: `http://localhost:3000/api/events.ics`

## 5. Python Applications

```python
import requests
import pandas as pd
from datetime import datetime

class ChessCalendarClient:
    def __init__(self, base_url='http://localhost:3000/api'):
        self.base_url = base_url
    
    def get_upcoming_events(self):
        response = requests.get(f'{self.base_url}/events/upcoming')
        return response.json()
    
    def search_player(self, player_name):
        response = requests.get(f'{self.base_url}/players/search', 
                               params={'name': player_name})
        return response.json()
    
    def get_events_dataframe(self):
        response = requests.get(f'{self.base_url}/events?limit=1000')
        events = response.json()['data']
        return pd.DataFrame(events)

# Usage
client = ChessCalendarClient()
upcoming = client.get_upcoming_events()
carlsen_events = client.search_player('Carlsen')
df = client.get_events_dataframe()
```

## 6. Direct Database Access (SQLite)

For applications on the same machine:

### Python
```python
import sqlite3
import pandas as pd

# Direct database access
conn = sqlite3.connect('calendar.db')
df = pd.read_sql_query("SELECT * FROM calendar_events WHERE deleted_at IS NULL", conn)
conn.close()
```

### Node.js
```javascript
const Database = require('better-sqlite3');
const db = new Database('calendar.db', { readonly: true });

const events = db.prepare('SELECT * FROM calendar_events WHERE deleted_at IS NULL').all();
db.close();
```

## 7. Deployment Options for Remote Access

### Option A: Deploy to Cloud (Recommended)
1. **Heroku** (Free tier available)
2. **AWS EC2** or **Google Cloud**
3. **DigitalOcean** ($5/month)
4. **Railway** or **Render**

### Option B: Home Server with ngrok
```bash
# Install ngrok
brew install ngrok  # macOS

# Expose your local API to internet
ngrok http 3000

# You'll get a public URL like: https://abc123.ngrok.io
# Use this URL in your apps instead of localhost
```

### Option C: VPS Deployment
```bash
# On a VPS (Ubuntu/Debian)
# 1. Copy your files
scp -r ./* user@your-server:/var/www/calendar

# 2. Install Node.js and PM2
ssh user@your-server
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Start the API
cd /var/www/calendar
npm install
pm2 start calendar-api.js
pm2 save
pm2 startup

# 4. Setup nginx reverse proxy
sudo apt-get install nginx
# Configure nginx to proxy port 80 to 3000
```

## API Endpoints Reference

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/api/events` | GET | Get all events with filters | `?limit=50&continent=Europe` |
| `/api/events/upcoming` | GET | Get upcoming events | Returns next 20 events |
| `/api/events/:id` | GET | Get single event | `/api/events/123` |
| `/api/events` | POST | Create new event | POST with JSON body |
| `/api/events/:id` | PUT | Update event | PUT with JSON body |
| `/api/events/:id` | DELETE | Delete event | DELETE request |
| `/api/players/search` | GET | Search by player | `?name=Carlsen` |
| `/api/stats` | GET | Get statistics | Returns counts |
| `/api/events.ics` | GET | iCal format | For calendar apps |

## Example: Full Web Calendar Page

```html
<!DOCTYPE html>
<html>
<head>
    <link href='https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.css' rel='stylesheet' />
    <script src='https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.js'></script>
</head>
<body>
    <div id='calendar'></div>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var calendarEl = document.getElementById('calendar');
            var calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                events: async function(info, successCallback, failureCallback) {
                    try {
                        const response = await fetch('http://localhost:3000/api/events?limit=500');
                        const data = await response.json();
                        const events = data.data.map(event => ({
                            title: event.title,
                            start: event.start_datetime,
                            end: event.end_datetime,
                            url: event.url,
                            extendedProps: {
                                location: event.location,
                                format: event.format
                            }
                        }));
                        successCallback(events);
                    } catch (error) {
                        failureCallback(error);
                    }
                },
                eventClick: function(info) {
                    window.open(info.event.url, '_blank');
                }
            });
            calendar.render();
        });
    </script>
</body>
</html>
```

## Making the API Public

To make your calendar accessible from anywhere:

1. **Get a domain**: Use a service like Namecheap or Google Domains
2. **Deploy to cloud**: Use the deployment options above
3. **Enable HTTPS**: Use Let's Encrypt for free SSL
4. **Add authentication**: Protect write operations with API keys

```javascript
// Add to calendar-api.js for basic API key auth
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
  }
  next();
});
```

## Ready-to-Use Client Libraries

Save any of these as separate files in your project:

- `chess-calendar-client.js` - JavaScript client
- `ChessCalendarClient.swift` - iOS client  
- `ChessCalendarClient.kt` - Android client
- `chess_calendar_client.py` - Python client

Each provides a simple interface to fetch and display your chess tournament data!