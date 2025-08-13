// API Configuration
const API_URL = 'http://localhost:3000/api';
let currentTab = 'upcoming';
let allEvents = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadEvents();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Form submission
    document.getElementById('addEventForm').addEventListener('submit', handleFormSubmit);
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
    
    // Filter changes
    document.getElementById('continentFilter').addEventListener('change', loadEvents);
    document.getElementById('formatFilter').addEventListener('change', loadEvents);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const eventData = {};
    
    // Convert form data to object
    for (let [key, value] of formData.entries()) {
        if (value) eventData[key] = value;
    }
    
    // Format dates
    if (eventData.start_date) {
        eventData.start_datetime = eventData.start_date + ' 00:00:00';
        delete eventData.start_date;
    }
    
    if (eventData.end_date) {
        eventData.end_datetime = eventData.end_date + ' 00:00:00';
        delete eventData.end_date;
    } else {
        eventData.end_datetime = eventData.start_datetime;
    }
    
    // Convert rounds to number
    if (eventData.rounds) {
        eventData.rounds = parseInt(eventData.rounds);
    }
    
    try {
        const response = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });
        
        if (response.ok) {
            showMessage('successMessage', 'Tournament added successfully!');
            e.target.reset();
            loadEvents();
            loadStats();
        } else {
            showMessage('errorMessage', 'Error adding tournament. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('errorMessage', 'Connection error. Is the API server running?');
    }
}

// Load and display events
async function loadEvents() {
    const continent = document.getElementById('continentFilter').value;
    const format = document.getElementById('formatFilter').value;
    
    let url = `${API_URL}/events?limit=50`;
    
    if (currentTab === 'upcoming') {
        const today = new Date().toISOString().split('T')[0];
        url += `&start_date=${today}`;
    }
    
    if (continent) url += `&continent=${continent}`;
    if (format) url += `&format=${format}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.data) {
            allEvents = data.data;
            displayEvents(allEvents);
        }
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('eventsList').innerHTML = 
            '<div class="error-message">Error loading events. Please make sure the API server is running.</div>';
    }
}

// Display events in the list
function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (!events || events.length === 0) {
        eventsList.innerHTML = '<div class="loading">No events found</div>';
        return;
    }
    
    const eventsHTML = events.map(event => {
        const startDate = formatDate(event.start_datetime);
        const endDate = formatDate(event.end_datetime);
        const dateStr = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        
        return `
            <div class="event-item">
                <div class="event-title">${event.title}</div>
                <div class="event-details">
                    <div class="event-date">📅 ${dateStr}</div>
                    ${event.location ? `<div>📍 ${event.location}</div>` : ''}
                    ${event.format ? `<div>🎯 ${event.format}</div>` : ''}
                    ${event.continent ? `<div>🌍 ${event.continent}</div>` : ''}
                    ${event.players ? `<div>👥 ${event.players.substring(0, 100)}...</div>` : ''}
                    ${event.url ? `<div>🔗 <a href="${event.url}" target="_blank">Tournament Website</a></div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    eventsList.innerHTML = eventsHTML;
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        document.getElementById('totalEvents').textContent = stats.total_events || '0';
        
        // Calculate upcoming events
        const today = new Date().toISOString().split('T')[0];
        const upcomingResponse = await fetch(`${API_URL}/events?start_date=${today}&limit=1000`);
        const upcomingData = await upcomingResponse.json();
        document.getElementById('upcomingEvents').textContent = upcomingData.pagination?.total || '0';
        
        // Count continents
        const continents = stats.by_continent?.length || 0;
        document.getElementById('continents').textContent = continents;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Search functionality
async function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    
    if (!searchTerm) {
        loadEvents();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/events?search=${encodeURIComponent(searchTerm)}&limit=50`);
        const data = await response.json();
        
        if (data.data) {
            displayEvents(data.data);
        }
    } catch (error) {
        console.error('Error searching:', error);
    }
}

// Switch tabs
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide search section
    const searchSection = document.getElementById('searchSection');
    if (tab === 'search') {
        searchSection.style.display = 'block';
        document.getElementById('filterSection').style.display = 'none';
    } else {
        searchSection.style.display = 'none';
        document.getElementById('filterSection').style.display = 'flex';
    }
    
    // Load appropriate events
    if (tab === 'search') {
        document.getElementById('eventsList').innerHTML = '<div class="loading">Enter a search term...</div>';
    } else {
        loadEvents();
    }
}

