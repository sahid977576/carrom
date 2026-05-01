#!/bin/bash
# 🚀 Quick Deploy Script for Carrom Pool
# Run this after setting up GitHub repo and Render account

echo "🎯 Carrom Pool Deployment Script"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initializing Git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit"
fi

# Check remote
if ! git remote get-url origin > /dev/null 2>&1; then
    echo -e "${YELLOW}Please enter your GitHub repository URL:${NC}"
    read repo_url
    git remote add origin $repo_url
fi

# Push to GitHub
echo -e "${YELLOW}Pushing to GitHub...${NC}"
git add .
git commit -m "Update for deployment" || true
git push origin main

echo -e "${GREEN}✅ Code pushed to GitHub!${NC}"
echo ""
echo "Next steps:"
echo "1. Go to https://github.com/YOUR_USERNAME/carrom-pool/settings/pages"
echo "2. Enable GitHub Pages (Source: Deploy from a branch → main)"
echo "3. Go to https://render.com and create new Web Service"
echo "4. Add environment variable: CORS_ORIGIN = your GitHub Pages URL"
echo "5. Update client/js/game.js with your Render URL"
echo ""
echo -e "${GREEN}🎮 Your game will be live at: https://YOUR_USERNAME.github.io/carrom-pool${NC}"
