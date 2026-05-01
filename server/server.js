const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client')));
} else {
    app.use(express.static('../client'));
}

// Game State Management
const rooms = new Map();
const waitingPlayers = [];
const activeGames = new Map();

class CarromRoom {
    constructor(id, type = 'random') {
        this.id = id;
        this.type = type; // 'random' or 'friend'
        this.players = [];
        this.maxPlayers = 2;
        this.gameState = 'waiting'; // waiting, playing, finished
        this.board = null;
        this.currentTurn = 0;
        this.createdAt = Date.now();
    }

    addPlayer(socket, playerData) {
        if (this.players.length >= this.maxPlayers) return false;

        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player ${this.players.length + 1}`,
            avatar: playerData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`,
            color: this.players.length === 0 ? 'white' : 'black',
            score: 0,
            isReady: false,
            isBot: playerData.isBot || false
        };

        this.players.push(player);
        socket.join(this.id);

        // Notify player of their color
        socket.emit('player-assigned', { color: player.color, playerId: player.id });

        // Notify room of new player
        this.broadcast('player-joined', {
            playerId: player.id,
            name: player.name,
            avatar: player.avatar,
            color: player.color,
            playerCount: this.players.length
        });

        return true;
    }

    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.id === socketId);
        if (index !== -1) {
            const player = this.players[index];
            this.players.splice(index, 1);

            if (this.gameState === 'playing') {
                this.broadcast('player-disconnected', { playerId: socketId });
                this.gameState = 'finished';
            }

            this.broadcast('player-left', { playerId: socketId, name: player.name });
        }
    }

    setPlayerReady(socketId, ready) {
        const player = this.players.find(p => p.id === socketId);
        if (player) {
            player.isReady = ready;
            this.broadcast('player-ready', { playerId: socketId, ready });

            // Check if all players ready
            if (this.players.length === this.maxPlayers && this.players.every(p => p.isReady)) {
                this.startGame();
            }
        }
    }

    startGame() {
        this.gameState = 'playing';
        this.board = new CarromBoard();
        this.currentTurn = 0; // White starts

        this.broadcast('game-started', {
            board: this.board.getState(),
            currentTurn: this.players[this.currentTurn].id,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                score: p.score
            }))
        });
    }

    handleStrike(socketId, strikeData) {
        if (this.gameState !== 'playing') return;

        const currentPlayer = this.players[this.currentTurn];
        if (currentPlayer.id !== socketId) return;

        // Validate and process strike
        const result = this.board.processStrike(strikeData, currentPlayer.color);

        // Update scores
        if (result.pocketedDisks.length > 0) {
            currentPlayer.score += result.pocketedDisks.length;
            if (result.queenPocketed) currentPlayer.score += 3;
        }

        // Check win condition
        const winResult = this.board.checkWinCondition();
        if (winResult.gameOver) {
            this.gameState = 'finished';
            const winner = this.players.find(p => p.color === winResult.winner);

            this.broadcast('game-ended', {
                winner: winner ? winner.id : null,
                winnerName: winner ? winner.name : 'Draw',
                finalScores: this.players.map(p => ({ id: p.id, score: p.score })),
                reason: winResult.reason
            });
            return;
        }

        // Switch turns if no continue
        if (!result.continueTurn) {
            this.currentTurn = (this.currentTurn + 1) % this.players.length;
        }

        // Broadcast updated state
        this.broadcast('turn-completed', {
            strikeResult: result,
            board: this.board.getState(),
            currentTurn: this.players[this.currentTurn].id,
            scores: this.players.map(p => ({ id: p.id, score: p.score }))
        });
    }

    broadcast(event, data) {
        io.to(this.id).emit(event, data);
    }

    getPublicInfo() {
        return {
            id: this.id,
            type: this.type,
            playerCount: this.players.length,
            maxPlayers: this.maxPlayers,
            gameState: this.gameState,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                isReady: p.isReady
            }))
        };
    }
}

class CarromBoard {
    constructor() {
        this.width = 800;
        this.height = 800;
        this.pockets = [
            { x: 40, y: 40, radius: 25 },
            { x: 760, y: 40, radius: 25 },
            { x: 40, y: 760, radius: 25 },
            { x: 760, y: 760, radius: 25 }
        ];

        this.disks = this.initializeDisks();
        this.striker = {
            x: 400,
            y: 650,
            radius: 15,
            color: 'striker',
            vx: 0,
            vy: 0
        };

        this.queenCovered = false;
        this.queenPocketedBy = null;
        this.foulCommitted = false;
    }