// Switch between single event and bulk upload
function switchUploadMode(mode) {
    const bulkSection = document.getElementById('bulkUploadSection');
    const singleSection = document.getElementById('singleEventSection');
    const buttons = document.querySelectorAll('.tabs .tab-button');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (mode === 'bulk') {
        bulkSection.style.display = 'block';
        singleSection.style.display = 'none';
        buttons[1].classList.add('active');
    } else {
        bulkSection.style.display = 'none';
        singleSection.style.display = 'block';
        buttons[0].classList.add('active');
    }
}

// Parse CSV text to array of objects
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    // Get headers and normalize them
    const headers = lines[0].split(',').map(h => h.trim());
    const events = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        // Parse CSV line handling quoted values
        for (let char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        // Create event object
        const event = {};
        headers.forEach((header, index) => {
            event[header] = values[index] || '';
        });
        
        if (event.Name || event.title) {
            events.push(event);
        }
    }
    
    return events;
}

// Handle CSV file upload
async function handleCSVUpload() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a CSV file');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const csvText = e.target.result;
        const events = parseCSV(csvText);
        
        if (events.length === 0) {
            alert('No valid events found in CSV');
            return;
        }
        
        // Show progress
        document.getElementById('uploadProgress').style.display = 'block';
        document.getElementById('uploadStatus').textContent = `Processing ${events.length} events...`;
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // Process events in batches
        const batchSize = 10;
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, Math.min(i + batchSize, events.length));
            const promises = batch.map(async (event) => {
                try {
                    // Map CSV columns to API fields
                    const eventData = {
                        title: event.Name || event.title || 'Untitled Event',
                        location: event.Location || event.location || '',
                        url: event.URL || event.url || '',
                        event_type: event.Type || event.event_type || '',
                        format: event.Format || event.format || '',
                        continent: event.Continent || event.continent || '',
                        category: event.Category || event.category || '',
                        players: event.Players || event.players || '',
                        description: event.Description || event.description || '',
                        venue: event.Venue || event.venue || '',
                        prize_fund: event['Prize Fund'] || event.prize_fund || '',
                        special: event.Special || event.special || '',
                        live_games: event['Live games'] || event.live_games || '',
                        landing: event.Landing || event.landing || ''
                    };
                    
                    // Parse dates
                    const startDate = parseDate(event['Start date'] || event.start_date);
                    const endDate = parseDate(event['End date'] || event.end_date);
                    
                    if (!startDate) {
                        throw new Error(`Invalid start date for "${eventData.title}"`);
                    }
                    
                    if (!eventData.url) {
                        throw new Error(`Missing URL for "${eventData.title}"`);
                    }
                    
                    eventData.start_datetime = startDate + ' 00:00:00';
                    eventData.end_datetime = (endDate || startDate) + ' 00:00:00';
                    
                    // Parse rounds
                    if (event.Rounds || event.rounds) {
                        eventData.rounds = parseInt(event.Rounds || event.rounds);
                    }
                    
                    // Send to API
                    const response = await fetch(`${API_URL}/events`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(eventData)
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                        throw new Error('API error');
                    }
                } catch (error) {
                    errorCount++;
                    errors.push(`${event.Name || event.title}: ${error.message}`);
                }
            });
            
            await Promise.all(promises);
            
            // Update progress
            const progress = Math.round(((i + batch.length) / events.length) * 100);
            document.getElementById('progressBar').style.width = progress + '%';
            document.getElementById('uploadStatus').textContent = 
                `Processed ${i + batch.length} of ${events.length} events...`;
        }
        
        // Show results
        let message = `Upload complete! Successfully added ${successCount} events.`;
        if (errorCount > 0) {
            message += ` Failed: ${errorCount} events.`;
            if (errors.length <= 5) {
                message += '\nErrors:\n' + errors.join('\n');
            }
        }
        
        document.getElementById('uploadStatus').textContent = message;
        
        if (successCount > 0) {
            loadEvents();
            loadStats();
            setTimeout(() => {
                document.getElementById('uploadProgress').style.display = 'none';
                document.getElementById('progressBar').style.width = '0%';
                fileInput.value = '';
            }, 3000);
        }
    };
    
    reader.readAsText(file);
}

// Parse date from various formats
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle dates like "January 2" by adding current or next year
    const months = {
        'January': '01', 'February': '02', 'March': '03', 'April': '04',
        'May': '05', 'June': '06', 'July': '07', 'August': '08',
        'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    
    // Match patterns like "January 2" or "January 10"
    const match = dateStr.match(/^(\w+)\s+(\d+)$/);
    if (match) {
        const month = months[match[1]];
        const day = match[2].padStart(2, '0');
        if (month) {
            const currentYear = new Date().getFullYear();
            return `${currentYear}-${month}-${day}`;
        }
    }
    
    // Try parsing as standard date
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {}
    
    return null;
}

// Utility functions
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}