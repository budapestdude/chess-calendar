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

// Helper function to generate SEO-friendly slug
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Helper function to format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Helper function to format date range
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

// Route for tournament landing page by ID
app.get('/tournament/:id', (req, res) => {
    try {
        const tournament = db.prepare(`
            SELECT * FROM calendar_events 
            WHERE id = ? AND deleted_at IS NULL
        `).get(req.params.id);

        if (!tournament) {
            return res.status(404).send('Tournament not found');
        }

        const slug = generateSlug(tournament.title);
        res.redirect(301, `/t/${slug}-${tournament.id}`);
    } catch (error) {
        console.error('Error fetching tournament:', error);
        res.status(500).send('Internal server error');
    }
});

// Route for SEO-friendly tournament URLs
app.get('/t/:slug', (req, res) => {
    try {
        // Extract ID from slug (format: tournament-name-123)
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

        // Generate structured data for SEO
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            "name": tournament.title,
            "description": tournament.description || `Chess tournament: ${tournament.title}`,
            "startDate": tournament.start_datetime,
            "endDate": tournament.end_datetime,
            "location": {
                "@type": "Place",
                "name": tournament.venue || tournament.location,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": tournament.location
                }
            },
            "organizer": {
                "@type": "Organization",
                "name": "Chess Calendar"
            }
        };

        if (tournament.url) {
            structuredData.url = tournament.url;
        }

        // Generate placeholder data for enhanced sections
        const timeControl = tournament.format === 'rapid' ? '15+10' : 
                           tournament.format === 'blitz' ? '3+2' : 
                           tournament.format === 'classical' ? '90+30' : '25+10';
        
        const prizeBreakdown = tournament.prize_fund ? [
            { place: '1st', amount: '$10,000' },
            { place: '2nd', amount: '$6,000' },
            { place: '3rd', amount: '$4,000' },
            { place: '4th-10th', amount: '$1,000' }
        ] : null;

        // Render the enhanced landing page
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tournament.title} - Chess Tournament | ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}</title>
    <meta name="description" content="${tournament.description || `${tournament.title} chess tournament in ${tournament.location}. ${tournament.format || 'Chess'} tournament from ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}.`}">
    
    <!-- Open Graph tags for social media -->
    <meta property="og:title" content="${tournament.title}">
    <meta property="og:description" content="${tournament.description || `Chess tournament in ${tournament.location}`}">
    <meta property="og:type" content="event">
    <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
    
    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${tournament.title}">
    <meta name="twitter:description" content="${tournament.description || `Chess tournament in ${tournament.location}`}">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
    </script>
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            min-height: 100vh;
        }

        .hero-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 60px 20px 120px;
            position: relative;
        }

        .hero-pattern {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 20px;
            position: relative;
            z-index: 1;
        }

        .tournament-hero {
            text-align: center;
            padding: 40px 0;
        }

        h1 {
            font-size: 3rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }

        .hero-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 30px;
            font-size: 1.2rem;
            margin-top: 20px;
        }

        .hero-meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .main-content {
            margin-top: -80px;
            position: relative;
            z-index: 10;
            padding-bottom: 60px;
        }

        .tab-navigation {
            background: white;
            border-radius: 15px 15px 0 0;
            box-shadow: 0 -5px 20px rgba(0,0,0,0.1);
            display: flex;
            overflow-x: auto;
            border-bottom: 1px solid #e2e8f0;
        }

        .tab-button {
            padding: 20px 30px;
            background: none;
            border: none;
            font-size: 1rem;
            font-weight: 600;
            color: #718096;
            cursor: pointer;
            position: relative;
            white-space: nowrap;
            transition: all 0.3s ease;
        }

        .tab-button:hover {
            color: #4a5568;
            background: #f7fafc;
        }

        .tab-button.active {
            color: #667eea;
        }

        .tab-button.active::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 3px;
            background: #667eea;
        }

        .tab-content {
            background: white;
            padding: 40px;
            border-radius: 0 0 15px 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }

        .tab-panel {
            display: none;
        }

        .tab-panel.active {
            display: block;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
        }

        .info-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            border-left: 4px solid #667eea;
            transition: all 0.3s ease;
        }

        .info-card:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .info-card h3 {
            color: #2d3748;
            margin-bottom: 15px;
            font-size: 1.2rem;
        }

        .info-card-icon {
            font-size: 1.5rem;
            margin-right: 10px;
        }

        .prize-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .prize-table th,
        .prize-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        .prize-table th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
        }

        .prize-table tr:hover {
            background: #f7fafc;
        }

        .weather-widget {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
        }

        .weather-temp {
            font-size: 3rem;
            font-weight: bold;
        }

        .travel-tips {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .tip-card {
            background: white;
            border: 2px solid #e2e8f0;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            transition: all 0.3s ease;
        }

        .tip-card:hover {
            border-color: #667eea;
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }

        .tip-icon {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .schedule-timeline {
            position: relative;
            padding-left: 40px;
            margin-top: 30px;
        }

        .schedule-timeline::before {
            content: '';
            position: absolute;
            left: 15px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e2e8f0;
        }

        .schedule-item {
            position: relative;
            margin-bottom: 30px;
        }

        .schedule-item::before {
            content: '';
            position: absolute;
            left: -25px;
            top: 5px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #667eea;
            border: 3px solid white;
            box-shadow: 0 0 0 3px #e0e7ff;
        }

        .schedule-time {
            color: #667eea;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .hotel-list {
            display: grid;
            gap: 20px;
            margin-top: 20px;
        }

        .hotel-card {
            display: flex;
            gap: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            transition: all 0.3s ease;
        }

        .hotel-card:hover {
            transform: translateX(10px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .hotel-rating {
            color: #f6ad55;
        }

        .action-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 40px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 15px 40px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-size: 1.1rem;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
        }

        .btn-secondary {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }

        .btn-secondary:hover {
            background: #667eea;
            color: white;
        }

        .btn-success {
            background: #48bb78;
            color: white;
        }

        .btn-success:hover {
            background: #38a169;
            transform: translateY(-3px);
        }

        .badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-left: 10px;
        }

        .badge-special {
            background: linear-gradient(135deg, #f6e05e 0%, #ecc94b 100%);
            color: #744210;
        }

        .badge-format {
            background: #e0e7ff;
            color: #3730a3;
        }

        .stats-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }

        .stat-box {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-radius: 10px;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            color: #718096;
            margin-top: 5px;
        }

        @media (max-width: 768px) {
            h1 {
                font-size: 2rem;
            }
            
            .tab-content {
                padding: 20px;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }

            .hero-section {
                padding: 40px 20px 100px;
            }
        }
    </style>
</head>
<body>
    <div class="hero-section">
        <div class="hero-pattern"></div>
        <div class="container">
            <div class="tournament-hero">
                <h1>
                    ${tournament.title}
                    ${tournament.special === 'yes' ? '<span class="badge badge-special">⭐ Special Event</span>' : ''}
                    ${tournament.format ? `<span class="badge badge-format">${tournament.format.toUpperCase()}</span>` : ''}
                </h1>
                <div class="hero-meta">
                    <div class="hero-meta-item">
                        📅 ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}
                    </div>
                    <div class="hero-meta-item">
                        📍 ${tournament.location}
                    </div>
                    ${tournament.continent ? `<div class="hero-meta-item">🌍 ${tournament.continent}</div>` : ''}
                    <div class="hero-meta-item">
                        ⏱️ Time Control: ${timeControl}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <div class="main-content">
            <div class="tab-navigation">
                <button class="tab-button active" onclick="showTab('overview')">📋 Overview</button>
                <button class="tab-button" onclick="showTab('schedule')">📅 Schedule</button>
                <button class="tab-button" onclick="showTab('prizes')">🏆 Prizes</button>
                <button class="tab-button" onclick="showTab('participants')">👥 Participants</button>
                <button class="tab-button" onclick="showTab('travel')">✈️ Travel Info</button>
                <button class="tab-button" onclick="showTab('accommodation')">🏨 Accommodation</button>
                <button class="tab-button" onclick="showTab('local')">🌆 Local Guide</button>
            </div>

            <div class="tab-content">
                <!-- Overview Tab -->
                <div id="overview" class="tab-panel active">
                    <div class="stats-row">
                        <div class="stat-box">
                            <div class="stat-number">${tournament.rounds || '9'}</div>
                            <div class="stat-label">Rounds</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${timeControl}</div>
                            <div class="stat-label">Time Control</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">200+</div>
                            <div class="stat-label">Expected Players</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${tournament.prize_fund || '$50,000'}</div>
                            <div class="stat-label">Prize Fund</div>
                        </div>
                    </div>

                    <div class="info-grid">
                        <div class="info-card">
                            <h3><span class="info-card-icon">🏛️</span>Venue</h3>
                            <p><strong>${tournament.venue || 'Conference Center'}</strong></p>
                            <p>${tournament.location}</p>
                            <p style="color: #718096; margin-top: 10px;">Modern facility with excellent playing conditions, air conditioning, and comfortable seating.</p>
                        </div>

                        <div class="info-card">
                            <h3><span class="info-card-icon">📋</span>Format</h3>
                            <p><strong>${tournament.format || 'Swiss System'}</strong></p>
                            <p>${tournament.rounds || '9'} rounds</p>
                            <p style="color: #718096; margin-top: 10px;">FIDE rated tournament following standard ${tournament.format || 'Swiss'} pairing rules.</p>
                        </div>

                        <div class="info-card">
                            <h3><span class="info-card-icon">📝</span>Registration</h3>
                            <p><strong>Online & On-site</strong></p>
                            <p>Early bird discount until 2 weeks before</p>
                            <p style="color: #718096; margin-top: 10px;">Entry fee: $100 (GM/IM free)</p>
                        </div>
                    </div>

                    ${tournament.description ? `
                    <div class="info-card" style="margin-top: 20px;">
                        <h3><span class="info-card-icon">📖</span>About the Tournament</h3>
                        <p>${tournament.description}</p>
                    </div>
                    ` : ''}

                    <div class="action-buttons">
                        ${tournament.url ? `
                        <a href="${tournament.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                            <span>🌐</span> Official Website
                        </a>
                        ` : ''}
                        
                        ${tournament.landing ? `
                        <a href="${tournament.landing}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                            <span>📝</span> Register Now
                        </a>
                        ` : ''}
                        
                        <a href="${API_URL}/api/events/${tournament.id}/ics" class="btn btn-success">
                            <span>📅</span> Add to Calendar
                        </a>
                        
                        ${tournament.live_games ? `
                        <a href="${tournament.live_games}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                            <span>📺</span> Live Games
                        </a>
                        ` : ''}
                    </div>
                </div>

                <!-- Schedule Tab -->
                <div id="schedule" class="tab-panel">
                    <h2 style="margin-bottom: 30px;">Tournament Schedule</h2>
                    <div class="schedule-timeline">
                        <div class="schedule-item">
                            <div class="schedule-time">Day 1 - ${formatDate(tournament.start_datetime)}</div>
                            <div><strong>Registration & Opening Ceremony</strong></div>
                            <div style="color: #718096;">09:00 - 14:00: Registration</div>
                            <div style="color: #718096;">15:00: Opening Ceremony</div>
                            <div style="color: #718096;">16:00: Round 1</div>
                        </div>
                        <div class="schedule-item">
                            <div class="schedule-time">Day 2-4</div>
                            <div><strong>Double Rounds</strong></div>
                            <div style="color: #718096;">10:00: Morning Round</div>
                            <div style="color: #718096;">16:00: Afternoon Round</div>
                        </div>
                        <div class="schedule-item">
                            <div class="schedule-time">Day 5</div>
                            <div><strong>Rest Day</strong></div>
                            <div style="color: #718096;">Optional Blitz Tournament</div>
                            <div style="color: #718096;">City Tour Available</div>
                        </div>
                        <div class="schedule-item">
                            <div class="schedule-time">Day 6-8</div>
                            <div><strong>Final Rounds</strong></div>
                            <div style="color: #718096;">15:00: Daily Round</div>
                        </div>
                        <div class="schedule-item">
                            <div class="schedule-time">Last Day - ${formatDate(tournament.end_datetime)}</div>
                            <div><strong>Final Round & Closing</strong></div>
                            <div style="color: #718096;">10:00: Round 9</div>
                            <div style="color: #718096;">16:00: Prize Giving Ceremony</div>
                        </div>
                    </div>
                </div>

                <!-- Prizes Tab -->
                <div id="prizes" class="tab-panel">
                    <h2>Prize Distribution</h2>
                    <p style="color: #718096; margin-bottom: 20px;">Total Prize Fund: ${tournament.prize_fund || '$50,000'}</p>
                    
                    <div class="info-grid">
                        <div class="info-card">
                            <h3>🥇 Main Prizes</h3>
                            <table class="prize-table">
                                <thead>
                                    <tr>
                                        <th>Place</th>
                                        <th>Prize</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>1st</td>
                                        <td><strong>$10,000</strong></td>
                                    </tr>
                                    <tr>
                                        <td>2nd</td>
                                        <td>$6,000</td>
                                    </tr>
                                    <tr>
                                        <td>3rd</td>
                                        <td>$4,000</td>
                                    </tr>
                                    <tr>
                                        <td>4th-10th</td>
                                        <td>$1,500 each</td>
                                    </tr>
                                    <tr>
                                        <td>11th-20th</td>
                                        <td>$750 each</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="info-card">
                            <h3>🏅 Category Prizes</h3>
                            <table class="prize-table">
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Prize</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Best Woman</td>
                                        <td>$1,500</td>
                                    </tr>
                                    <tr>
                                        <td>Best Junior (U18)</td>
                                        <td>$1,000</td>
                                    </tr>
                                    <tr>
                                        <td>Best Senior (50+)</td>
                                        <td>$1,000</td>
                                    </tr>
                                    <tr>
                                        <td>Best U2200</td>
                                        <td>$800</td>
                                    </tr>
                                    <tr>
                                        <td>Best U2000</td>
                                        <td>$600</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="info-card" style="margin-top: 20px;">
                        <h3>💰 Prize Payment</h3>
                        <p>Prizes will be paid via bank transfer within 30 days after the tournament. 
                        Winners must provide valid bank details and may be subject to local tax regulations.</p>
                    </div>
                </div>

                <!-- Participants Tab -->
                <div id="participants" class="tab-panel">
                    <h2>Tournament Participants</h2>
                    
                    ${tournament.players ? `
                    <div class="info-card" style="margin-bottom: 30px;">
                        <h3>⭐ Notable Participants</h3>
                        <p style="font-size: 1.1rem;">${tournament.players}</p>
                    </div>
                    ` : ''}

                    <div class="info-grid">
                        <div class="info-card">
                            <h3>📊 Rating Categories</h3>
                            <p><strong>2600+:</strong> 5 players</p>
                            <p><strong>2400-2599:</strong> 15 players</p>
                            <p><strong>2200-2399:</strong> 45 players</p>
                            <p><strong>2000-2199:</strong> 80 players</p>
                            <p><strong>Under 2000:</strong> 55 players</p>
                        </div>

                        <div class="info-card">
                            <h3>🌍 Countries Represented</h3>
                            <p>25+ nations expected</p>
                            <p style="color: #718096; margin-top: 10px;">
                                USA, Russia, India, China, Germany, France, Spain, 
                                Netherlands, Poland, Ukraine, and more...
                            </p>
                        </div>

                        <div class="info-card">
                            <h3>👥 Player Services</h3>
                            <p>✓ Live ratings update</p>
                            <p>✓ Game analysis room</p>
                            <p>✓ Post-game computer access</p>
                            <p>✓ Free refreshments</p>
                            <p>✓ Tournament bulletin</p>
                        </div>
                    </div>
                </div>

                <!-- Travel Tab -->
                <div id="travel" class="tab-panel">
                    <h2>Travel Information</h2>
                    
                    <div class="info-grid">
                        <div class="info-card">
                            <h3>✈️ Nearest Airport</h3>
                            <p><strong>International Airport</strong></p>
                            <p>Distance: 25 km (30 min drive)</p>
                            <p style="color: #718096; margin-top: 10px;">
                                Direct flights from major European and international cities. 
                                Airport shuttle service available.
                            </p>
                        </div>

                        <div class="info-card">
                            <h3>🚆 By Train</h3>
                            <p><strong>Central Station</strong></p>
                            <p>Distance: 2 km (5 min drive)</p>
                            <p style="color: #718096; margin-top: 10px;">
                                High-speed rail connections available. 
                                Walking distance or short taxi ride to venue.
                            </p>
                        </div>

                        <div class="info-card">
                            <h3>🚗 By Car</h3>
                            <p><strong>Parking Available</strong></p>
                            <p>Free parking at venue</p>
                            <p style="color: #718096; margin-top: 10px;">
                                GPS coordinates will be provided. 
                                Ample parking space for all participants.
                            </p>
                        </div>
                    </div>

                    <div class="travel-tips">
                        <div class="tip-card">
                            <div class="tip-icon">🛂</div>
                            <h4>Visa Info</h4>
                            <p>Check visa requirements for your country. Letter of invitation available.</p>
                        </div>
                        <div class="tip-card">
                            <div class="tip-icon">💱</div>
                            <h4>Currency</h4>
                            <p>Local currency accepted. ATMs and exchange offices nearby.</p>
                        </div>
                        <div class="tip-card">
                            <div class="tip-icon">🚕</div>
                            <h4>Local Transport</h4>
                            <p>Uber/taxi readily available. Public transport passes can be purchased.</p>
                        </div>
                        <div class="tip-card">
                            <div class="tip-icon">📱</div>
                            <h4>Connectivity</h4>
                            <p>Free WiFi at venue. Local SIM cards available at airport.</p>
                        </div>
                    </div>
                </div>

                <!-- Accommodation Tab -->
                <div id="accommodation" class="tab-panel">
                    <h2>Recommended Hotels</h2>
                    
                    <div class="hotel-list">
                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>🏨 Grand Hotel (Official Hotel)</h3>
                                <p class="hotel-rating">⭐⭐⭐⭐⭐</p>
                                <p><strong>Special Rate:</strong> $80/night (Single), $100/night (Double)</p>
                                <p style="color: #718096;">5-minute walk to venue. Breakfast included. Book with code "CHESS2025"</p>
                            </div>
                        </div>

                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>🏨 City Center Hotel</h3>
                                <p class="hotel-rating">⭐⭐⭐⭐</p>
                                <p><strong>Rate:</strong> $60/night</p>
                                <p style="color: #718096;">10-minute walk. Modern amenities. Free shuttle to venue.</p>
                            </div>
                        </div>

                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>🏨 Budget Inn</h3>
                                <p class="hotel-rating">⭐⭐⭐</p>
                                <p><strong>Rate:</strong> $35/night</p>
                                <p style="color: #718096;">15-minute bus ride. Clean and comfortable. Popular with players.</p>
                            </div>
                        </div>

                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>🏠 Chess House (Hostel)</h3>
                                <p class="hotel-rating">⭐⭐</p>
                                <p><strong>Rate:</strong> $20/night (Dorm), $40/night (Private)</p>
                                <p style="color: #718096;">Backpacker friendly. Kitchen facilities. Chess themed!</p>
                            </div>
                        </div>
                    </div>

                    <div class="info-card" style="margin-top: 30px;">
                        <h3>🏡 Alternative Accommodation</h3>
                        <p><strong>Airbnb:</strong> Many options available in the area from $30/night</p>
                        <p><strong>Student Housing:</strong> University dorms available during summer at $25/night</p>
                        <p style="color: #718096; margin-top: 10px;">
                            Book early for best rates. Group discounts may be available for teams.
                        </p>
                    </div>
                </div>

                <!-- Local Guide Tab -->
                <div id="local" class="tab-panel">
                    <h2>Local Area Guide</h2>
                    
                    <div class="info-grid">
                        <div class="info-card">
                            <h3>🌡️ Weather Forecast</h3>
                            <div class="weather-widget">
                                <div class="weather-temp">22°C</div>
                                <div>Partly Cloudy</div>
                                <div style="margin-top: 10px; font-size: 0.9rem;">
                                    Expected: 18-25°C during tournament<br>
                                    Light jacket recommended for evenings
                                </div>
                            </div>
                        </div>

                        <div class="info-card">
                            <h3>🍽️ Dining Options</h3>
                            <p><strong>At Venue:</strong> Cafeteria with hot meals</p>
                            <p><strong>Nearby:</strong></p>
                            <ul style="margin-left: 20px; color: #718096;">
                                <li>Italian Restaurant - 2 min walk</li>
                                <li>Asian Cuisine - 5 min walk</li>
                                <li>Fast Food - 3 min walk</li>
                                <li>Vegetarian/Vegan - 7 min walk</li>
                            </ul>
                        </div>

                        <div class="info-card">
                            <h3>🏥 Emergency Services</h3>
                            <p><strong>Hospital:</strong> 2 km away</p>
                            <p><strong>Pharmacy:</strong> 500m from venue</p>
                            <p><strong>Police:</strong> Emergency 911</p>
                            <p style="color: #718096; margin-top: 10px;">
                                Tournament doctor on-site during playing hours
                            </p>
                        </div>
                    </div>

                    <div class="info-card" style="margin-top: 20px;">
                        <h3>🎭 Things to Do</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                            <div>
                                <strong>Museums</strong>
                                <p style="color: #718096;">Chess Museum - 10 min walk</p>
                            </div>
                            <div>
                                <strong>Shopping</strong>
                                <p style="color: #718096;">Main shopping street - 15 min walk</p>
                            </div>
                            <div>
                                <strong>Parks</strong>
                                <p style="color: #718096;">Central Park - 5 min walk</p>
                            </div>
                            <div>
                                <strong>Entertainment</strong>
                                <p style="color: #718096;">Cinema, Theater district nearby</p>
                            </div>
                        </div>
                    </div>

                    <div class="info-card" style="margin-top: 20px;">
                        <h3>📍 Useful Addresses</h3>
                        <p><strong>Tournament Venue:</strong> ${tournament.venue || 'Conference Center'}, ${tournament.location}</p>
                        <p><strong>Tourist Information:</strong> Main Square, open 9am-6pm</p>
                        <p><strong>Tournament Office:</strong> At venue, Room 101</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function showTab(tabName) {
            // Hide all tabs
            const tabs = document.querySelectorAll('.tab-panel');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Remove active class from all buttons
            const buttons = document.querySelectorAll('.tab-button');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked button
            event.target.classList.add('active');
        }
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

// Homepage - list all tournaments
app.get('/', (req, res) => {
    try {
        const tournaments = db.prepare(`
            SELECT id, title, start_datetime, end_datetime, location, format, special
            FROM calendar_events 
            WHERE deleted_at IS NULL 
            AND start_datetime >= date('now')
            ORDER BY start_datetime ASC
            LIMIT 50
        `).all();

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chess Tournament Calendar - Upcoming Events</title>
    <meta name="description" content="Comprehensive calendar of chess tournaments worldwide. Find upcoming chess events, championships, and competitions.">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 60px 20px;
            text-align: center;
        }
        
        .hero h1 {
            font-size: 3rem;
            margin-bottom: 20px;
        }
        
        .hero p {
            font-size: 1.3rem;
            opacity: 0.9;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .tournaments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
            margin-top: 30px;
        }
        
        .tournament-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: block;
        }
        
        .tournament-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }
        
        .tournament-title {
            font-size: 1.3rem;
            color: #2d3748;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .tournament-meta {
            color: #718096;
            font-size: 0.95rem;
            line-height: 1.8;
        }
        
        .tournament-date {
            color: #667eea;
            font-weight: 500;
        }
        
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 8px;
        }
        
        .badge-special {
            background: #f6e05e;
            color: #744210;
        }
        
        .badge-format {
            background: #e0e7ff;
            color: #3730a3;
        }
        
        @media (max-width: 768px) {
            .hero h1 {
                font-size: 2rem;
            }
            
            .tournaments-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="hero">
        <h1>Chess Tournament Calendar</h1>
        <p>Discover upcoming chess tournaments worldwide</p>
    </div>
    
    <div class="container">
        <h2>Upcoming Tournaments</h2>
        
        <div class="tournaments-grid">
            ${tournaments.map(t => `
                <a href="/t/${generateSlug(t.title)}-${t.id}" class="tournament-card">
                    <div class="tournament-title">
                        ${t.title}
                        ${t.special === 'yes' ? '<span class="badge badge-special">Special</span>' : ''}
                        ${t.format ? `<span class="badge badge-format">${t.format}</span>` : ''}
                    </div>
                    <div class="tournament-meta">
                        <div class="tournament-date">📅 ${formatDateRange(t.start_datetime, t.end_datetime)}</div>
                        <div>📍 ${t.location}</div>
                    </div>
                </a>
            `).join('')}
        </div>
    </div>
</body>
</html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        res.status(500).send('Internal server error');
    }
});

// Route to generate sitemap for SEO
app.get('/sitemap.xml', (req, res) => {
    try {
        const tournaments = db.prepare(`
            SELECT id, title, updated_at 
            FROM calendar_events 
            WHERE deleted_at IS NULL
            ORDER BY updated_at DESC
        `).all();

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    ${tournaments.map(t => `
    <url>
        <loc>${baseUrl}/t/${generateSlug(t.title)}-${t.id}</loc>
        <lastmod>${new Date(t.updated_at).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`).join('')}
</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Internal server error');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'landing-pages' });
});

app.listen(PORT, () => {
    console.log(`Landing pages server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see tournament landing pages`);
});