    initializeDisks() {
        const disks = [];
        const centerX = 400;
        const centerY = 400;
        const spacing = 28;

        // Create triangle formation
        const positions = [
            [0, 0], [-1, -1], [1, -1], [-2, -2], [0, -2], [2, -2],
            [-1, -3], [1, -3], [-3, -3], [-1, -1], [1, -1], [3, -3],
            [-2, -4], [0, -4], [2, -4], [-4, -4], [-2, -4], [0, -4], [2, -4]
        ];

        let whiteCount = 0;
        let blackCount = 0;

        positions.forEach((pos, i) => {
            const x = centerX + pos[0] * spacing;
            const y = centerY + pos[1] * spacing;

            let color;
            if (i === 6) {
                color = 'queen';
            } else if (whiteCount < 9) {
                color = 'white';
                whiteCount++;
            } else {
                color = 'black';
                blackCount++;
            }

            disks.push({
                id: i,
                x, y,
                radius: 12,
                color,
                vx: 0,
                vy: 0,
                pocketed: false
            });
        });

        return disks;
    }

    processStrike(strikeData, playerColor) {
        const { angle, power, position } = strikeData;

        // Set striker velocity
        const speed = power * 15;
        this.striker.vx = Math.cos(angle) * speed;
        this.striker.vy = Math.sin(angle) * speed;
        this.striker.x = position.x;
        this.striker.y = position.y;

        // Simulate physics
        this.simulatePhysics();

        // Check pocketed disks
        const pocketedDisks = [];
        let queenPocketed = false;
        let foul = false;
        let continueTurn = false;

        this.disks.forEach(disk => {
            if (!disk.pocketed && this.checkPocketed(disk)) {
                disk.pocketed = true;
                pocketedDisks.push(disk);

                if (disk.color === 'queen') {
                    queenPocketed = true;
                    this.queenPocketedBy = playerColor;
                }

                // Check if correct color was pocketed
                if (disk.color !== 'queen' && disk.color !== playerColor) {
                    foul = true;
                }
            }
        });

        // Check striker pocketed (foul)
        if (this.checkPocketed(this.striker)) {
            foul = true;
            this.striker.x = 400;
            this.striker.y = 650;
            this.striker.vx = 0;
            this.striker.vy = 0;
        }

        // Queen rules: must cover queen with own color after pocketing
        if (queenPocketed) {
            if (!foul && pocketedDisks.some(d => d.color === playerColor)) {
                this.queenCovered = true;
                continueTurn = true;
            } else {
                // Queen not covered, return to center
                const queen = this.disks.find(d => d.color === 'queen');
                if (queen) {
                    queen.pocketed = false;
                    queen.x = 400;
                    queen.y = 400;
                }
                this.queenPocketedBy = null;
            }
        }

        // Continue turn if pocketed own color without foul
        if (!foul && pocketedDisks.some(d => d.color === playerColor)) {
            continueTurn = true;
        }

        // Handle foul: return opponent's pocketed disks
        if (foul) {
            const opponentColor = playerColor === 'white' ? 'black' : 'white';
            pocketedDisks.forEach(disk => {
                if (disk.color === opponentColor) {
                    disk.pocketed = false;
                    // Return to board at random position
                    disk.x = 200 + Math.random() * 400;
                    disk.y = 200 + Math.random() * 400;
                }
            });
        }

        return {
            pocketedDisks,
            queenPocketed,
            foul,
            continueTurn,
            strikerPosition: { x: this.striker.x, y: this.striker.y }
        };
    }

