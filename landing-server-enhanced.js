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

// Enhanced route with real location data
app.get('/tournament/:id/enhanced', async (req, res) => {
    try {
        const tournament = db.prepare(`
            SELECT * FROM calendar_events 
            WHERE id = ? AND deleted_at IS NULL
        `).get(req.params.id);

        if (!tournament) {
            return res.status(404).send('Tournament not found');
        }

        // Fetch real location data
        console.log(`Fetching location data for: ${tournament.location}`);
        const locationData = await locationService.getLocationData(
            tournament.location, 
            tournament.start_datetime.split(' ')[0],
            tournament.end_datetime.split(' ')[0]
        );

        // Generate time control based on format
        const timeControl = tournament.format === 'rapid' ? '15+10' : 
                           tournament.format === 'blitz' ? '3+2' : 
                           tournament.format === 'classical' ? '90+30' : '25+10';

        // Render enhanced page with real data
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tournament.title} - ${formatDateRange(tournament.start_datetime, tournament.end_datetime)}</title>
    <meta name="description" content="${tournament.title} in ${tournament.location}. ${tournament.format || 'Chess'} tournament with real-time location info.">
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
        }
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 60px 20px 40px;
            text-align: center;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        .content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 30px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .card h2 {
            color: #2d3748;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        .card h3 {
            color: #4a5568;
            margin: 15px 0 10px;
        }
        .info-item {
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .info-label {
            font-weight: 600;
            color: #718096;
            display: inline-block;
            width: 120px;
        }
        .weather-display {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin: 20px 0;
        }
        .weather-temp {
            font-size: 3rem;
            font-weight: bold;
        }
        .hotel-item, .restaurant-item {
            padding: 15px;
            margin: 10px 0;
            background: #f7fafc;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .attraction-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .attraction-item {
            padding: 12px;
            background: #f0f4ff;
            border-radius: 8px;
            text-align: center;
        }
        .transport-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .transport-card {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 10px 10px 10px 0;
            transition: all 0.3s;
        }
        .btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        .loading {
            color: #718096;
            font-style: italic;
        }
        @media (max-width: 768px) {
            .content-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="hero">
        <div class="container">
            <h1>${tournament.title}</h1>
            <p style="font-size: 1.2rem; margin-top: 10px;">
                📅 ${formatDateRange(tournament.start_datetime, tournament.end_datetime)} | 
                📍 ${tournament.location}
                ${locationData.coordinates ? ` (${locationData.coordinates.country || ''})` : ''}
            </p>
            ${tournament.format ? `<p>Format: ${tournament.format.toUpperCase()} | Time Control: ${timeControl}</p>` : ''}
        </div>
    </div>

    <div class="container">
        <div class="content-grid">
            <!-- Tournament Info -->
            <div class="card">
                <h2>📋 Tournament Details</h2>
                <div class="info-item">
                    <span class="info-label">Venue:</span>
                    <span>${tournament.venue || 'Conference Center'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Location:</span>
                    <span>${locationData.coordinates?.display_name || tournament.location}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Rounds:</span>
                    <span>${tournament.rounds || '9'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Prize Fund:</span>
                    <span>${tournament.prize_fund || 'TBA'}</span>
                </div>
                ${tournament.players ? `
                <div class="info-item">
                    <span class="info-label">Players:</span>
                    <span>${tournament.players}</span>
                </div>
                ` : ''}
                
                <div style="margin-top: 20px;">
                    ${tournament.url ? `<a href="${tournament.url}" class="btn" target="_blank">Official Website</a>` : ''}
                    ${tournament.landing ? `<a href="${tournament.landing}" class="btn" target="_blank">Register</a>` : ''}
                    <a href="${API_URL}/api/events/${tournament.id}/ics" class="btn">Add to Calendar</a>
                </div>
            </div>

            <!-- Weather -->
            <div class="card">
                <h2>🌤️ Weather Forecast</h2>
                <div class="weather-display">
                    <div class="weather-temp">
                        ${locationData.weather?.temperature?.min || 15}° - ${locationData.weather?.temperature?.max || 22}°C
                    </div>
                    <div>${locationData.weather?.condition || 'Variable conditions'}</div>
                    <div style="margin-top: 10px; font-size: 0.9rem;">
                        ${locationData.weather?.description || 'Check forecast closer to event date'}
                    </div>
                </div>
                
                <h3>📍 Location Info</h3>
                ${locationData.coordinates ? `
                <div class="info-item">
                    <span class="info-label">City:</span>
                    <span>${locationData.coordinates.city || tournament.location}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Country:</span>
                    <span>${locationData.coordinates.country || 'N/A'}</span>
                </div>
                ` : '<p class="loading">Location details loading...</p>'}
            </div>

            <!-- Hotels -->
            <div class="card">
                <h2>🏨 Recommended Hotels</h2>
                ${locationData.hotels && locationData.hotels.length > 0 ? 
                    locationData.hotels.map(hotel => `
                        <div class="hotel-item">
                            <strong>${hotel.name}</strong>
                            ${hotel.stars ? `<span style="color: #f6ad55;"> ${'⭐'.repeat(hotel.stars)}</span>` : ''}
                            <div style="color: #718096; margin-top: 5px;">
                                ${hotel.priceRange || 'Price varies'} | 
                                ${hotel.distance || 'City center'}
                                ${hotel.website ? ` | <a href="${hotel.website}" target="_blank">Website</a>` : ''}
                            </div>
                            ${hotel.description ? `<div style="margin-top: 5px;">${hotel.description}</div>` : ''}
                        </div>
                    `).join('') :
                    '<p class="loading">Searching for nearby hotels...</p>'
                }
            </div>

            <!-- Restaurants -->
            <div class="card">
                <h2>🍽️ Nearby Restaurants</h2>
                ${locationData.restaurants && locationData.restaurants.length > 0 ?
                    locationData.restaurants.map(rest => `
                        <div class="restaurant-item">
                            <strong>${rest.name}</strong>
                            <div style="color: #718096;">
                                ${rest.cuisine} | ${rest.walkTime || 'Nearby'}
                                ${rest.diet ? ` | ${rest.diet}` : ''}
                            </div>
                        </div>
                    `).join('') :
                    '<p class="loading">Finding local dining options...</p>'
                }
            </div>

            <!-- Transportation -->
            <div class="card">
                <h2>✈️ Transportation</h2>
                
                ${locationData.transportation ? `
                <div class="transport-info">
                    <div class="transport-card">
                        <h3>✈️ Airport</h3>
                        <p><strong>${locationData.transportation.airport?.name || 'International Airport'}</strong></p>
                        <p>${locationData.transportation.airport?.distance || '20-30 km from venue'}</p>
                        ${locationData.transportation.airport?.transport ? 
                            `<ul style="margin-top: 10px; margin-left: 20px;">
                                ${locationData.transportation.airport.transport.map(t => `<li>${t}</li>`).join('')}
                            </ul>` : ''
                        }
                    </div>
                    
                    <div class="transport-card">
                        <h3>🚇 Public Transport</h3>
                        ${locationData.transportation.publicTransport?.types ? 
                            `<p>${locationData.transportation.publicTransport.types.join(', ')}</p>` : ''
                        }
                        <p>${locationData.transportation.publicTransport?.ticketing || 'Various ticket options'}</p>
                        ${locationData.transportation.publicTransport?.apps ? 
                            `<p><strong>Apps:</strong> ${locationData.transportation.publicTransport.apps.join(', ')}</p>` : ''
                        }
                    </div>
                    
                    <div class="transport-card">
                        <h3>🚕 Taxi & Ride-sharing</h3>
                        <p>${locationData.transportation.taxi?.available || 'Available'}</p>
                        ${locationData.transportation.taxi?.apps ? 
                            `<p><strong>Apps:</strong> ${locationData.transportation.taxi.apps.join(', ')}</p>` : ''
                        }
                        <p>${locationData.transportation.taxi?.tip || ''}</p>
                    </div>
                </div>
                ` : '<p class="loading">Loading transportation info...</p>'}
            </div>

            <!-- Local Attractions -->
            <div class="card">
                <h2>🎭 Things to Do</h2>
                ${locationData.attractions && locationData.attractions.length > 0 ? `
                    <div class="attraction-grid">
                        ${locationData.attractions.map(attr => `
                            <div class="attraction-item">
                                <strong>${attr.name}</strong>
                                <div style="color: #718096; font-size: 0.9rem;">
                                    ${attr.type}
                                    ${attr.distance ? ` - ${attr.distance.toFixed(1)} km` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="loading">Discovering local attractions...</p>'}
            </div>

            <!-- Practical Info -->
            <div class="card">
                <h2>ℹ️ Practical Information</h2>
                ${locationData.practical ? `
                    <div class="info-item">
                        <span class="info-label">Currency:</span>
                        <span>${locationData.practical.currency?.name || 'Local currency'} (${locationData.practical.currency?.code || 'N/A'})</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Language:</span>
                        <span>${locationData.practical.language || 'Local language'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Timezone:</span>
                        <span>${locationData.practical.timezone || 'Local time'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Emergency:</span>
                        <span>${locationData.practical.emergency?.all || locationData.practical.emergency?.police || '112/911'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Electricity:</span>
                        <span>${locationData.practical.electricity?.voltage || '220V'}, ${locationData.practical.electricity?.plug || 'Check adapter needs'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Water:</span>
                        <span>${locationData.practical.water || 'Check local advice'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Tipping:</span>
                        <span>${locationData.practical.tipping || '10% customary'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">SIM Cards:</span>
                        <span>${locationData.practical.sim || 'Available at airport'}</span>
                    </div>
                ` : '<p class="loading">Loading practical information...</p>'}
            </div>

            <!-- Additional Info -->
            <div class="card">
                <h2>📝 Additional Information</h2>
                <h3>Visa Requirements</h3>
                ${locationData.practical?.visa ? `
                    <p>${locationData.practical.visa.requirement}</p>
                    <p>${locationData.practical.visa.invitation}</p>
                    <p><strong>Processing time:</strong> ${locationData.practical.visa.processing}</p>
                ` : '<p>Check visa requirements for your nationality</p>'}
                
                <h3 style="margin-top: 20px;">Health & Safety</h3>
                ${locationData.practical?.health ? `
                    <p>${locationData.practical.health.hospitals}</p>
                    <p>${locationData.practical.health.pharmacy}</p>
                    <p><strong>Insurance:</strong> ${locationData.practical.health.insurance}</p>
                ` : '<p>Modern medical facilities available</p>'}
                
                <h3 style="margin-top: 20px;">Driving</h3>
                ${locationData.transportation?.driving ? `
                    <p><strong>Driving side:</strong> ${locationData.transportation.driving.side}</p>
                    <p><strong>Parking:</strong> ${locationData.transportation.driving.parking}</p>
                    <p><strong>Car rental:</strong> ${locationData.transportation.driving.rental}</p>
                ` : '<p>Check local driving regulations</p>'}
            </div>
        </div>

        <div style="text-align: center; margin: 40px 0; color: #718096;">
            <p>Information automatically generated based on tournament location.</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error rendering enhanced tournament page:', error);
        res.status(500).send('Error loading tournament information');
    }
});

// Regular tournament route (redirects to enhanced)
app.get('/tournament/:id', (req, res) => {
    res.redirect(`/tournament/${req.params.id}/enhanced`);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'landing-pages-enhanced' });
});

app.listen(PORT, () => {
    console.log(`Enhanced landing pages server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}/tournament/[id]/enhanced for location-aware pages`);
});