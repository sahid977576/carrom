# 🎯 Carrom Pool - Online Multiplayer Game

A complete Carrom Pool-style board game with offline and online multiplayer modes.

## ✨ Features

- **Online Multiplayer**: Play against real players worldwide
  - Quick Match (Random opponent)
  - Create/Join Rooms (Play with friends)
  - Real-time chat

- **Offline Modes**:
  - vs Computer (AI Bot with 3 difficulty levels)
  - Local Multiplayer (Pass & Play)

- **Realistic Physics**: Accurate disk collision, friction, and pocket detection
- **Carrom Rules**: Queen cover, fouls, turn management
- **Modern UI**: Beautiful dark theme with smooth animations
- **Sound Effects**: Generated audio for strikes, pockets, wins
- **Statistics**: Track wins, games, and win rate

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone/Download** the project
2. **Install server dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Open the game**:
   - Open `http://localhost:3000` in your browser
   - Or open `client/index.html` directly for offline play only

## 🎮 How to Play

### Controls
- **Mouse/Touch**: Drag from striker to aim
- **Power**: Drag further for more power
- **Strike**: Release to shoot or click STRIKE button
- **Spacebar**: Quick strike (when it's your turn)

### Rules
1. **White** player starts first
2. Pocket all your color disks (White or Black)
3. **Queen** (Red disk) must be covered by pocketing your own disk after queen
4. **Fouls**:
   - Pocketing striker = Foul
   - Pocketing opponent's disk = Foul
   - Not hitting any disk = Turn ends
5. **Win**: Pocket all your disks + cover the queen

### Scoring
- Regular disk: 1 point
- Queen (when covered): 3 points

## 🏗️ Project Structure

```
carrom-game/
├── server/
│   ├── server.js          # Socket.io server & game logic
│   └── package.json       # Server dependencies
│
└── client/
    ├── index.html         # Main HTML
    ├── css/
    │   └── style.css      # Game styles
    └── js/
        ├── game.js        # Main game controller
        ├── physics.js     # Physics engine
        └── bot.js         # AI opponent
```

## 🌐 Online Play Setup

### Local Development
```bash
cd server
npm install
npm start
```
Server runs on `http://localhost:3000`

### Production Deployment
1. Deploy server to any Node.js hosting (Heroku, Railway, Render, etc.)
2. Update client socket connection URL
3. Host client files on static hosting or same server

## 🤖 Bot Difficulty Levels

- **Easy**: 60% accuracy, high randomness, slow reaction
- **Medium**: 80% accuracy, moderate randomness
- **Hard**: 95% accuracy, minimal randomness, fast reaction

## 🛠️ Technologies Used

- **Frontend**: HTML5 Canvas, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express, Socket.io
- **Physics**: Custom 2D physics engine
- **AI**: Minimax-based bot with difficulty scaling

## 📝 Game Modes

| Mode | Players | Network | Description |
|------|---------|---------|-------------|
| Quick Match | 2 | Online | Random opponent matchmaking |
| Create Room | 2 | Online | Private room with code |
| Join Room | 2 | Online | Join friend's room |
| vs Computer | 1 | Offline | Play against AI |
| Local MP | 2 | Offline | Pass device to friend |

## 🔧 Customization

### Change Board Colors
Edit CSS variables in `client/css/style.css`:
```css
:root {
    --board-bg: #0F3460;
    --primary: #FF6B35;
    --accent: #F7C948;
}
```

### Adjust Physics
Edit `client/js/physics.js`:
```javascript
this.friction = 0.985;      // Disk slowdown
this.wallBounce = 0.8;      // Wall elasticity
this.diskBounce = 0.9;      // Disk collision elasticity
```

## 🐛 Troubleshooting

**Game not loading?**
- Check browser console for errors
- Ensure all files are in correct directories
- Try refreshing the page

**Online mode not working?**
- Verify server is running
- Check firewall settings
- Ensure port 3000 is available

**Bot too easy/hard?**
- Change difficulty in offline menu
- Adjust accuracy values in `bot.js`

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

- Avatars: [DiceBear API](https://dicebear.com)
- Icons: [Font Awesome](https://fontawesome.com)
- Font: [Google Fonts - Poppins](https://fonts.google.com/specimen/Poppins)

---

**Enjoy playing Carrom Pool!** 🎉
