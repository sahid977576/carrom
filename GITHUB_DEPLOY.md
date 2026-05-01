# 🚀 FREE Deployment Guide - GitHub + Render

## 📋 Overview

This guide walks you through deploying your Carrom Pool game **completely free** using:
- **GitHub Pages** → Frontend (HTML/CSS/JS) - FREE forever
- **Render.com** → Backend (Node.js + Socket.io) - FREE tier
- **GitHub Actions** → Auto-deployment on every push

---

## 🛠️ Step 1: Prepare Your Repository

### 1.1 Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Name it `carrom-pool` (or any name)
3. Make it **Public** (required for free GitHub Pages)
4. Click **Create repository**

### 1.2 Push Your Code
```bash
# Navigate to your project
cd /mnt/agents/output/carrom-game

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Carrom Pool game"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/carrom-pool.git

# Push
git push -u origin main
```

---

## 🌐 Step 2: Deploy Backend to Render (FREE)

### 2.1 Sign Up
1. Go to [render.com](https://render.com)
2. Click **Get Started for Free**
3. Sign up with your **GitHub account**

### 2.2 Create Web Service
1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `carrom-pool-server`
   - **Runtime**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node server.js`
   - **Plan**: Free

### 2.3 Add Environment Variables
Click **Environment** tab and add:
```
NODE_ENV = production
CORS_ORIGIN = https://YOUR_USERNAME.github.io/carrom-pool
```
*(Replace YOUR_USERNAME with your actual GitHub username)*

### 2.4 Deploy
Click **Create Web Service**

Render will give you a URL like:
```
https://carrom-pool-server.onrender.com
```

**⚠️ Important**: Copy this URL! You'll need it for the frontend.

---

## 📄 Step 3: Update Frontend with Backend URL

### 3.1 Edit client/js/game.js
Find this line:
```javascript
const serverUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    : 'https://carrom-pool-server.onrender.com';
```

Replace `https://carrom-pool-server.onrender.com` with your actual Render URL.

### 3.2 Commit and Push
```bash
git add client/js/game.js
git commit -m "Update backend URL"
git push
```

---

## 🚀 Step 4: Deploy Frontend to GitHub Pages (FREE)

### 4.1 Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Select **main** branch and **/ (root)** folder
5. Click **Save**

### 4.2 Wait for Deployment
- GitHub will build and deploy your site
- This takes 1-2 minutes
- Your URL will be: `https://YOUR_USERNAME.github.io/carrom-pool`

### 4.3 Verify
Visit your GitHub Pages URL. You should see the game menu!

---

## 🔄 Step 5: Auto-Deployment (Optional but Recommended)

### 5.1 Get Render Deploy Hook
1. In Render dashboard, go to your service
2. Click **Settings** → **Deploy Hook**
3. Copy the URL

### 5.2 Add to GitHub Secrets
1. In GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `RENDER_DEPLOY_HOOK_URL`
4. Value: Your Render deploy hook URL
5. Click **Add secret**

Now every push to main will auto-deploy both frontend and backend!

---

## 🎮 Step 6: Test Your Game

### Test Offline Mode
1. Visit your GitHub Pages URL
2. Click **Play Offline** → **vs Computer**
3. Game should work without backend

### Test Online Mode
1. Open game in two different browsers (or incognito)
2. Both click **Play Online** → **Quick Match**
3. They should match and play together!

---

## 📊 Free Tier Limits (2026)

| Service | Free Tier | Limitations |
|---------|-----------|-------------|
| **GitHub Pages** | Unlimited | 1GB repo, 100GB bandwidth/month |
| **Render** | 750 hrs/month | Sleeps after 15 min inactivity, wakes in ~1 min |
| **Socket.io** | Unlimited | Through your Render server |

**💡 Tip**: Render free tier sleeps after 15 minutes of no activity. First visitor waits ~1 minute for server to wake up. For always-on, upgrade to $7/month.

---

## 🔧 Alternative Free Backends

If Render doesn't work for you, try these:

### Option A: Railway (Free $5 credit)
1. Go to [railway.app](https://railway.app)
2. Deploy from GitHub
3. Add environment variables
4. Generate domain

### Option B: Glitch (Always free, but sleeps)
1. Go to [glitch.com](https://glitch.com)
2. Import from GitHub
3. Good for prototyping, sleeps after 5 min

### Option C: Fly.io (Free allowance)
1. Install flyctl
2. Run `fly launch`
3. Requires credit card (won't charge if under limit)

---

## 🐛 Troubleshooting

### "Cannot connect to server"
- Check if Render service is running (green dot)
- Verify CORS_ORIGIN matches your GitHub Pages URL exactly
- Check browser console for CORS errors

### "Game loads but online doesn't work"
- Make sure backend URL in game.js is correct
- Check if Socket.io is connecting (network tab)
- Verify both players use HTTPS (not HTTP)

### "Render deployment failed"
- Check build logs in Render dashboard
- Ensure package.json has all dependencies
- Verify server.js has no syntax errors

### "GitHub Pages 404"
- Make sure repo is public
- Check if index.html is in root
- Wait 2-3 minutes after first push

---

## 🎨 Custom Domain (Optional)

Want `carrom.yourdomain.com` instead of GitHub's URL?

1. Buy domain from Namecheap/DCloudflare (~$10/year)
2. In GitHub Pages settings, add custom domain
3. Add CNAME record pointing to `YOUR_USERNAME.github.io`
4. In Render, add custom domain to CORS_ORIGIN

---

## 📈 Next Steps

Once deployed, you can:
- Add MongoDB for persistent stats (MongoDB Atlas free tier)
- Add user authentication (Auth0 free tier)
- Add leaderboards
- Create tournaments

---

**🎉 Congratulations! Your Carrom Pool game is now live and free!**

Questions? Check the main README.md or open an issue on GitHub.
