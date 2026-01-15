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

// Comprehensive tournament page with ALL information
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
        console.log(`Fetching location data for: ${tournament.location}`);
        const locationData = await locationService.getLocationData(
            tournament.location,
            tournament.start_datetime.split(' ')[0],
            tournament.end_datetime.split(' ')[0]
        );

        const timeControl = tournament.format === 'rapid' ? '15+10' : 
                           tournament.format === 'blitz' ? '3+2' : 
                           tournament.format === 'classical' ? '90+30' : '25+10';

        // Generate placeholder data for comprehensive info
        const prizeBreakdown = tournament.prize_fund ? [
            { place: '1st', amount: '$10,000' },
            { place: '2nd', amount: '$6,000' },
            { place: '3rd', amount: '$4,000' },
            { place: '4th-10th', amount: '$1,000 each' }
        ] : null;

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
        /* Base Styles */
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            color: #333;
            transition: background-color 0.5s ease;
        }
        
        .chess-calendar-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Tournament Header */
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
            font-size: 3rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1;
        }
        
        .tournament-header h1::before,
        .tournament-header h1::after {
            content: '♔';
            font-size: 2rem;
            margin: 0 15px;
            color: #d4af37;
            vertical-align: middle;
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }
        
        .tournament-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 30px;
            font-size: 1.2rem;
            position: relative;
            z-index: 1;
        }
        
        .tournament-meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
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
        
        /* Tab Navigation */
        .tab-navigation {
            background: white;
            border-radius: 12px 12px 0 0;
            box-shadow: 0 -5px 20px rgba(0,0,0,0.1);
            display: flex;
            overflow-x: auto;
            border-bottom: 2px solid #d4af37;
            margin-top: 30px;
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
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .tab-button:hover {
            color: #4a5568;
            background: #f7fafc;
        }
        
        .tab-button.active {
            color: #2c3e50;
            background: #f9f9f9;
        }
        
        .tab-button.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 3px;
            background: #d4af37;
        }
        
        /* Tab Content */
        .tab-content {
            background: white;
            padding: 40px;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            min-height: 500px;
        }
        
        .tab-panel {
            display: none;
            animation: fadeIn 0.3s ease;
        }
        
        .tab-panel.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Content Sections */
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
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        /* Info Grid */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
        }
        
        .info-card {
            background: #f9f9f9;
            padding: 25px;
            border-radius: 12px;
            border-left: 4px solid #d4af37;
            transition: all 0.3s ease;
        }
        
        .info-card:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .info-card h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .info-card p {
            margin: 10px 0;
            line-height: 1.6;
        }
        
        .info-card strong {
            color: #2c3e50;
        }
        
        /* Stats Row */
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
            transition: all 0.3s ease;
        }
        
        .stat-box:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #d4af37;
        }
        
        .stat-label {
            color: #718096;
            margin-top: 5px;
        }
        
        /* Action Buttons */
        .action-buttons {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 40px 0;
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
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
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
        
        /* Tables */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .data-table th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
        }
        
        .data-table tr:hover {
            background: #f7fafc;
        }
        
        /* Schedule Timeline */
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
            padding-left: 30px;
        }
        
        .schedule-item::before {
            content: '';
            position: absolute;
            left: -25px;
            top: 5px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #d4af37;
            border: 3px solid white;
            box-shadow: 0 0 0 3px #e0e7ff;
        }
        
        .schedule-time {
            color: #d4af37;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .schedule-item strong {
            color: #2c3e50;
        }
        
        /* Hotel Cards */
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
            align-items: center;
        }
        
        .hotel-card:hover {
            transform: translateX(10px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .hotel-rating {
            color: #f6ad55;
        }
        
        /* Travel Tips */
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
            border-color: #d4af37;
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .tip-icon {
            font-size: 2.5rem;
            margin-bottom: 10px;
            color: #d4af37;
        }
        
        /* Weather Widget */
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
        
        body.dark-theme .content-section,
        body.dark-theme .tab-navigation,
        body.dark-theme .tab-content,
        body.dark-theme .info-card {
            background-color: #2d2d2d;
            color: #f0f0f0;
        }
        
        body.dark-theme .info-card {
            background-color: #363636;
            border-left-color: #b59530;
        }
        
        body.dark-theme .tournament-header {
            background: linear-gradient(135deg, #121921, #2a3a50);
        }
        
        body.dark-theme h2,
        body.dark-theme h3,
        body.dark-theme .info-card h3 {
            color: #f0f0f0;
        }
        
        /* Fix bold text in dark mode */
        body.dark-theme strong,
        body.dark-theme .info-card strong,
        body.dark-theme .schedule-item strong {
            color: #f0f0f0 !important;
        }
        
        body.dark-theme .stat-label,
        body.dark-theme .schedule-time {
            color: #b0b0b0;
        }
        
        body.dark-theme .tab-button {
            color: #b0b0b0;
        }
        
        body.dark-theme .tab-button.active {
            color: #f0f0f0;
            background: #363636;
        }
        
        body.dark-theme .tab-button:hover {
            background: #363636;
            color: #f0f0f0;
        }
        
        body.dark-theme .data-table th {
            background: #363636;
            color: #f0f0f0;
        }
        
        body.dark-theme .data-table tr:hover {
            background: #363636;
        }
        
        body.dark-theme .hotel-card,
        body.dark-theme .tip-card,
        body.dark-theme .stat-box {
            background: #363636;
            border-color: #4a4a4a;
        }
        
        body.dark-theme .btn-secondary {
            background: #363636;
            color: #f0f0f0;
            border-color: #4a4a4a;
        }
        
        body.dark-theme .btn-secondary:hover {
            background: #4a4a4a;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .tournament-header h1 {
                font-size: 2rem;
            }
            
            .tournament-header h1::before,
            .tournament-header h1::after {
                font-size: 1.5rem;
                margin: 0 8px;
            }
            
            .tab-navigation {
                overflow-x: auto;
            }
            
            .tab-button {
                padding: 15px 20px;
                font-size: 0.9rem;
            }
            
            .action-buttons {
                flex-direction: column;
            }
            
            .btn {
                width: 100%;
                justify-content: center;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .stats-row {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 480px) {
            .tournament-header h1 {
                font-size: 1.8rem;
            }
            
            .tournament-meta {
                flex-direction: column;
                gap: 15px;
            }
            
            .stats-row {
                grid-template-columns: 1fr;
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
            <h1>
                ${tournament.title}
                ${tournament.special === 'yes' ? '<span class="badge badge-special">⭐ Special Event</span>' : ''}
                ${tournament.format ? `<span class="badge badge-format">${tournament.format.toUpperCase()}</span>` : ''}
            </h1>
            <div class="tournament-meta">
                <div class="tournament-meta-item">
                    <i class="fas fa-calendar"></i>
                    ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}
                </div>
                <div class="tournament-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    ${tournament.location}
                </div>
                ${tournament.continent ? `
                <div class="tournament-meta-item">
                    <i class="fas fa-globe"></i>
                    ${tournament.continent}
                </div>
                ` : ''}
                <div class="tournament-meta-item">
                    <i class="fas fa-clock"></i>
                    Time Control: ${timeControl}
                </div>
            </div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
            <button class="tab-button active" onclick="showTab('overview')">
                <i class="fas fa-info-circle"></i> Overview
            </button>
            <button class="tab-button" onclick="showTab('schedule')">
                <i class="fas fa-calendar-alt"></i> Schedule
            </button>
            <button class="tab-button" onclick="showTab('prizes')">
                <i class="fas fa-trophy"></i> Prizes
            </button>
            <button class="tab-button" onclick="showTab('participants')">
                <i class="fas fa-users"></i> Participants
            </button>
            <button class="tab-button" onclick="showTab('travel')">
                <i class="fas fa-plane"></i> Travel
            </button>
            <button class="tab-button" onclick="showTab('accommodation')">
                <i class="fas fa-bed"></i> Hotels
            </button>
            <button class="tab-button" onclick="showTab('local')">
                <i class="fas fa-city"></i> Local Info
            </button>
            <button class="tab-button" onclick="showTab('practical')">
                <i class="fas fa-info"></i> Practical
            </button>
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
                        <h3><i class="fas fa-building"></i> Venue Information</h3>
                        <p><strong>Venue:</strong> ${tournament.venue || 'Conference Center'}</p>
                        <p><strong>Location:</strong> ${locationData.coordinates?.display_name || tournament.location}</p>
                        ${locationData.coordinates ? `
                        <p><strong>City:</strong> ${locationData.coordinates.city || 'N/A'}</p>
                        <p><strong>Country:</strong> ${locationData.coordinates.country || 'N/A'}</p>
                        ` : ''}
                        <p><strong>Playing Conditions:</strong> Modern facility with excellent playing conditions, air conditioning, and comfortable seating.</p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-chess-board"></i> Tournament Format</h3>
                        <p><strong>System:</strong> ${tournament.format || 'Swiss System'}</p>
                        <p><strong>Rounds:</strong> ${tournament.rounds || '9'}</p>
                        <p><strong>Time Control:</strong> ${timeControl}</p>
                        <p><strong>Rating:</strong> FIDE rated tournament</p>
                        <p><strong>Pairing:</strong> Swiss-Manager pairing software</p>
                        ${tournament.event_type ? `<p><strong>Event Type:</strong> ${tournament.event_type}</p>` : ''}
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-user-plus"></i> Registration</h3>
                        <p><strong>Registration:</strong> Online & On-site available</p>
                        <p><strong>Entry Fee:</strong> $100 standard (GM/IM free)</p>
                        <p><strong>Early Bird:</strong> 20% discount until 2 weeks before</p>
                        <p><strong>Requirements:</strong> Valid FIDE ID required</p>
                        <p><strong>Deadline:</strong> 24 hours before round 1</p>
                    </div>
                </div>

                ${tournament.description ? `
                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-book"></i> About the Tournament</h3>
                    <p>${tournament.description}</p>
                </div>
                ` : ''}

                ${tournament.players ? `
                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-star"></i> Notable Participants</h3>
                    <p style="font-size: 1.1rem;">${tournament.players}</p>
                </div>
                ` : ''}

                <div class="action-buttons">
                    ${tournament.url ? `
                    <a href="${tournament.url}" target="_blank" class="btn btn-primary">
                        <i class="fas fa-globe"></i> Official Website
                    </a>
                    ` : ''}
                    
                    ${tournament.landing ? `
                    <a href="${tournament.landing}" target="_blank" class="btn btn-secondary">
                        <i class="fas fa-user-plus"></i> Register Now
                    </a>
                    ` : ''}
                    
                    <a href="${API_URL}/api/events/${tournament.id}/ics" class="btn btn-success">
                        <i class="fas fa-calendar-plus"></i> Add to Calendar
                    </a>
                    
                    ${tournament.live_games ? `
                    <a href="${tournament.live_games}" target="_blank" class="btn btn-secondary">
                        <i class="fas fa-broadcast-tower"></i> Live Games
                    </a>
                    ` : ''}
                </div>
            </div>

            <!-- Schedule Tab -->
            <div id="schedule" class="tab-panel">
                <h2><i class="fas fa-calendar-week"></i> Tournament Schedule</h2>
                <div class="schedule-timeline">
                    <div class="schedule-item">
                        <div class="schedule-time">Day 1 - ${formatDate(tournament.start_datetime)}</div>
                        <div><strong>Registration & Opening Ceremony</strong></div>
                        <div style="color: #718096;">
                            <p>09:00 - 14:00: Registration and confirmation</p>
                            <p>14:30: Technical meeting</p>
                            <p>15:00: Opening ceremony</p>
                            <p>16:00: Round 1</p>
                        </div>
                    </div>
                    <div class="schedule-item">
                        <div class="schedule-time">Day 2-4</div>
                        <div><strong>Double Rounds</strong></div>
                        <div style="color: #718096;">
                            <p>10:00: Morning round</p>
                            <p>14:00: Lunch break</p>
                            <p>16:00: Afternoon round</p>
                            <p>20:00: Analysis room open</p>
                        </div>
                    </div>
                    <div class="schedule-item">
                        <div class="schedule-time">Day 5 - Rest Day</div>
                        <div><strong>Optional Activities</strong></div>
                        <div style="color: #718096;">
                            <p>10:00: Blitz tournament (optional)</p>
                            <p>14:00: City tour (optional)</p>
                            <p>16:00: Simul with GM (optional)</p>
                            <p>19:00: Tournament dinner</p>
                        </div>
                    </div>
                    <div class="schedule-item">
                        <div class="schedule-time">Day 6-8</div>
                        <div><strong>Final Rounds</strong></div>
                        <div style="color: #718096;">
                            <p>15:00: Daily round</p>
                            <p>19:00: Post-game analysis</p>
                        </div>
                    </div>
                    <div class="schedule-item">
                        <div class="schedule-time">Last Day - ${formatDate(tournament.end_datetime)}</div>
                        <div><strong>Final Round & Closing</strong></div>
                        <div style="color: #718096;">
                            <p>10:00: Round 9</p>
                            <p>15:00: Closing ceremony</p>
                            <p>16:00: Prize giving ceremony</p>
                            <p>17:00: Farewell reception</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Prizes Tab -->
            <div id="prizes" class="tab-panel">
                <h2><i class="fas fa-trophy"></i> Prize Distribution</h2>
                <p style="font-size: 1.2rem; margin-bottom: 30px;">
                    <strong>Total Prize Fund:</strong> ${tournament.prize_fund || '$50,000'}
                </p>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h3>🥇 Main Prizes</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Place</th>
                                    <th>Prize</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1st</td>
                                    <td><strong>$10,000</strong> + Trophy</td>
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
                                <tr>
                                    <td>21st-30th</td>
                                    <td>$400 each</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="info-card">
                        <h3>🏅 Category Prizes</h3>
                        <table class="data-table">
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
                                <tr>
                                    <td>Best U1800</td>
                                    <td>$500</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-money-check"></i> Prize Payment Information</h3>
                    <p><strong>Payment Method:</strong> Bank transfer or cash</p>
                    <p><strong>Processing Time:</strong> Within 30 days after tournament</p>
                    <p><strong>Tax Information:</strong> Prizes may be subject to local tax regulations</p>
                    <p><strong>Requirements:</strong> Valid bank details and tax forms required</p>
                </div>
            </div>

            <!-- Participants Tab -->
            <div id="participants" class="tab-panel">
                <h2><i class="fas fa-users"></i> Tournament Participants</h2>
                
                ${tournament.players ? `
                <div class="info-card" style="margin-bottom: 30px;">
                    <h3>⭐ Confirmed Top Players</h3>
                    <p style="font-size: 1.2rem;">${tournament.players}</p>
                </div>
                ` : ''}

                <div class="info-grid">
                    <div class="info-card">
                        <h3><i class="fas fa-chart-bar"></i> Rating Categories</h3>
                        <p><strong>2600+:</strong> 5 players expected</p>
                        <p><strong>2400-2599:</strong> 15 players</p>
                        <p><strong>2200-2399:</strong> 45 players</p>
                        <p><strong>2000-2199:</strong> 80 players</p>
                        <p><strong>1800-1999:</strong> 40 players</p>
                        <p><strong>Under 1800:</strong> 15 players</p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-globe-americas"></i> Countries Represented</h3>
                        <p><strong>Expected:</strong> 25+ nations</p>
                        <p style="margin-top: 10px;">
                            USA, Russia, India, China, Germany, France, Spain, 
                            Netherlands, Poland, Ukraine, England, Italy, 
                            Hungary, Czech Republic, and more...
                        </p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-concierge-bell"></i> Player Services</h3>
                        <p>✓ Live ratings update after each round</p>
                        <p>✓ Professional game analysis room</p>
                        <p>✓ Post-game computer analysis</p>
                        <p>✓ Free refreshments during rounds</p>
                        <p>✓ Daily tournament bulletin</p>
                        <p>✓ Professional photography</p>
                        <p>✓ Live broadcast of top boards</p>
                    </div>
                </div>

                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-clipboard-list"></i> Registration Statistics</h3>
                    <p><strong>Current Registrations:</strong> 187 players</p>
                    <p><strong>Average Rating:</strong> 2156</p>
                    <p><strong>Titled Players:</strong> 23 (5 GM, 8 IM, 10 FM)</p>
                    <p><strong>Female Players:</strong> 28</p>
                    <p><strong>Junior Players:</strong> 45</p>
                </div>
            </div>

            <!-- Travel Tab -->
            <div id="travel" class="tab-panel">
                <h2><i class="fas fa-plane"></i> Travel Information</h2>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h3><i class="fas fa-plane-arrival"></i> Nearest Airport</h3>
                        <p><strong>${locationData.transportation?.airport?.name || 'International Airport'}</strong></p>
                        <p><strong>Distance:</strong> ${locationData.transportation?.airport?.distance || '25 km (30 min drive)'}</p>
                        <p><strong>Transport Options:</strong></p>
                        <ul style="margin-left: 20px;">
                            ${locationData.transportation?.airport?.transport ? 
                                locationData.transportation.airport.transport.map(t => `<li>${t}</li>`).join('') :
                                '<li>Airport shuttle service</li><li>Taxi (30-45 min)</li><li>Public transport available</li>'
                            }
                        </ul>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-train"></i> By Train</h3>
                        <p><strong>Main Station:</strong> Central Railway Station</p>
                        <p><strong>Distance:</strong> 2 km (5 min drive)</p>
                        <p><strong>Connections:</strong> High-speed rail connections available</p>
                        <p><strong>To Venue:</strong> Walking distance or short taxi ride</p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-car"></i> By Car</h3>
                        <p><strong>Parking:</strong> Free parking at venue (200 spaces)</p>
                        <p><strong>Driving Side:</strong> ${locationData.transportation?.driving?.side || 'Right'}</p>
                        <p><strong>GPS Coordinates:</strong> ${locationData.coordinates ? `${locationData.coordinates.lat}, ${locationData.coordinates.lon}` : 'Available on request'}</p>
                        <p><strong>Car Rental:</strong> ${locationData.transportation?.driving?.rental || 'Available at airport and city center'}</p>
                    </div>
                </div>

                <div class="travel-tips">
                    <div class="tip-card">
                        <div class="tip-icon"><i class="fas fa-passport"></i></div>
                        <h4>Visa Information</h4>
                        <p>${locationData.practical?.visa?.requirement || 'Check visa requirements for your country'}</p>
                        <p>${locationData.practical?.visa?.invitation || 'Letter of invitation available'}</p>
                    </div>
                    <div class="tip-card">
                        <div class="tip-icon"><i class="fas fa-money-bill-wave"></i></div>
                        <h4>Currency</h4>
                        <p><strong>${locationData.practical?.currency?.name || 'Local Currency'}</strong></p>
                        <p>${locationData.practical?.currency?.code || ''} ${locationData.practical?.currency?.symbol || ''}</p>
                        <p>ATMs and exchange offices nearby</p>
                    </div>
                    <div class="tip-card">
                        <div class="tip-icon"><i class="fas fa-bus"></i></div>
                        <h4>Local Transport</h4>
                        <p>${locationData.transportation?.publicTransport?.types ? locationData.transportation.publicTransport.types.join(', ') : 'Bus, Metro, Tram'}</p>
                        <p>${locationData.transportation?.publicTransport?.ticketing || 'Day passes available'}</p>
                    </div>
                    <div class="tip-card">
                        <div class="tip-icon"><i class="fas fa-sim-card"></i></div>
                        <h4>Connectivity</h4>
                        <p>Free WiFi at venue</p>
                        <p>${locationData.practical?.sim || 'Local SIM cards at airport'}</p>
                    </div>
                </div>
            </div>

            <!-- Accommodation Tab -->
            <div id="accommodation" class="tab-panel">
                <h2><i class="fas fa-bed"></i> Recommended Hotels</h2>
                
                <div class="hotel-list">
                    ${locationData.hotels && locationData.hotels.length > 0 ? 
                        locationData.hotels.map(hotel => `
                            <div class="hotel-card">
                                <div style="flex: 1;">
                                    <h3>${hotel.name}</h3>
                                    ${hotel.stars ? `<p class="hotel-rating">${'⭐'.repeat(hotel.stars)}</p>` : ''}
                                    <p><strong>Price:</strong> ${hotel.priceRange || 'Contact for rates'}</p>
                                    <p><strong>Distance:</strong> ${hotel.distance || 'Near venue'}</p>
                                    ${hotel.website ? `<p><a href="${hotel.website}" target="_blank">Visit Website</a></p>` : ''}
                                    ${hotel.phone ? `<p><strong>Phone:</strong> ${hotel.phone}</p>` : ''}
                                    ${hotel.description ? `<p>${hotel.description}</p>` : ''}
                                </div>
                            </div>
                        `).join('') :
                        `
                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>Grand Hotel (Official Hotel)</h3>
                                <p class="hotel-rating">⭐⭐⭐⭐⭐</p>
                                <p><strong>Special Rate:</strong> $80/night (Single), $100/night (Double)</p>
                                <p><strong>Distance:</strong> 5-minute walk to venue</p>
                                <p>Breakfast included. Book with code "CHESS2025"</p>
                            </div>
                        </div>
                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>City Center Hotel</h3>
                                <p class="hotel-rating">⭐⭐⭐⭐</p>
                                <p><strong>Rate:</strong> $60/night</p>
                                <p><strong>Distance:</strong> 10-minute walk</p>
                                <p>Modern amenities. Free shuttle to venue.</p>
                            </div>
                        </div>
                        <div class="hotel-card">
                            <div style="flex: 1;">
                                <h3>Budget Inn</h3>
                                <p class="hotel-rating">⭐⭐⭐</p>
                                <p><strong>Rate:</strong> $35/night</p>
                                <p><strong>Distance:</strong> 15-minute bus ride</p>
                                <p>Clean and comfortable. Popular with players.</p>
                            </div>
                        </div>
                        `
                    }
                </div>

                <div class="info-card" style="margin-top: 30px;">
                    <h3><i class="fas fa-home"></i> Alternative Accommodation</h3>
                    <p><strong>Airbnb:</strong> Many options available in the area from $30/night</p>
                    <p><strong>Hostels:</strong> Budget options from $20/night in dorms</p>
                    <p><strong>Student Housing:</strong> University dorms available during summer at $25/night</p>
                    <p><strong>Camping:</strong> Campsite 10km from venue, $15/night</p>
                    <p style="margin-top: 15px; color: #718096;">
                        <i class="fas fa-info-circle"></i> Book early for best rates. Group discounts may be available for teams of 5+ players.
                    </p>
                </div>
            </div>

            <!-- Local Info Tab -->
            <div id="local" class="tab-panel">
                <h2><i class="fas fa-city"></i> Local Area Guide</h2>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h3><i class="fas fa-cloud-sun"></i> Weather Forecast</h3>
                        <div class="weather-widget">
                            <div class="weather-temp">
                                ${locationData.weather?.temperature?.min || 18}°C - ${locationData.weather?.temperature?.max || 25}°C
                            </div>
                            <div>${locationData.weather?.condition || 'Partly cloudy'}</div>
                            <div style="margin-top: 10px; font-size: 0.9rem;">
                                ${locationData.weather?.description || 'Comfortable weather expected'}
                            </div>
                        </div>
                        <p style="margin-top: 15px;">
                            <strong>What to bring:</strong> Light jacket for evenings, comfortable walking shoes
                        </p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-utensils"></i> Dining Options</h3>
                        <p><strong>At Venue:</strong> Cafeteria with hot meals ($10-15)</p>
                        <p><strong>Nearby Restaurants:</strong></p>
                        <ul style="margin-left: 20px;">
                            ${locationData.restaurants && locationData.restaurants.length > 0 ?
                                locationData.restaurants.slice(0, 5).map(r => 
                                    `<li><strong>${r.name}</strong> - ${r.cuisine} (${r.walkTime || 'Nearby'})${r.diet ? ` - ${r.diet}` : ''}</li>`
                                ).join('') :
                                `<li>Italian Restaurant - 2 min walk</li>
                                <li>Asian Cuisine - 5 min walk</li>
                                <li>Fast Food - 3 min walk</li>
                                <li>Vegetarian/Vegan - 7 min walk</li>
                                <li>Local Traditional - 10 min walk</li>`
                            }
                        </ul>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-hospital"></i> Emergency Services</h3>
                        <p><strong>Emergency Number:</strong> ${locationData.practical?.emergency?.all || locationData.practical?.emergency?.police || '112/911'}</p>
                        <p><strong>Hospital:</strong> 2 km away (24/7 emergency)</p>
                        <p><strong>Pharmacy:</strong> 500m from venue</p>
                        <p><strong>Medical Center:</strong> 1 km from venue</p>
                        <p><strong>Tournament Doctor:</strong> On-site during playing hours</p>
                        <p style="margin-top: 10px; color: #718096;">
                            <i class="fas fa-info-circle"></i> Medical insurance recommended for all participants
                        </p>
                    </div>
                </div>

                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-camera"></i> Things to Do & See</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
                        ${locationData.attractions && locationData.attractions.length > 0 ?
                            locationData.attractions.map(attr => `
                                <div>
                                    <strong>${attr.name}</strong>
                                    <p style="color: #718096;">${attr.type}${attr.distance ? ` - ${attr.distance.toFixed(1)} km` : ''}</p>
                                </div>
                            `).join('') :
                            `
                            <div>
                                <strong>City Museum</strong>
                                <p style="color: #718096;">History & Culture - 1.5 km</p>
                            </div>
                            <div>
                                <strong>Central Park</strong>
                                <p style="color: #718096;">Recreation - 0.5 km</p>
                            </div>
                            <div>
                                <strong>Historic Old Town</strong>
                                <p style="color: #718096;">Sightseeing - 2.0 km</p>
                            </div>
                            <div>
                                <strong>Shopping District</strong>
                                <p style="color: #718096;">Shopping - 1.2 km</p>
                            </div>
                            <div>
                                <strong>Art Gallery</strong>
                                <p style="color: #718096;">Culture - 1.8 km</p>
                            </div>
                            <div>
                                <strong>Sports Complex</strong>
                                <p style="color: #718096;">Recreation - 2.5 km</p>
                            </div>
                            `
                        }
                    </div>
                </div>

                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-map-marked-alt"></i> Useful Addresses</h3>
                    <p><strong>Tournament Venue:</strong> ${tournament.venue || 'Conference Center'}, ${tournament.location}</p>
                    <p><strong>Tournament Office:</strong> At venue, Room 101</p>
                    <p><strong>Tourist Information:</strong> Main Square, open 9am-6pm</p>
                    <p><strong>Post Office:</strong> 800m from venue</p>
                    <p><strong>Bank/ATM:</strong> 200m from venue</p>
                    <p><strong>Supermarket:</strong> 500m from venue</p>
                </div>
            </div>

            <!-- Practical Info Tab -->
            <div id="practical" class="tab-panel">
                <h2><i class="fas fa-info-circle"></i> Practical Information</h2>
                
                <div class="info-grid">
                    <div class="info-card">
                        <h3><i class="fas fa-language"></i> Language & Communication</h3>
                        <p><strong>Official Language:</strong> ${locationData.practical?.language || 'Local language'}</p>
                        <p><strong>English Proficiency:</strong> Widely spoken in tourist areas</p>
                        <p><strong>Tournament Languages:</strong> English, Local language</p>
                        <p><strong>Useful Phrases:</strong></p>
                        <ul style="margin-left: 20px;">
                            <li>Hello - <em>Local greeting</em></li>
                            <li>Thank you - <em>Local thanks</em></li>
                            <li>Where is...? - <em>Local direction</em></li>
                        </ul>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-plug"></i> Electricity & Connectivity</h3>
                        <p><strong>Voltage:</strong> ${locationData.practical?.electricity?.voltage || '220-240V'}</p>
                        <p><strong>Plug Type:</strong> ${locationData.practical?.electricity?.plug || 'Type C/E/F'}</p>
                        <p><strong>Adapter Needed:</strong> Check based on your country</p>
                        <p><strong>WiFi at Venue:</strong> Free high-speed internet</p>
                        <p><strong>Mobile Coverage:</strong> Excellent 4G/5G coverage</p>
                        <p><strong>SIM Cards:</strong> ${locationData.practical?.sim || 'Available at airport and shops'}</p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-coins"></i> Money Matters</h3>
                        <p><strong>Currency:</strong> ${locationData.practical?.currency?.name || 'Local Currency'} (${locationData.practical?.currency?.code || 'XXX'})</p>
                        <p><strong>Symbol:</strong> ${locationData.practical?.currency?.symbol || '$'}</p>
                        <p><strong>Exchange Rate:</strong> Check current rates</p>
                        <p><strong>ATMs:</strong> Widely available</p>
                        <p><strong>Credit Cards:</strong> Visa, Mastercard widely accepted</p>
                        <p><strong>Tipping:</strong> ${locationData.practical?.tipping || '10% customary in restaurants'}</p>
                    </div>
                </div>

                <div class="info-grid" style="margin-top: 20px;">
                    <div class="info-card">
                        <h3><i class="fas fa-clock"></i> Time & Business Hours</h3>
                        <p><strong>Time Zone:</strong> ${locationData.practical?.timezone || 'UTC+0'}</p>
                        <p><strong>Banks:</strong> Mon-Fri 9:00-17:00</p>
                        <p><strong>Shops:</strong> Mon-Sat 9:00-20:00</p>
                        <p><strong>Restaurants:</strong> 11:00-23:00</p>
                        <p><strong>Pharmacies:</strong> Mon-Sat 8:00-20:00</p>
                        <p><strong>Sunday:</strong> Most shops closed, restaurants open</p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-water"></i> Water & Health</h3>
                        <p><strong>Tap Water:</strong> ${locationData.practical?.water || 'Safe to drink'}</p>
                        <p><strong>Vaccinations:</strong> ${locationData.practical?.health?.vaccinations || 'No special requirements'}</p>
                        <p><strong>Health Insurance:</strong> ${locationData.practical?.health?.insurance || 'Travel insurance recommended'}</p>
                        <p><strong>Pharmacies:</strong> ${locationData.practical?.health?.pharmacy || 'Widely available'}</p>
                        <p><strong>Medical Facilities:</strong> ${locationData.practical?.health?.hospitals || 'Modern facilities available'}</p>
                    </div>

                    <div class="info-card">
                        <h3><i class="fas fa-shield-alt"></i> Safety & Security</h3>
                        <p><strong>General Safety:</strong> Safe tourist destination</p>
                        <p><strong>Emergency Numbers:</strong></p>
                        <ul style="margin-left: 20px;">
                            <li>Police: ${locationData.practical?.emergency?.police || '112/911'}</li>
                            <li>Medical: ${locationData.practical?.emergency?.medical || '112/911'}</li>
                            <li>Fire: ${locationData.practical?.emergency?.fire || '112/911'}</li>
                        </ul>
                        <p><strong>Tourist Police:</strong> Available in city center</p>
                        <p><strong>Venue Security:</strong> 24/7 security at tournament venue</p>
                    </div>
                </div>

                <div class="info-card" style="margin-top: 20px;">
                    <h3><i class="fas fa-exclamation-triangle"></i> Important Notes</h3>
                    <p>• Bring your passport or ID card to the venue</p>
                    <p>• FIDE ID required for participation</p>
                    <p>• Dress code: Smart casual (no shorts in playing hall)</p>
                    <p>• Electronic devices must be switched off in playing area</p>
                    <p>• Smoking is not permitted in the venue</p>
                    <p>• Photography allowed only in designated areas</p>
                    <p>• Spectators welcome with free entry</p>
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
            event.target.closest('.tab-button').classList.add('active');
        }
        
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
        console.error('Error rendering tournament page:', error);
        res.status(500).send('Internal server error');
    }
});

// Calendar homepage
app.get('/', (req, res) => {
    try {
        // Get upcoming tournaments for featured events
        const upcomingTournaments = db.prepare(`
            SELECT id, title, start_datetime, end_datetime, location, format, special
            FROM calendar_events 
            WHERE deleted_at IS NULL 
            AND start_datetime >= date('now')
            ORDER BY start_datetime ASC
            LIMIT 6
        `).all();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2025 Chess Calendar</title>
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
        
        /* Powered by Chessdom button */
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
        
        .event-nav {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 30px;
        }
        
        .event-nav button {
            background: #d4af37;
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.3s ease, transform 0.2s ease;
            font-weight: bold;
        }
        
        .event-nav button:hover {
            background: #b59530;
            transform: translateY(-2px);
        }
        
        .event-nav button:active {
            transform: translateY(0);
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
            transition: all 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
            opacity: 1;
            visibility: visible;
        }

        .theme-toggle.hidden {
            opacity: 0;
            visibility: hidden;
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
        
        body.dark-theme .powered-by:hover {
            background: rgba(0, 0, 0, 0.3);
            color: white;
        }
        
        /* Coming soon badge */
        .coming-soon {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: #d4af37;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        body.dark-theme .coming-soon {
            background-color: #b59530;
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
            
            .powered-by {
                margin-top: 15px;
                font-size: 0.8rem;
            }
        }
        
        @media (max-width: 600px) {
            .events-grid {
                grid-template-columns: 1fr;
            }
            
            .page-header h1 {
                font-size: 2.2rem;
            }
            
            .page-header h1::before,
            .page-header h1::after {
                font-size: 1.5rem;
                margin: 0 8px;
            }
            
            .theme-toggle {
                padding: 6px 12px;
                font-size: 0.9rem;
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body>
    <button class="theme-toggle" id="themeToggle">
        <i class="fas fa-moon"></i>
        <span>Dark Mode</span>
    </button>
    
    <div class="chess-calendar-container">
        <header class="page-header">
            <div class="header-content">
                <h1>The 2025 Chess Calendar</h1>
                <p>All of the information, no more endless searching.</p>
                <a href="https://www.chessdom.com" class="powered-by" target="_blank">
                    <i class="fas fa-chess"></i> Powered by Chessdom
                </a>
            </div>
        </header>
        
        <div class="calendar-grid">
            <a href="/continent/europe" class="calendar-btn" data-category="europe">
                <i class="fas fa-globe-europe"></i>
                <h3>Europe</h3>
            </a>
            
            <a href="/continent/americas" class="calendar-btn" data-category="americas">
                <i class="fas fa-globe-americas"></i>
                <h3>Americas</h3>
            </a>
            
            <a href="/continent/asia" class="calendar-btn" data-category="asia">
                <i class="fas fa-globe-asia"></i>
                <h3>Asia</h3>
            </a>
            
            <a href="/continent/africa" class="calendar-btn" data-category="africa">
                <i class="fas fa-globe-africa"></i>
                <h3>Africa</h3>
            </a>
            
            <a href="/continent/oceania" class="calendar-btn" data-category="oceania">
                <i class="fas fa-earth-oceania"></i>
                <h3>Oceania</h3>
            </a>
            
            <a href="/format/rapid-blitz" class="calendar-btn" data-category="rapid-blitz">
                <i class="fas fa-bolt"></i>
                <h3>Rapid & Blitz</h3>
            </a>
            
            <a href="/category/women" class="calendar-btn" data-category="women">
                <i class="fas fa-chess-queen"></i>
                <h3>Women</h3>
            </a>
            
            <a href="/category/juniors" class="calendar-btn" data-category="juniors">
                <i class="fas fa-chess-pawn"></i>
                <h3>Juniors</h3>
            </a>
            
            <a href="/category/seniors" class="calendar-btn" data-category="seniors">
                <i class="fas fa-chess-king"></i>
                <h3>Seniors</h3>
            </a>
            
            <a href="/category/top-events" class="calendar-btn" data-category="top">
                <i class="fas fa-trophy"></i>
                <h3>Top Events</h3>
            </a>
            
            <a href="/special" class="calendar-btn" data-category="special">
                <i class="fas fa-star"></i>
                <h3>Special Events</h3>
            </a>
            
            <a href="/upcoming" class="calendar-btn" data-category="upcoming">
                <i class="fas fa-calendar"></i>
                <h3>All Upcoming</h3>
            </a>
        </div>
        
        <section class="featured-events">
            <h2>Featured Upcoming Events</h2>
            <div class="events-grid">
                ${upcomingTournaments.map(t => `
                    <div class="event-card">
                        <h3><a href="/t/${generateSlug(t.title)}-${t.id}">${t.title}</a></h3>
                        <p class="event-date">📅 ${formatDateRange(t.start_datetime, t.end_datetime)}</p>
                        <p class="event-location">📍 ${t.location}</p>
                        ${t.format ? `<p>Format: ${t.format}</p>` : ''}
                        ${t.special === 'yes' ? '<p><strong>Special Event</strong></p>' : ''}
                        <a href="/t/${generateSlug(t.title)}-${t.id}" class="event-link">View Details →</a>
                    </div>
                `).join('')}
            </div>
        </section>
        
        <section class="featured-events">
            <h2>More Upcoming Events</h2>
            <div class="calendar-grid">
                <a href="https://www.chessdom.com/uzchess-cup-2025-participants-and-information/" class="calendar-btn" target="_blank">
                    <i class="fas fa-chess-bishop"></i>
                    <h3>UzChess Cup 2025</h3>
                    <span class="event-date">June 18-June 28</span>
                </a>
                
                <a href="https://calendar.chessdom.com/grand-chess-tour-croatia-2025/" class="calendar-btn" target="_blank">
                    <i class="fas fa-chess"></i>
                    <h3>Grand Chess Tour Zagreb</h3>
                    <span class="event-date">June 30 - July 7</span>
                </a>
                
                <a href="https://calendar.chessdom.com/wcf-grand-prix-final/" class="calendar-btn" target="_blank">
                    <i class="fas fa-mountain"></i>
                    <h3>WCF Grand-Prix Final</h3>
                    <span class="event-date">July 9-19</span>
                </a>
                
                <a href="https://calendar.chessdom.com/biel-international-chess-festival-masters-triathlon-2025/" class="calendar-btn" target="_blank">
                    <i class="fas fa-chess-queen"></i>
                    <h3>Biel International Chess Festival</h3>
                    <span class="event-date">July 12-25</span>
                </a>
                
                <a href="https://calendar.chessdom.com/freestyle-chess-grand-slam-tour-2025-new-york/" class="calendar-btn" target="_blank">
                    <i class="fas fa-trophy"></i>
                    <h3>Freestyle Las Vegas</h3>
                    <span class="event-date">July 17-24</span>
                </a>
                
                <a href="https://www.chessdom.com/dole-open-2025/" class="calendar-btn" target="_blank">
                    <i class="fas fa-crown"></i>
                    <h3>Dole Open 2025</h3>
                    <span class="event-date">July 19-27</span>
                </a>
                
                <a href="https://www.chessdom.com/oskemen-open-2025/" class="calendar-btn" target="_blank">
                    <i class="fas fa-chess-queen"></i>
                    <h3>Oskemen Open 2025</h3>
                    <span class="event-date">July 20-30</span>
                </a>
                
                <a href="https://calendar.chessdom.com/esports-world-cup-2025/" class="calendar-btn" target="_blank">
                    <i class="fas fa-globe"></i>
                    <h3>Esports World Cup</h3>
                    <span class="event-date">July 31 - Aug 8</span>
                </a>
                
                <a href="https://turniejszachy.ug.edu.pl/" class="calendar-btn" target="_blank">
                    <i class="fas fa-monument"></i>
                    <h3>University of Gdansk Cup</h3>
                    <span class="event-date">August 1-10</span>
                </a>
                
                <a href="https://www.chessdom.com/quantbox-chennai-grand-masters-chess-2025/" class="calendar-btn" target="_blank">
                    <i class="fas fa-trophy"></i>
                    <h3>Quantbox Grand Masters 2025</h3>
                    <span class="event-date">August 6-15</span>
                </a>
                
                <a href="https://www.vardaris.com/el/" class="calendar-btn" target="_blank">
                    <i class="fas fa-dice"></i>
                    <h3>Agria International Chess Open 2025</h3>
                    <span class="event-date">August 27-31</span>
                </a>
                
                <a href="https://grandswiss2025.fide.com/" class="calendar-btn" target="_blank">
                    <i class="fas fa-crown"></i>
                    <h3>FIDE Grand Swiss 2025</h3>
                    <span class="event-date">September 3-16</span>
                </a>
            </div>
        </section>
        
        <section class="additional-categories featured-events">
            <h2>Other Calendars</h2>
            <div class="additional-grid">
                <a href="https://calendar.chessdom.com/grandmaster-birthdays/" class="calendar-btn" data-category="birthdays">
                    <i class="fas fa-birthday-cake"></i>
                    <h3>The Birthday Calendar</h3>
                </a>
                
                <a href="/national" class="calendar-btn" data-category="national">
                    <i class="fas fa-flag"></i>
                    <h3>National Championships</h3>
                    <span class="coming-soon">Coming Soon</span>
                </a>
                
                <a href="/engine" class="calendar-btn" data-category="engine">
                    <i class="fas fa-microchip"></i>
                    <h3>Engine Events</h3>
                    <span class="coming-soon">Coming Soon</span>
                </a>
                
                <a href="/freestyle" class="calendar-btn" data-category="freestyle">
                    <i class="fas fa-random"></i>
                    <h3>Freestyle Chess</h3>
                    <span class="coming-soon">Coming Soon</span>
                </a>
                
                <a href="/player" class="calendar-btn" data-category="player">
                    <i class="fas fa-user"></i>
                    <h3>Player Calendars</h3>
                    <span class="coming-soon">Coming Soon</span>
                </a>
                
                <a href="/personal" class="calendar-btn" data-category="personal">
                    <i class="fas fa-calendar-alt"></i>
                    <h3>Your Own Calendar</h3>
                    <span class="coming-soon">Coming Soon</span>
                </a>
            </div>
        </section>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Theme toggle functionality
            const themeToggle = document.getElementById('themeToggle');
            const body = document.body;
            const icon = themeToggle.querySelector('i');
            const text = themeToggle.querySelector('span');
            
            // Check for saved theme preference
            const currentTheme = localStorage.getItem('theme') || 'light';
            if (currentTheme === 'dark') {
                body.classList.add('dark-theme');
                icon.classList.replace('fa-moon', 'fa-sun');
                text.textContent = 'Light Mode';
            }
            
            themeToggle.addEventListener('click', function() {
                body.classList.toggle('dark-theme');
                const isDark = body.classList.contains('dark-theme');
                
                if (isDark) {
                    icon.classList.replace('fa-moon', 'fa-sun');
                    text.textContent = 'Light Mode';
                    localStorage.setItem('theme', 'dark');
                } else {
                    icon.classList.replace('fa-sun', 'fa-moon');
                    text.textContent = 'Dark Mode';
                    localStorage.setItem('theme', 'light');
                }
            });
            
            // Scroll event to hide/show theme toggle
            let lastScrollTop = 0;
            
            window.addEventListener('scroll', function() {
                const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                if (currentScrollTop > lastScrollTop && currentScrollTop > 100) {
                    themeToggle.classList.add('hidden');
                } else if (currentScrollTop < lastScrollTop || currentScrollTop < 50) {
                    themeToggle.classList.remove('hidden');
                }
                
                lastScrollTop = currentScrollTop;
            });
            
            // Button hover effects
            const buttons = document.querySelectorAll('.calendar-btn');
            buttons.forEach(button => {
                button.addEventListener('mouseenter', function() {
                    this.style.transitionDelay = '0.1s';
                });
                
                button.addEventListener('mouseleave', function() {
                    this.style.transitionDelay = '0s';
                });
                
                // Ripple effect
                button.addEventListener('click', function(e) {
                    const ripple = document.createElement('span');
                    ripple.className = 'ripple';
                    ripple.style.position = 'absolute';
                    ripple.style.borderRadius = '50%';
                    ripple.style.transform = 'scale(0)';
                    ripple.style.animation = 'ripple 0.6s linear';
                    ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                    
                    const rect = this.getBoundingClientRect();
                    const size = Math.max(rect.width, rect.height);
                    const x = e.clientX - rect.left - size/2;
                    const y = e.clientY - rect.top - size/2;
                    
                    ripple.style.width = ripple.style.height = \`\${size}px\`;
                    ripple.style.left = \`\${x}px\`;
                    ripple.style.top = \`\${y}px\`;
                    
                    this.appendChild(ripple);
                    
                    setTimeout(() => {
                        ripple.remove();
                    }, 600);
                });
            });
            
            // Add ripple effect styles
            const style = document.createElement('style');
            style.textContent = \`
                @keyframes ripple {
                    to {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
            \`;
            document.head.appendChild(style);
        });
    </script>
</body>
</html>`;

        res.send(html);
    } catch (error) {
        console.error('Error rendering homepage:', error);
        res.status(500).send('Internal server error');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'landing-pages-complete' });
});

app.listen(PORT, () => {
    console.log(`Complete landing pages server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}/t/[tournament-slug] to see comprehensive tournament pages`);
});