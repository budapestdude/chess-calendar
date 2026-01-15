const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const LocationService = require('./location-service');

const app = express();
const PORT = process.env.LANDING_PORT || 3001;
const API_URL = process.env.API_URL || 'http://localhost:3000';
const DB_PATH = process.env.NODE_ENV === 'production' ? '/app/calendar-2026.db' : 'calendar-2026.db';

// Initialize database connection
const db = new Database(DB_PATH, { readonly: true });

// Initialize location service
const locationService = new LocationService();

// Middleware
app.use(cors());
app.use(express.static('public'));

// Helper functions
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${start.getDate()}-${end.getDate()} ${end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
    return `${startMonth} - ${endMonth}`;
}

// Homepage with styled tournament grid
app.get('/', (req, res) => {
    try {
        // Get upcoming tournaments
        const upcomingTournaments = db.prepare(`
            SELECT id, title, start_datetime, end_datetime, location, format, special, continent
            FROM calendar_events 
            WHERE deleted_at IS NULL 
            AND start_datetime >= date('now')
            ORDER BY start_datetime ASC
            LIMIT 12
        `).all();

        // Get tournaments by continent
        const continents = ['Europe', 'Americas', 'Asia', 'Africa', 'Oceania'];
        const continentTournaments = {};
        
        continents.forEach(continent => {
            continentTournaments[continent] = db.prepare(`
                SELECT id, title, start_datetime, end_datetime, location, format
                FROM calendar_events 
                WHERE deleted_at IS NULL 
                AND continent = ?
                AND start_datetime >= date('now')
                ORDER BY start_datetime ASC
                LIMIT 3
            `).all(continent);
        });

        // Get special events
        const specialEvents = db.prepare(`
            SELECT id, title, start_datetime, end_datetime, location, format
            FROM calendar_events 
            WHERE deleted_at IS NULL 
            AND special = 'yes'
            AND start_datetime >= date('now')
            ORDER BY start_datetime ASC
            LIMIT 6
        `).all();

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chess Tournament Calendar - Comprehensive International Chess Events</title>
    <meta name="description" content="Complete calendar of international chess tournaments, championships, and competitions worldwide. Find upcoming chess events by continent, format, and category.">
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        /* Main Styles */
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            color: #333;
            transition: background-color 0.5s ease;
        }
        
        .chess-calendar-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            transition: opacity 0.5s ease;
        }
        
        /* Enhanced Header Styles */
        .page-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 0;
            border-bottom: none;
            position: relative;
            transform: translateY(0);
            transition: transform 0.5s ease;
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .page-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjUgMjVMNTAgNTBMMjUgNzVMNTAgMTAwTDc1IDc1TDUwIDUwTDc1IDI1TDUwIDBMMjUgMjVaIiBmaWxsPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiAvPjwvc3ZnPg==');
            background-size: 100px 100px;
            opacity: 0.1;
            z-index: 0;
        }
        
        .header-content {
            position: relative;
            z-index: 1;
        }
        
        .page-header h1 {
            color: #ffffff;
            font-size: 3.5rem;
            margin-bottom: 15px;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            letter-spacing: 2px;
            position: relative;
            display: inline-block;
        }
        
        .page-header h1::before,
        .page-header h1::after {
            content: '♔';
            font-size: 2rem;
            margin: 0 15px;
            color: #d4af37;
            vertical-align: middle;
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }
        
        .page-header p {
            color: #e0e0e0;
            font-size: 1.5rem;
            max-width: 800px;
            margin: 0 auto;
            font-style: italic;
            position: relative;
        }
        
        .page-header p::after {
            content: '';
            display: block;
            width: 100px;
            height: 3px;
            background: #d4af37;
            margin: 20px auto 0;
            border-radius: 2px;
            box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }
        
        /* Powered by button */
        .powered-by {
            display: inline-block;
            margin: 20px auto 0;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            text-decoration: none;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(5px);
        }

        .powered-by:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        /* Button Grid Styles */
        .calendar-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            grid-template-rows: repeat(2, auto);
            gap: 20px;
            margin-bottom: 40px;
        }
        
        /* Additional Categories Grid */
        .additional-categories {
            margin-top: 40px;
            margin-bottom: 40px;
        }
        
        .additional-categories h2 {
            color: #2c3e50;
            border-bottom: 2px solid #d4af37;
            padding-bottom: 10px;
            margin-top: 0;
            text-align: center;
            margin-bottom: 30px;
        }
        
        .additional-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            grid-template-rows: auto;
            gap: 20px;
        }
        
        .calendar-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            text-decoration: none;
            color: #2c3e50;
            padding: 20px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .calendar-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: 0.5s;
        }
        
        .calendar-btn:hover::before {
            left: 100%;
        }
        
        .calendar-btn:hover {
            transform: translateY(-5px) scale(1.03);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
        }
        
        .calendar-btn i {
            font-size: 3rem;
            margin-bottom: 15px;
            color: #d4af37;
            transition: transform 0.3s ease;
        }
        
        .calendar-btn:hover i {
            transform: rotate(15deg) scale(1.1);
        }
        
        .calendar-btn h3 {
            margin: 0;
            font-size: 1.5rem;
            position: relative;
        }
        
        .calendar-btn h3::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 2px;
            background: #d4af37;
            transition: width 0.3s ease;
        }
        
        .calendar-btn:hover h3::after {
            width: 80%;
        }
        
        /* Date text for calendar buttons */
        .calendar-btn .event-date {
            display: block;
            font-size: 0.8rem;
            color: #666;
            margin-top: 5px;
            font-weight: normal;
        }
        
        /* Featured Events Section */
        .featured-events {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 40px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(0);
            opacity: 1;
        }
        
        .featured-events h2 {
            color: #2c3e50;
            border-bottom: 2px solid #d4af37;
            padding-bottom: 10px;
            margin-top: 0;
            text-align: center;
            margin-bottom: 30px;
        }
        
        .events-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
        }
        
        .event-card {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #d4af37;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            animation: fadeIn 0.5s ease;
            height: 100%;
            box-sizing: border-box;
        }
        
        .event-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
        }
        
        .event-card h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        
        .event-card h3 a {
            color: #2c3e50;
            text-decoration: none;
            transition: color 0.3s ease;
        }
        
        .event-card h3 a:hover {
            color: #d4af37;
            text-decoration: underline;
        }
        
        .event-card p {
            margin-bottom: 10px;
        }
        
        .event-card .event-date {
            font-weight: bold;
            color: #d4af37;
        }
        
        .event-card .event-location {
            font-style: italic;
        }
        
        /* View details button */
        .event-link {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 16px;
            background-color: #d4af37;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        .event-link:hover {
            background-color: #b59530;
            transform: translateY(-2px);
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Full Calendar Button */
        .full-calendar-btn {
            display: block;
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            color: white;
            text-align: center;
            padding: 15px 20px;
            margin: 20px 0 40px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 1.2rem;
            font-weight: bold;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }
        
        .full-calendar-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        
        .full-calendar-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: 0.5s;
        }
        
        .full-calendar-btn:hover::before {
            left: 100%;
        }
        
        .full-calendar-btn i {
            margin-right: 10px;
            transition: transform 0.3s ease;
        }
        
        .full-calendar-btn:hover i {
            transform: translateX(5px);
        }
        
        /* Theme Toggle */
        .theme-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2c3e50;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 1000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }

        .theme-toggle:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            background: #3a506b;
        }
        
        /* Dark Theme */
        body.dark-theme {
            background-color: #1a1a1a;
            color: #f0f0f0;
        }
        
        body.dark-theme .calendar-btn,
        body.dark-theme .featured-events,
        body.dark-theme .event-card,
        body.dark-theme .additional-categories {
            background-color: #2d2d2d;
            color: #f0f0f0;
        }
        
        body.dark-theme .page-header {
            background: linear-gradient(135deg, #121921, #2a3a50);
        }
        
        body.dark-theme .event-card h3,
        body.dark-theme .featured-events h2,
        body.dark-theme .additional-categories h2 {
            color: #f0f0f0;
        }
        
        body.dark-theme .event-card h3 a {
            color: #f0f0f0;
        }
        
        body.dark-theme .event-card h3 a:hover {
            color: #d4af37;
        }
        
        body.dark-theme .event-card {
            border-left-color: #b59530;
            background-color: #363636;
        }
        
        body.dark-theme .calendar-btn .event-date {
            color: #ccc;
        }
        
        body.dark-theme .powered-by {
            background: rgba(0, 0, 0, 0.2);
            color: rgba(255, 255, 255, 0.7);
            border-color: rgba(255, 255, 255, 0.1);
        }

        body.dark-theme .full-calendar-btn {
            background: linear-gradient(135deg, #121921, #2a3a50);
        }
        
        /* Responsive Adjustments */
        @media (max-width: 1024px) {
            .events-grid {
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            }
            
            .page-header h1 {
                font-size: 3rem;
            }
            
            .calendar-grid {
                grid-template-columns: repeat(3, 1fr);
            }
            
            .additional-grid {
                grid-template-columns: repeat(3, 1fr);
                grid-template-rows: repeat(2, auto);
            }
        }
        
        @media (max-width: 768px) {
            .calendar-grid,
            .additional-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .page-header h1 {
                font-size: 2.5rem;
            }
            
            .page-header h1::before,
            .page-header h1::after {
                font-size: 1.8rem;
                margin: 0 10px;
            }
            
            .page-header p {
                font-size: 1.3rem;
            }
        }
        
        @media (max-width: 600px) {
            .events-grid {
                grid-template-columns: 1fr;
            }
            
            .page-header h1 {
                font-size: 2.2rem;
            }
            
            .theme-toggle span {
                display: none;
            }
        }
        
        @media (max-width: 480px) {
            .calendar-grid,
            .additional-grid {
                grid-template-columns: 1fr;
            }
            
            .page-header h1 {
                font-size: 2rem;
            }
            
            .page-header h1::before,
            .page-header h1::after {
                display: block;
                margin: 10px auto;
            }
        }
    </style>
</head>
<body>
    <button class="theme-toggle" onclick="toggleTheme()">
        <i class="fas fa-moon"></i>
        <span>Dark Mode</span>
    </button>

    <div class="chess-calendar-container">
        <!-- Header -->
        <div class="page-header">
            <div class="header-content">
                <h1>Chess Tournament Calendar</h1>
                <p>Your comprehensive guide to international chess events</p>
                <a href="https://chessdom.com" class="powered-by" target="_blank">
                    Powered by Chessdom
                </a>
            </div>
        </div>

        <!-- Continent Calendars Grid -->
        <div class="calendar-grid">
            <a href="/continent/europe" class="calendar-btn">
                <i class="fas fa-globe-europe"></i>
                <h3>Europe</h3>
                <span class="event-date">${continentTournaments.Europe?.length || 0} upcoming events</span>
            </a>
            <a href="/continent/americas" class="calendar-btn">
                <i class="fas fa-globe-americas"></i>
                <h3>Americas</h3>
                <span class="event-date">${continentTournaments.Americas?.length || 0} upcoming events</span>
            </a>
            <a href="/continent/asia" class="calendar-btn">
                <i class="fas fa-globe-asia"></i>
                <h3>Asia</h3>
                <span class="event-date">${continentTournaments.Asia?.length || 0} upcoming events</span>
            </a>
            <a href="/continent/africa" class="calendar-btn">
                <i class="fas fa-globe-africa"></i>
                <h3>Africa</h3>
                <span class="event-date">${continentTournaments.Africa?.length || 0} upcoming events</span>
            </a>
            <a href="/continent/oceania" class="calendar-btn">
                <i class="fas fa-earth-oceania"></i>
                <h3>Oceania</h3>
                <span class="event-date">${continentTournaments.Oceania?.length || 0} upcoming events</span>
            </a>
            <a href="/online" class="calendar-btn">
                <i class="fas fa-wifi"></i>
                <h3>Online</h3>
                <span class="event-date">Global participation</span>
            </a>
            
            <!-- Second row - Format based -->
            <a href="/format/classical" class="calendar-btn">
                <i class="fas fa-chess-king"></i>
                <h3>Classical</h3>
                <span class="event-date">Standard time control</span>
            </a>
            <a href="/format/rapid" class="calendar-btn">
                <i class="fas fa-chess-knight"></i>
                <h3>Rapid</h3>
                <span class="event-date">25+10 and similar</span>
            </a>
            <a href="/format/blitz" class="calendar-btn">
                <i class="fas fa-bolt"></i>
                <h3>Blitz</h3>
                <span class="event-date">3+2, 5+0</span>
            </a>
            <a href="/format/bullet" class="calendar-btn">
                <i class="fas fa-rocket"></i>
                <h3>Bullet</h3>
                <span class="event-date">1+0, 2+1</span>
            </a>
            <a href="/special" class="calendar-btn">
                <i class="fas fa-star"></i>
                <h3>Special Events</h3>
                <span class="event-date">${specialEvents.length} elite tournaments</span>
            </a>
            <a href="/upcoming" class="calendar-btn">
                <i class="fas fa-calendar-days"></i>
                <h3>Upcoming</h3>
                <span class="event-date">Next 30 days</span>
            </a>
        </div>

        <!-- Featured Upcoming Events -->
        <div class="featured-events">
            <h2>Featured Upcoming Tournaments</h2>
            <div class="events-grid">
                ${upcomingTournaments.slice(0, 6).map(t => `
                    <div class="event-card">
                        <h3><a href="/t/${generateSlug(t.title)}-${t.id}">${t.title}</a></h3>
                        <p class="event-date">📅 ${formatDateRange(t.start_datetime, t.end_datetime)}</p>
                        <p class="event-location">📍 ${t.location}</p>
                        ${t.format ? `<p>Format: ${t.format}</p>` : ''}
                        <a href="/t/${generateSlug(t.title)}-${t.id}" class="event-link">View Details →</a>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Additional Categories -->
        <div class="additional-categories">
            <h2>Tournament Categories</h2>
            <div class="additional-grid">
                <a href="/youth" class="calendar-btn">
                    <i class="fas fa-child"></i>
                    <h3>Youth</h3>
                    <span class="event-date">U8 to U18</span>
                </a>
                <a href="/women" class="calendar-btn">
                    <i class="fas fa-crown"></i>
                    <h3>Women's</h3>
                    <span class="event-date">Women only events</span>
                </a>
                <a href="/national" class="calendar-btn">
                    <i class="fas fa-flag"></i>
                    <h3>National</h3>
                    <span class="event-date">Championships</span>
                </a>
                <a href="/world" class="calendar-btn">
                    <i class="fas fa-trophy"></i>
                    <h3>World</h3>
                    <span class="event-date">Championships</span>
                </a>
                <a href="/freestyle" class="calendar-btn">
                    <i class="fas fa-chess"></i>
                    <h3>Freestyle</h3>
                    <span class="event-date">Chess960 & variants</span>
                </a>
                <a href="/all" class="calendar-btn">
                    <i class="fas fa-list"></i>
                    <h3>All Events</h3>
                    <span class="event-date">${upcomingTournaments.length}+ tournaments</span>
                </a>
            </div>
        </div>

        <!-- Full Calendar Link -->
        <a href="/calendar" class="full-calendar-btn">
            <i class="fas fa-calendar-alt"></i>
            View Complete Tournament Calendar
        </a>
    </div>

    <script>
        // Theme toggle functionality
        function toggleTheme() {
            const body = document.body;
            const button = document.querySelector('.theme-toggle');
            const icon = button.querySelector('i');
            const text = button.querySelector('span');
            
            body.classList.toggle('dark-theme');
            
            if (body.classList.contains('dark-theme')) {
                icon.className = 'fas fa-sun';
                if (text) text.textContent = 'Light Mode';
                localStorage.setItem('theme', 'dark');
            } else {
                icon.className = 'fas fa-moon';
                if (text) text.textContent = 'Dark Mode';
                localStorage.setItem('theme', 'light');
            }
        }
        
        // Load saved theme on page load
        document.addEventListener('DOMContentLoaded', function() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
                const button = document.querySelector('.theme-toggle');
                const icon = button.querySelector('i');
                const text = button.querySelector('span');
                icon.className = 'fas fa-sun';
                if (text) text.textContent = 'Light Mode';
            }
        });
    </script>
</body>
</html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error rendering homepage:', error);
        res.status(500).send('Internal server error');
    }
});

// Individual tournament page route
app.get('/t/:slug', async (req, res) => {
    try {
        // Extract ID from slug
        const slugParts = req.params.slug.split('-');
        const id = slugParts[slugParts.length - 1];
        
        if (!id || isNaN(id)) {
            return res.status(404).send('Invalid tournament URL');
        }

        const tournament = db.prepare(`
            SELECT * FROM calendar_events 
            WHERE id = ? AND deleted_at IS NULL
        `).get(id);

        if (!tournament) {
            return res.status(404).send('Tournament not found');
        }

        // Fetch location data
        const locationData = await locationService.getLocationData(
            tournament.location,
            tournament.start_datetime.split(' ')[0],
            tournament.end_datetime.split(' ')[0]
        );

        const timeControl = tournament.format === 'rapid' ? '15+10' : 
                           tournament.format === 'blitz' ? '3+2' : 
                           tournament.format === 'classical' ? '90+30' : '25+10';

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tournament.title} - ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}</title>
    <meta name="description" content="${tournament.title} chess tournament in ${tournament.location}. ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}.">
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        ${/* Using the same Chessdom style */ ''}
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            color: #333;
            transition: background-color 0.5s ease;
        }
        
        .chess-calendar-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Tournament Header - Similar to main page header */
        .tournament-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 60px 20px;
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
            color: white;
        }
        
        .tournament-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjUgMjVMNTAgNTBMMjUgNzVMNTAgMTAwTDc1IDc1TDUwIDUwTDc1IDI1TDUwIDBMMjUgMjVaIiBmaWxsPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiAvPjwvc3ZnPg==');
            background-size: 100px 100px;
            opacity: 0.1;
        }
        
        .tournament-header h1 {
            font-size: 2.5rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1;
        }
        
        .tournament-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 30px;
            font-size: 1.1rem;
            position: relative;
            z-index: 1;
        }
        
        .tournament-meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Content sections */
        .content-section {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .content-section h2 {
            color: #2c3e50;
            border-bottom: 2px solid #d4af37;
            padding-bottom: 10px;
            margin-bottom: 25px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
        }
        
        .info-card {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #d4af37;
        }
        
        .info-card h3 {
            color: #2c3e50;
            margin-top: 0;
        }
        
        .action-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 12px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            color: white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }
        
        .btn-secondary {
            background: white;
            color: #2c3e50;
            border: 2px solid #2c3e50;
        }
        
        .btn-secondary:hover {
            background: #2c3e50;
            color: white;
        }
        
        .btn-success {
            background: #d4af37;
            color: white;
        }
        
        .btn-success:hover {
            background: #b59530;
            transform: translateY(-3px);
        }
        
        /* Theme Toggle */
        .theme-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2c3e50;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 1000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }
        
        /* Dark Theme */
        body.dark-theme {
            background-color: #1a1a1a;
            color: #f0f0f0;
        }
        
        body.dark-theme .content-section,
        body.dark-theme .info-card {
            background-color: #2d2d2d;
            color: #f0f0f0;
        }
        
        body.dark-theme .info-card {
            background-color: #363636;
        }
        
        body.dark-theme .tournament-header {
            background: linear-gradient(135deg, #121921, #2a3a50);
        }
        
        body.dark-theme h2 {
            color: #f0f0f0;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .tournament-header h1 {
                font-size: 2rem;
            }
            
            .action-buttons {
                flex-direction: column;
            }
            
            .btn {
                width: 100%;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <button class="theme-toggle" onclick="toggleTheme()">
        <i class="fas fa-moon"></i>
        <span>Dark Mode</span>
    </button>

    <div class="chess-calendar-container">
        <!-- Tournament Header -->
        <div class="tournament-header">
            <h1>${tournament.title}</h1>
            <div class="tournament-meta">
                <div class="tournament-meta-item">
                    <i class="fas fa-calendar"></i>
                    ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}
                </div>
                <div class="tournament-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    ${tournament.location}
                </div>
                ${tournament.format ? `
                <div class="tournament-meta-item">
                    <i class="fas fa-chess"></i>
                    ${tournament.format.toUpperCase()}
                </div>
                ` : ''}
                <div class="tournament-meta-item">
                    <i class="fas fa-clock"></i>
                    Time Control: ${timeControl}
                </div>
            </div>
        </div>

        <!-- Tournament Details -->
        <div class="content-section">
            <h2>Tournament Information</h2>
            <div class="info-grid">
                <div class="info-card">
                    <h3><i class="fas fa-building"></i> Venue</h3>
                    <p><strong>${tournament.venue || 'Conference Center'}</strong></p>
                    <p>${locationData.coordinates?.display_name || tournament.location}</p>
                </div>
                
                <div class="info-card">
                    <h3><i class="fas fa-chess-board"></i> Format</h3>
                    <p><strong>${tournament.format || 'Swiss System'}</strong></p>
                    <p>${tournament.rounds || '9'} rounds</p>
                    <p>Time Control: ${timeControl}</p>
                </div>
                
                <div class="info-card">
                    <h3><i class="fas fa-trophy"></i> Prize Fund</h3>
                    <p><strong>${tournament.prize_fund || 'TBA'}</strong></p>
                    ${tournament.special === 'yes' ? '<p>Special Event</p>' : ''}
                </div>
            </div>
            
            <div class="action-buttons">
                ${tournament.url ? `
                <a href="${tournament.url}" class="btn btn-primary" target="_blank">
                    <i class="fas fa-globe"></i> Official Website
                </a>
                ` : ''}
                
                ${tournament.landing ? `
                <a href="${tournament.landing}" class="btn btn-secondary" target="_blank">
                    <i class="fas fa-user-plus"></i> Register
                </a>
                ` : ''}
                
                <a href="${API_URL}/api/events/${tournament.id}/ics" class="btn btn-success">
                    <i class="fas fa-calendar-plus"></i> Add to Calendar
                </a>
                
                ${tournament.live_games ? `
                <a href="${tournament.live_games}" class="btn btn-secondary" target="_blank">
                    <i class="fas fa-broadcast-tower"></i> Live Games
                </a>
                ` : ''}
            </div>
        </div>

        <!-- Location & Travel -->
        <div class="content-section">
            <h2>Location & Travel</h2>
            <div class="info-grid">
                <div class="info-card">
                    <h3><i class="fas fa-sun"></i> Weather</h3>
                    <p><strong>${locationData.weather?.temperature?.min || 15}°C - ${locationData.weather?.temperature?.max || 22}°C</strong></p>
                    <p>${locationData.weather?.condition || 'Check forecast closer to date'}</p>
                </div>
                
                <div class="info-card">
                    <h3><i class="fas fa-plane"></i> Getting There</h3>
                    <p>${locationData.transportation?.airport?.name || 'International Airport'}</p>
                    <p>${locationData.transportation?.airport?.distance || '20-30 km from venue'}</p>
                </div>
                
                <div class="info-card">
                    <h3><i class="fas fa-info-circle"></i> Practical Info</h3>
                    <p><strong>Currency:</strong> ${locationData.practical?.currency?.name || 'Local currency'}</p>
                    <p><strong>Language:</strong> ${locationData.practical?.language || 'Local language'}</p>
                    <p><strong>Emergency:</strong> ${locationData.practical?.emergency?.all || locationData.practical?.emergency?.police || '112/911'}</p>
                </div>
            </div>
        </div>

        <!-- Hotels -->
        ${locationData.hotels && locationData.hotels.length > 0 ? `
        <div class="content-section">
            <h2>Recommended Hotels</h2>
            <div class="info-grid">
                ${locationData.hotels.slice(0, 3).map(hotel => `
                <div class="info-card">
                    <h3>${hotel.name}</h3>
                    <p>${hotel.priceRange || 'Contact for rates'}</p>
                    <p>${hotel.distance || 'Near venue'}</p>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>

    <script>
        function toggleTheme() {
            const body = document.body;
            const button = document.querySelector('.theme-toggle');
            const icon = button.querySelector('i');
            const text = button.querySelector('span');
            
            body.classList.toggle('dark-theme');
            
            if (body.classList.contains('dark-theme')) {
                icon.className = 'fas fa-sun';
                if (text) text.textContent = 'Light Mode';
                localStorage.setItem('theme', 'dark');
            } else {
                icon.className = 'fas fa-moon';
                if (text) text.textContent = 'Dark Mode';
                localStorage.setItem('theme', 'light');
            }
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
                const button = document.querySelector('.theme-toggle');
                const icon = button.querySelector('i');
                const text = button.querySelector('span');
                icon.className = 'fas fa-sun';
                if (text) text.textContent = 'Light Mode';
            }
        });
    </script>
</body>
</html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error rendering tournament page:', error);
        res.status(500).send('Internal server error');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'landing-pages-styled' });
});

app.listen(PORT, () => {
    console.log(`Styled landing pages server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see the styled homepage`);
});