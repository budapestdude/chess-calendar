#!/bin/bash

# Chess Calendar Railway Deployment Script
echo "🚀 Deploying Chess Calendar to Railway..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git not initialized. Run 'git init' first."
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Adding new changes..."
    git add .
    
    echo "Enter commit message (or press Enter for default):"
    read commit_message
    
    if [ -z "$commit_message" ]; then
        commit_message="Update chess calendar data"
    fi
    
    git commit -m "$commit_message"
fi

# Check if remote origin exists
if ! git remote | grep -q "origin"; then
    echo "❌ GitHub remote not configured."
    echo "Please follow these steps:"
    echo "1. Create a GitHub repository at https://github.com/new"
    echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/chess-calendar.git"
    echo "3. Run this script again"
    exit 1
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Pushed to GitHub!"
echo ""
echo "🌐 Next steps:"
echo "1. Go to https://railway.app"
echo "2. Click 'New Project'"
echo "3. Select 'Deploy from GitHub repo'"
echo "4. Choose your chess-calendar repository"
echo "5. Click 'Deploy Now'"
echo ""
echo "📋 After deployment, add these environment variables in Railway:"
echo "   NODE_ENV=production"
echo "   PORT=3000"
echo ""
echo "🎉 Your calendar will be available at: https://your-app-name.up.railway.app"
echo ""
echo "📖 Full guide: See DEPLOY-TO-RAILWAY.md"