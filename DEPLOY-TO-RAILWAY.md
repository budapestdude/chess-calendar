# Deploy Your Chess Calendar to Railway

Railway.app provides free hosting with automatic deployments. Your calendar will be accessible worldwide!

## Prerequisites
- GitHub account
- Railway.app account (free)

## Step-by-Step Deployment

### 1. Initialize Git Repository

```bash
cd "/Users/michaelduke/Documents/Calendar Database"

# Initialize git repo
git init

# Add all files
git add .

# Commit
git commit -m "Initial chess calendar project"
```

### 2. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `chess-calendar`
3. Make it **Public** (required for Railway free tier)
4. Don't initialize with README (we already have files)
5. Click "Create repository"

### 3. Push to GitHub

```bash
# Add GitHub as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/chess-calendar.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 4. Deploy to Railway

1. **Sign up**: Go to https://railway.app
2. **Sign in with GitHub**: Click "Login with GitHub"
3. **Create New Project**: Click "New Project"
4. **Deploy from GitHub**: Select "Deploy from GitHub repo"
5. **Select Repository**: Choose `YOUR_USERNAME/chess-calendar`
6. **Deploy**: Click "Deploy Now"

### 5. Configure Environment

1. In Railway dashboard, click your project
2. Go to **Variables** tab
3. Add these environment variables:
   ```
   NODE_ENV=production
   PORT=3000
   ```

### 6. Wait for Deployment

- Railway will automatically:
  - Install dependencies (`npm install`)
  - Run your app (`npm start`)
  - Provide a public URL

- Check **Deployments** tab for progress
- Look for "Build successful" and "Deploy successful"

### 7. Get Your Public URL

1. In Railway dashboard, click **Settings**
2. Scroll to **Domains**
3. Click **Generate Domain**
4. You'll get a URL like: `https://chess-calendar-production.up.railway.app`

## 🎉 Your Calendar is Live!

### Access Your Deployed Calendar:

**Web Interface:**
```
https://your-app-name.up.railway.app
```

**API Endpoints:**
```
https://your-app-name.up.railway.app/api/events
https://your-app-name.up.railway.app/api/events/upcoming
https://your-app-name.up.railway.app/api/stats
```

**Calendar Subscription (iCal):**
```
https://your-app-name.up.railway.app/api/events.ics
```

## Update Your Calendar Apps

### Apple Calendar:
1. Calendar → File → New Calendar Subscription
2. Enter: `https://your-app-name.up.railway.app/api/events.ics`

### Google Calendar:
1. Settings → Add Calendar → From URL
2. Enter: `https://your-app-name.up.railway.app/api/events.ics`

## Making Updates

Every time you update your calendar:

```bash
# Make changes to your files
# Then push to GitHub:

git add .
git commit -m "Updated calendar data"
git push

# Railway automatically redeploys!
```

## Custom Domain (Optional)

1. In Railway dashboard: **Settings** → **Domains**
2. Click **Custom Domain**
3. Enter your domain (e.g., `chesscalendar.yourdomain.com`)
4. Update DNS at your domain provider:
   ```
   CNAME chesscalendar your-app-name.up.railway.app
   ```

## Monitoring Your App

### Railway Dashboard:
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: History of all deployments

### Check if it's working:
```bash
curl https://your-app-name.up.railway.app/health
```
Should return: `{"status":"healthy","database":"connected"}`

## Troubleshooting

### Build Failed?
- Check **Deployments** tab for error logs
- Common issues:
  - Missing `"start"` script in package.json ✅ (we added this)
  - Node.js version mismatch
  - Missing dependencies

### App Not Starting?
- Check **Logs** tab
- Verify environment variables are set
- Ensure PORT environment variable is used

### Database Issues?
- SQLite database is included in deployment
- File path is automatically handled by our code
- Data persists between deployments

## Free Tier Limits

Railway free tier includes:
- ✅ **512 MB RAM** - Perfect for your calendar
- ✅ **1 GB Disk** - Your database is only ~2MB
- ✅ **Automatic SSL** - HTTPS enabled
- ✅ **Custom domains** - Use your own domain
- ✅ **GitHub integration** - Auto-deploy on push

## Example Full URLs

After deployment, replace `your-app-name.up.railway.app` with your actual URL:

```
Web Interface:
https://chess-calendar-production.up.railway.app

Add New Tournament:
https://chess-calendar-production.up.railway.app (click "Single Event" tab)

Bulk CSV Upload:
https://chess-calendar-production.up.railway.app (click "Bulk Upload" tab)

Calendar Subscription:
https://chess-calendar-production.up.railway.app/api/events.ics

API Examples:
https://chess-calendar-production.up.railway.app/api/events/upcoming
https://chess-calendar-production.up.railway.app/api/players/search?name=Carlsen
https://chess-calendar-production.up.railway.app/api/events?continent=Europe
```

## Security Note

Your calendar is public but read-only by default. Only you can:
- Access the web interface to add/edit events
- Upload CSV files
- Modify tournament data

Anyone can:
- View tournaments via API
- Subscribe to calendar feeds
- Search for events

## Need Help?

If something goes wrong:
1. Check Railway logs in the dashboard
2. Verify your GitHub repository has all files
3. Ensure package.json has correct start script
4. Check that calendar.db file is included in git

## What's Next?

After deployment:
1. **Share your calendar**: Give the public URL to chess communities
2. **Add authentication**: Protect admin functions if needed  
3. **Monitor usage**: Watch Railway metrics
4. **Add more data**: Use the CSV upload feature
5. **Integrate everywhere**: Use the API in your apps

Your chess calendar is now available to the world! 🌍♟️