# 🚀 Deployment Guide

## 📦 Project Structure

```
carrom-game/
├── server/
│   ├── server.js          # Main server file
│   ├── package.json       # Dependencies
│   └── .env.example       # Environment variables template
│
├── client/
│   ├── index.html         # Main game page
│   ├── how-to-play.html   # Rules page
│   ├── css/
│   │   └── style.css      # Styles
│   └── js/
│       ├── game.js        # Game controller
│       ├── physics.js     # Physics engine
│       └── bot.js         # AI opponent
│
├── .gitignore
└── README.md
```

## 🖥️ Local Development

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start Server
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

### 3. Access Game
Open browser and navigate to:
- Game: `http://localhost:3000`
- Rules: `http://localhost:3000/how-to-play.html`

## 🌐 Production Deployment Options

### Option 1: Heroku (Recommended for beginners)

1. **Install Heroku CLI** and login:
```bash
heroku login
```

2. **Create Heroku app**:
```bash
heroku create your-carrom-game
```

3. **Add Procfile** in server/ directory:
```
web: node server.js
```

4. **Deploy**:
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

5. **Open app**:
```bash
heroku open
```

### Option 2: Railway

1. Go to [Railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables (PORT=3000)
4. Deploy automatically

### Option 3: Render

1. Go to [Render.com](https://render.com)
2. Create new Web Service
3. Connect repository
4. Set build command: `cd server && npm install`
5. Set start command: `cd server && npm start`
6. Deploy

### Option 4: VPS (DigitalOcean, AWS, etc.)

1. **SSH into server**:
```bash
ssh user@your-server-ip
```

2. **Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Clone repository**:
```bash
git clone <your-repo-url>
cd carrom-game/server
```

4. **Install and start**:
```bash
npm install
npm start
```

5. **Setup PM2 for process management**:
```bash
sudo npm install -g pm2
pm2 start server.js --name carrom-game
pm2 startup
pm2 save
```

6. **Setup Nginx reverse proxy**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 Environment Variables

Create `.env` file in server/ directory:

```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

## 📱 Mobile Deployment

### Progressive Web App (PWA)

Add to `client/index.html` head:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#1A1A2E">
```

Create `client/manifest.json`:
```json
{
  "name": "Carrom Pool",
  "short_name": "Carrom",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1A1A2E",
  "theme_color": "#FF6B35",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512"
    }
  ]
}
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] **Main Menu**: All buttons work, stats display correctly
- [ ] **Offline - vs Bot**: 
  - [ ] All difficulty levels work
  - [ ] Bot makes valid moves
  - [ ] Scoring works correctly
  - [ ] Queen rules enforced
- [ ] **Offline - Local MP**:
  - [ ] Turn switching works
  - [ ] Both players can aim and shoot
- [ ] **Online - Quick Match**:
  - [ ] Matchmaking finds opponent
  - [ ] Game starts correctly
  - [ ] Real-time sync works
  - [ ] Chat works
- [ ] **Online - Create Room**:
  - [ ] Room code generates
  - [ ] Friend can join
  - [ ] Game starts when both ready
- [ ] **Game Rules**:
  - [ ] Fouls detected correctly
  - [ ] Queen cover works
  - [ ] Win condition triggers
  - [ ] Turn timer works

### Automated Testing (Optional)

Install testing dependencies:
```bash
npm install --save-dev jest supertest socket.io-client
```

Create `server/tests/game.test.js`:
```javascript
const request = require('supertest');
const io = require('socket.io-client');

describe('Carrom Game Server', () => {
  test('Server is running', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  test('Socket connection', (done) => {
    const client = io('http://localhost:3000');
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });
  });
});
```

Run tests:
```bash
npm test
```

## 🔒 Security Considerations

1. **Rate Limiting**: Install `express-rate-limit`
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

2. **Input Validation**: Validate all socket inputs
3. **CORS**: Restrict to your domain in production
4. **Helmet**: Add security headers
```javascript
const helmet = require('helmet');
app.use(helmet());
```

## 📊 Monitoring

### Add logging with Winston
```bash
npm install winston
```

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## 🔄 Updates & Maintenance

### Updating the Game

1. Make changes to code
2. Test locally
3. Commit and push
4. Deploy to production

### Database (Future Enhancement)

For persistent stats and leaderboards, add:
- MongoDB or PostgreSQL
- User authentication
- Match history

Example MongoDB schema:
```javascript
const playerSchema = new mongoose.Schema({
  username: String,
  avatar: String,
  stats: {
    wins: Number,
    losses: Number,
    gamesPlayed: Number,
    highestScore: Number
  },
  createdAt: { type: Date, default: Date.now }
});
```

## 🆘 Troubleshooting

### Common Issues

**Port already in use**:
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Socket connection failed**:
- Check firewall settings
- Verify CORS configuration
- Check WebSocket support

**Game not syncing**:
- Verify server is running
- Check browser console for errors
- Ensure stable internet connection

**Bot not responding**:
- Check console for JavaScript errors
- Verify bot.js is loaded
- Test with different difficulty

## 📈 Performance Optimization

1. **Enable Gzip compression**:
```javascript
const compression = require('compression');
app.use(compression());
```

2. **CDN for static assets**:
- Host images on Cloudinary or AWS S3
- Use CDN for Font Awesome and Google Fonts

3. **Redis for session storage** (if scaling):
```bash
npm install redis connect-redis
```

## 🎨 Customization Guide

### Changing Colors
Edit CSS variables in `client/css/style.css`:
```css
:root {
  --primary: #FF6B35;    /* Main accent */
  --secondary: #2C3E50;  /* Dark elements */
  --accent: #F7C948;     /* Highlights */
  --success: #27AE60;    /* Success states */
  --danger: #E74C3C;     /* Errors/fouls */
}
```

### Adding New Features
1. Game modes (4-player, team mode)
2. Power-ups
3. Tournaments
4. Spectator mode
5. Replay system

---

**Need Help?** Check the README.md or open an issue on GitHub!
