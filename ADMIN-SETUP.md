# Admin Panel Setup Guide

## Local Development

1. Access the admin panel at: http://localhost:3000/admin
2. Use the default token: `your-secret-admin-token-2025`
3. Enter the token in the yellow authentication box and click "Authenticate"

## Production (Railway)

### Setting a Custom Admin Token

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the "Variables" tab
4. Add a new environment variable:
   - Key: `ADMIN_TOKEN`
   - Value: Your secure token (e.g., a long random string)
5. Railway will automatically redeploy with the new token

### Accessing the Admin Panel

1. Go to: https://chess-calendar-production.up.railway.app/admin
2. Enter your custom admin token (the one you set in Railway)
3. Click "Authenticate"

## Features

Once authenticated, you can:

- **View Events**: See all tournaments with sortable columns
- **Add Event**: Create new tournament entries
- **Edit Event**: Modify existing tournaments
- **Delete Event**: Remove tournaments (soft delete by default)
- **Search**: Filter events by text search
- **Sort**: Click any column header to sort

## Security Notes

- Never use the default token in production
- Use a strong, unique token (minimum 20 characters recommended)
- The token is stored as an environment variable, not in code
- All write operations (add/edit/delete) require authentication
- Read operations are public by default

## Troubleshooting

If you get "Unauthorized" errors:
1. Make sure you've entered the correct token
2. Check that the token matches your ADMIN_TOKEN environment variable
3. Try refreshing the page and re-authenticating