    simulatePhysics() {
        const friction = 0.985;
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
            // Update striker
            this.striker.x += this.striker.vx * 0.1;
            this.striker.y += this.striker.vy * 0.1;
            this.striker.vx *= friction;
            this.striker.vy *= friction;

            // Wall collisions for striker
            this.handleWallCollision(this.striker);

            // Update disks
            this.disks.forEach(disk => {
                if (disk.pocketed) return;

                disk.x += disk.vx * 0.1;
                disk.y += disk.vy * 0.1;
                disk.vx *= friction;
                disk.vy *= friction;

                this.handleWallCollision(disk);

                // Disk-disk collisions
                this.disks.forEach(other => {
                    if (other.id !== disk.id && !other.pocketed) {
                        this.handleDiskCollision(disk, other);
                    }
                });

                // Striker-disk collisions
                this.handleDiskCollision(this.striker, disk);
            });
        }
    }

    handleWallCollision(obj) {
        const margin = obj.radius;
        if (obj.x < margin) { obj.x = margin; obj.vx *= -0.8; }
        if (obj.x > this.width - margin) { obj.x = this.width - margin; obj.vx *= -0.8; }
        if (obj.y < margin) { obj.y = margin; obj.vy *= -0.8; }
        if (obj.y > this.height - margin) { obj.y = this.height - margin; obj.vy *= -0.8; }
    }

    handleDiskCollision(d1, d2) {
        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = d1.radius + d2.radius;

        if (distance < minDist && distance > 0) {
            // Normalize collision vector
            const nx = dx / distance;
            const ny = dy / distance;

            // Relative velocity
            const dvx = d1.vx - d2.vx;
            const dvy = d1.vy - d2.vy;

            // Velocity along normal
            const velAlongNormal = dvx * nx + dvy * ny;

            if (velAlongNormal > 0) return;

            // Restitution
            const restitution = 0.9;

            // Impulse scalar
            let j = -(1 + restitution) * velAlongNormal;
            j /= 2; // Equal mass

            // Apply impulse
            const impulseX = j * nx;
            const impulseY = j * ny;

            d1.vx += impulseX;
            d1.vy += impulseY;
            d2.vx -= impulseX;
            d2.vy -= impulseY;

            // Separate disks to prevent sticking
            const overlap = minDist - distance;
            const separationX = nx * overlap * 0.5;
            const separationY = ny * overlap * 0.5;

            d1.x -= separationX;
            d1.y -= separationY;
            d2.x += separationX;
            d2.y += separationY;
        }
    }

    checkPocketed(disk) {
        return this.pockets.some(pocket => {
            const dx = disk.x - pocket.x;
            const dy = disk.y - pocket.y;
            return Math.sqrt(dx * dx + dy * dy) < pocket.radius;
        });
    }

    checkWinCondition() {
        const whiteDisks = this.disks.filter(d => d.color === 'white');
        const blackDisks = this.disks.filter(d => d.color === 'black');

        const whitePocketed = whiteDisks.every(d => d.pocketed);
        const blackPocketed = blackDisks.every(d => d.pocketed);

        if (whitePocketed && this.queenCovered) {
            return { gameOver: true, winner: 'white', reason: 'All disks pocketed' };
        }
        if (blackPocketed && this.queenCovered) {
            return { gameOver: true, winner: 'black', reason: 'All disks pocketed' };
        }

        return { gameOver: false };
    }

    getState() {
        return {
            disks: this.disks.map(d => ({
                id: d.id,
                x: d.x,
                y: d.y,
                color: d.color,
                pocketed: d.pocketed
            })),
            striker: {
                x: this.striker.x,
                y: this.striker.y
            },
            queenCovered: this.queenCovered
        };
    }
}

// Socket.io Connection Handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create Room
    socket.on('create-room', (data) => {
        const roomId = uuidv4();
        const room = new CarromRoom(roomId, data.type || 'friend');
        rooms.set(roomId, room);

        room.addPlayer(socket, data);
        socket.emit('room-created', { roomId, ...room.getPublicInfo() });
    });

    // Join Room
    socket.on('join-room', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.addPlayer(socket, data)) {
            socket.emit('room-joined', room.getPublicInfo());

            // If room full, start countdown
            if (room.players.length === room.maxPlayers) {
                room.broadcast('room-full', { countdown: 5 });
            }
        } else {
            socket.emit('error', { message: 'Room is full' });
        }
    });

    // Quick Match / Random Matchmaking
    socket.on('quick-match', (data) => {
        // Check waiting players
        const waitingIndex = waitingPlayers.findIndex(p => p.socket.id !== socket.id);

        if (waitingIndex !== -1) {
            // Match found
            const opponent = waitingPlayers[waitingIndex];
            waitingPlayers.splice(waitingIndex, 1);

            const roomId = uuidv4();
            const room = new CarromRoom(roomId, 'random');
            rooms.set(roomId, room);

            room.addPlayer(opponent.socket, opponent.data);
            room.addPlayer(socket, data);

            opponent.socket.emit('match-found', { roomId, opponent: data.name });
            socket.emit('match-found', { roomId, opponent: opponent.data.name });
        } else {
            // Add to waiting list
            waitingPlayers.push({ socket, data });
            socket.emit('waiting-for-match');
        }
    });

    // Player Ready
    socket.on('player-ready', () => {
        const room = findPlayerRoom(socket.id);
        if (room) {
            room.setPlayerReady(socket.id, true);
        }
    });

    // Strike Action
    socket.on('strike', (data) => {
        const room = findPlayerRoom(socket.id);
        if (room) {
            room.handleStrike(socket.id, data);
        }
    });

    // Chat Message
    socket.on('chat-message', (data) => {
        const room = findPlayerRoom(socket.id);
        if (room) {
            room.broadcast('chat-message', {
                playerId: socket.id,
                message: data.message,
                timestamp: Date.now()
            });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        // Remove from waiting list
        const waitingIndex = waitingPlayers.findIndex(p => p.socket.id === socket.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }

        // Remove from room
        const room = findPlayerRoom(socket.id);
        if (room) {
            room.removePlayer(socket.id);
            if (room.players.length === 0) {
                rooms.delete(room.id);
            }
        }
    });
});

function findPlayerRoom(socketId) {
    for (const room of rooms.values()) {
        if (room.players.some(p => p.id === socketId)) {
            return room;
        }
    }
    return null;
}

// Cleanup old rooms
setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
        if (now - room.createdAt > 3600000) { // 1 hour
            rooms.delete(id);
        }
    }
}, 600000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Carrom Server running on port ${PORT}`);
});
