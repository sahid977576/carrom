class CarromGame {
    constructor() {
        this.canvas = document.getElementById('game-board');
        this.ctx = this.canvas.getContext('2d');
        this.physics = new CarromPhysics();
        this.bot = null;
        this.socket = null;

        // Game state
        this.mode = null; // 'online', 'offline-bot', 'offline-local'
        this.gameState = null;
        this.myColor = null;
        this.currentTurn = null;
        this.isMyTurn = false;
        this.gameActive = false;

        // Input state
        this.isAiming = false;
        this.aimStart = null;
        this.aimCurrent = null;
        this.strikerPos = { x: 400, y: 680 };
        this.power = 0;

        // Animation
        this.animationId = null;
        this.boardScale = 1;

        // Audio
        this.sounds = {};
        this.soundEnabled = true;

        // Stats
        this.stats = this.loadStats();

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadSounds();
        this.updateStatsDisplay();

        // Show loading then menu
        setTimeout(() => {
            this.showScreen('main-menu');
        }, 2000);
    }

    setupCanvas() {
        const resize = () => {
            const container = this.canvas.parentElement;
            const size = Math.min(container.clientWidth, container.clientHeight, 800);
            this.canvas.style.width = size + 'px';
            this.canvas.style.height = size + 'px';
            this.boardScale = size / 800;
        };

        window.addEventListener('resize', resize);
        resize();
    }

    setupEventListeners() {
        // Mouse/Touch events for aiming
        this.canvas.addEventListener('mousedown', (e) => this.handleInputStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleInputMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleInputEnd(e));

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInputStart(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleInputMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleInputEnd(e.changedTouches[0]);
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isMyTurn) {
                this.executeStrike();
            }
        });

        // Difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Chat input
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
    }

    loadSounds() {
        // Create synthetic sounds using Web Audio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.sounds = {
            strike: () => this.playTone(200, 0.1, 'square'),
            pocket: () => this.playTone(800, 0.2, 'sine'),
            wall: () => this.playTone(150, 0.05, 'triangle'),
            win: () => this.playMelody([523, 659, 784, 1047], 0.3),
            lose: () => this.playMelody([400, 350, 300], 0.4),
            turn: () => this.playTone(600, 0.1, 'sine')
        };
    }

    playTone(frequency, duration, type = 'sine') {
        if (!this.soundEnabled) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.frequency.value = frequency;
        osc.type = type;

        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + duration);
    }

    playMelody(notes, duration) {
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, duration), i * duration * 1000);
        });
    }

    // Screen Management
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    showMode(mode) {
        if (mode === 'online') {
            this.connectToServer();
            this.showScreen('online-menu');
        } else {
            this.showScreen('offline-menu');
        }
    }

    // Online Functions
    connectToServer() {
        if (this.socket) return;

        try {
            // Connect to Render backend in production, localhost in development
            const serverUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000'
                : 'https://carrom-pool-server.onrender.com'; // Change this to your Render URL

            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('Connected to server');
            });

            this.socket.on('player-assigned', (data) => {
                this.myColor = data.color;
            });

            this.socket.on('match-found', (data) => {
                this.showScreen('create-room');
                document.getElementById('generated-room-code').textContent = data.roomId.substring(0, 6);
            });

            this.socket.on('game-started', (data) => {
                this.startGame(data);
            });

            this.socket.on('turn-completed', (data) => {
                this.updateGameState(data);
            });

            this.socket.on('game-ended', (data) => {
                this.endGame(data);
            });

            this.socket.on('chat-message', (data) => {
                this.addChatMessage(data);
            });

            this.socket.on('error', (data) => {
                alert(data.message);
            });
        } catch (e) {
            console.error('Connection failed:', e);
            alert('Failed to connect to server. Playing in offline mode.');
        }
    }

    quickMatch() {
        if (!this.socket) {
            this.connectToServer();
        }

        const name = document.getElementById('player-name').value || 'Player';
        this.socket.emit('quick-match', { name });
        this.showScreen('matchmaking');
        this.startSearchTimer();
    }

    createRoom() {
        if (!this.socket) {
            this.connectToServer();
        }

        const name = document.getElementById('player-name').value || 'Player';
        this.socket.emit('create-room', { name, type: 'friend' });
        this.showScreen('create-room');
    }

    joinRoom() {
        if (!this.socket) {
            this.connectToServer();
        }

        const code = document.getElementById('room-code-input').value;
        const name = document.getElementById('player-name').value || 'Player';

        this.socket.emit('join-room', { roomId: code, name });
    }

    setReady() {
        if (this.socket) {
            this.socket.emit('player-ready');
            document.getElementById('start-room-btn').textContent = 'Waiting...';
            document.getElementById('start-room-btn').disabled = true;
        }
    }

    cancelMatchmaking() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.showScreen('online-menu');
    }

    startSearchTimer() {
        let seconds = 0;
        const timerEl = document.getElementById('search-timer');

        this.searchTimer = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    // Offline Functions
    startOffline(type) {
        this.mode = type === 'bot' ? 'offline-bot' : 'offline-local';

        if (type === 'bot') {
            const diff = document.querySelector('.diff-btn.active')?.dataset.level || 'medium';
            this.bot = new CarromBot(diff);
        }

        const playerName = document.getElementById('player-name').value || 'Player';
        const opponentName = type === 'bot' ? 'Computer' : 'Player 2';

        this.myColor = 'white';
        this.gameState = this.physics.initializeBoard();
        this.currentTurn = 'white';
        this.isMyTurn = true;
        this.gameActive = true;

        this.setupGameUI({
            players: [
                { id: 'player1', name: playerName, color: 'white' },
                { id: 'player2', name: opponentName, color: 'black' }
            ],
            currentTurn: 'player1'
        });

        this.showScreen('game-screen');
        this.startGameLoop();
    }

    // Game Logic
    startGame(data) {
        this.mode = 'online';
        this.gameState = this.physics.initializeBoard();
        this.currentTurn = 'white';
        this.isMyTurn = this.myColor === 'white';
        this.gameActive = true;

        this.setupGameUI(data);
        this.showScreen('game-screen');
        this.startGameLoop();

        if (this.searchTimer) {
            clearInterval(this.searchTimer);
        }
    }

    setupGameUI(data) {
        const players = data.players;
        const me = players.find(p => p.color === this.myColor) || players[0];
        const opponent = players.find(p => p.color !== this.myColor) || players[1];

        // Setup player info
        document.getElementById('player-name-game').textContent = me.name;
        document.getElementById('player-avatar-game').src = me.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${me.id}`;

        document.getElementById('opponent-name').textContent = opponent.name;
        document.getElementById('opponent-avatar').src = opponent.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${opponent.id}`;

        this.updateTurnIndicator();
        this.updateScores();
    }

    updateGameState(data) {
        this.gameState = data.board;
        this.currentTurn = data.currentTurn === this.socket?.id ? this.myColor : 
                          (this.myColor === 'white' ? 'black' : 'white');
        this.isMyTurn = this.currentTurn === this.myColor;

        // Update scores
        const scores = data.scores || [];
        scores.forEach(s => {
            if (s.id === this.socket?.id) {
                document.getElementById('player-score').textContent = s.score;
            } else {
                document.getElementById('opponent-score').textContent = s.score;
            }
        });

        this.updateTurnIndicator();
        this.updateDiskIcons();

        // Play sounds
        if (data.strikeResult) {
            if (data.strikeResult.pocketedDisks.length > 0) {
                this.sounds.pocket();
            }
            if (data.strikeResult.foul) {
                this.sounds.lose();
            }
        }

        // Bot turn
        if (this.mode === 'offline-bot' && !this.isMyTurn) {
            this.handleBotTurn();
        }
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        const timer = document.getElementById('turn-timer');

        if (this.isMyTurn) {
            indicator.querySelector('span').textContent = 'Your Turn';
            indicator.style.background = 'rgba(39, 174, 96, 0.3)';
            timer.style.color = '#27AE60';
            document.getElementById('btn-strike').disabled = false;
        } else {
            indicator.querySelector('span').textContent = 'Opponent Turn';
            indicator.style.background = 'rgba(231, 76, 60, 0.3)';
            timer.style.color = '#E74C3C';
            document.getElementById('btn-strike').disabled = true;
        }

        this.startTurnTimer();
    }

    startTurnTimer() {
        if (this.turnTimer) clearInterval(this.turnTimer);

        let timeLeft = 30;
        const timerEl = document.getElementById('turn-timer');

        this.turnTimer = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(this.turnTimer);
                if (this.isMyTurn) {
                    this.autoStrike();
                }
            }
        }, 1000);
    }

    updateScores() {
        if (!this.gameState) return;

        const whitePocketed = this.gameState.disks.filter(d => d.color === 'white' && d.pocketed).length;
        const blackPocketed = this.gameState.disks.filter(d => d.color === 'black' && d.pocketed).length;

        if (this.myColor === 'white') {
            document.getElementById('player-score').textContent = whitePocketed;
            document.getElementById('opponent-score').textContent = blackPocketed;
        } else {
            document.getElementById('player-score').textContent = blackPocketed;
            document.getElementById('opponent-score').textContent = whitePocketed;
        }

        this.updateDiskIcons();
    }

    updateDiskIcons() {
        const createIcons = (color, count) => {
            let html = '';
            for (let i = 0; i < 9; i++) {
                const pocketed = i < count;
                const opacity = pocketed ? 0.3 : 1;
                const bg = color === 'white' ? '#fff' : '#000';
                html += `<div class="disk-icon" style="background:${bg};opacity:${opacity};border:1px solid #666;"></div>`;
            }
            return html;
        };

        const whiteCount = this.gameState.disks.filter(d => d.color === 'white' && d.pocketed).length;
        const blackCount = this.gameState.disks.filter(d => d.color === 'black' && d.pocketed).length;

        if (this.myColor === 'white') {
            document.getElementById('player-disks').innerHTML = createIcons('white', whiteCount);
            document.getElementById('opponent-disks').innerHTML = createIcons('black', blackCount);
        } else {
            document.getElementById('player-disks').innerHTML = createIcons('black', blackCount);
            document.getElementById('opponent-disks').innerHTML = createIcons('white', whiteCount);
        }
    }

    // Input Handling
    handleInputStart(e) {
        if (!this.isMyTurn || !this.gameActive) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.boardScale;
        const y = (e.clientY - rect.top) / this.boardScale;

        // Check if clicking near striker
        const striker = this.gameState.striker;
        const dist = Math.sqrt((x - striker.x) ** 2 + (y - striker.y) ** 2);

        if (dist < 50) {
            this.isAiming = true;
            this.aimStart = { x, y };
            this.aimCurrent = { x, y };
        }
    }

    handleInputMove(e) {
        if (!this.isAiming) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.boardScale;
        const y = (e.clientY - rect.top) / this.boardScale;

        this.aimCurrent = { x, y };

        // Calculate power based on drag distance
        const dx = this.aimCurrent.x - this.aimStart.x;
        const dy = this.aimCurrent.y - this.aimStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.power = Math.min(1, distance / 200);
        this.updatePowerMeter();
    }

    handleInputEnd(e) {
        if (!this.isAiming) return;

        this.isAiming = false;

        if (this.power > 0.1) {
            this.executeStrike();
        }

        this.power = 0;
        this.updatePowerMeter();
    }

    updatePowerMeter() {
        const fill = document.getElementById('power-fill');
        fill.style.height = (this.power * 100) + '%';
    }

    executeStrike() {
        if (!this.isMyTurn || !this.gameActive) return;

        if (!this.aimStart || !this.aimCurrent) {
            // Auto-aim if no drag
            this.autoStrike();
            return;
        }

        const dx = this.aimCurrent.x - this.aimStart.x;
        const dy = this.aimCurrent.y - this.aimStart.y;
        const angle = Math.atan2(dy, dx);

        this.performStrike(angle, this.power, this.strikerPos);
    }

    autoStrike() {
        // Simple auto-aim for timeout
        const target = this.gameState.disks.find(d => !d.pocketed && d.color !== 'striker');
        if (target) {
            const dx = target.x - this.strikerPos.x;
            const dy = target.y - this.strikerPos.y;
            const angle = Math.atan2(dy, dx);
            this.performStrike(angle, 0.5, this.strikerPos);
        }
    }

    performStrike(angle, power, position) {
        this.sounds.strike();

        if (this.mode === 'online' && this.socket) {
            this.socket.emit('strike', {
                angle,
                power,
                position
            });
        } else {
            // Offline mode - simulate locally
            const result = this.physics.simulateStrike(this.gameState, angle, power, position);
            this.gameState = result.state;

            // Process results
            this.processStrikeResult(result.result);
        }

        this.isAiming = false;
        this.aimStart = null;
        this.aimCurrent = null;
        this.power = 0;
        this.updatePowerMeter();
    }

    processStrikeResult(result) {
        // Update scores
        this.updateScores();

        // Check win condition
        const winCheck = this.physics.checkWinCondition(this.gameState, this.currentTurn);
        if (winCheck.gameOver) {
            this.endGame({
                winner: winCheck.winner === this.myColor ? 'player1' : 'player2',
                winnerName: winCheck.winner === this.myColor ? 'You' : 'Opponent',
                reason: winCheck.reason
            });
            return;
        }

        // Switch turns if needed
        if (!result.continueTurn) {
            this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
            this.isMyTurn = this.currentTurn === this.myColor;

            // Local multiplayer - switch myColor
            if (this.mode === 'offline-local') {
                this.myColor = this.currentTurn;
            }
        }

        this.updateTurnIndicator();

        // Bot turn
        if (this.mode === 'offline-bot' && !this.isMyTurn) {
            this.handleBotTurn();
        }
    }

    async handleBotTurn() {
        const botColor = this.myColor === 'white' ? 'black' : 'white';
        const move = await this.bot.makeMove(this.gameState, botColor);

        if (move) {
            this.strikerPos = move.position;
            setTimeout(() => {
                this.performStrike(move.angle, move.power, move.position);
            }, 500);
        }
    }

    // Rendering
    startGameLoop() {
        const loop = () => {
            if (!this.gameActive) return;
            this.render();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw board background
        this.drawBoard(ctx, w, h);

        // Draw pockets
        this.drawPockets(ctx);

        // Draw center circle
        this.drawCenterCircle(ctx);

        // Draw baselines
        this.drawBaselines(ctx);

        // Draw disks
        if (this.gameState) {
            this.gameState.disks.forEach(disk => {
                if (!disk.pocketed) {
                    this.drawDisk(ctx, disk);
                }
            });

            // Draw striker
            if (this.gameState.striker) {
                this.drawStriker(ctx, this.gameState.striker);
            }
        }

        // Draw aim line
        if (this.isAiming && this.aimStart && this.aimCurrent) {
            this.drawAimLine(ctx);
        }

        // Draw striker position indicator
        if (this.isMyTurn && this.gameState) {
            this.drawStrikerPosition(ctx);
        }
    }

    drawBoard(ctx, w, h) {
        // Wood texture background
        const gradient = ctx.createRadialGradient(w/2, h/2, 100, w/2, h/2, w/2);
        gradient.addColorStop(0, '#1a5f2a');
        gradient.addColorStop(1, '#0d3d1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // Border
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, w-20, h-20);

        // Inner border
        ctx.strokeStyle = '#D2691E';
        ctx.lineWidth = 3;
        ctx.strokeRect(30, 30, w-60, h-60);
    }

    drawPockets(ctx) {
        this.physics.pockets.forEach(pocket => {
            // Outer ring
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, 28, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner shadow
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, 22, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.fill();
        });
    }

    drawCenterCircle(ctx) {
        const centerX = 400;
        const centerY = 400;

        // Outer circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Red center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
    }

    drawBaselines(ctx) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);

        // Top baseline
        ctx.beginPath();
        ctx.moveTo(150, 120);
        ctx.lineTo(650, 120);
        ctx.stroke();

        // Bottom baseline
        ctx.beginPath();
        ctx.moveTo(150, 680);
        ctx.lineTo(650, 680);
        ctx.stroke();

        ctx.setLineDash([]);

        // Arrows
        this.drawArrow(ctx, 150, 120, 650, 120);
        this.drawArrow(ctx, 650, 680, 150, 680);
    }

    drawArrow(ctx, x1, y1, x2, y2) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowLength = 15;

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - arrowLength * Math.cos(angle - Math.PI/6),
            y2 - arrowLength * Math.sin(angle - Math.PI/6)
        );
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - arrowLength * Math.cos(angle + Math.PI/6),
            y2 - arrowLength * Math.sin(angle + Math.PI/6)
        );
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawDisk(ctx, disk) {
        const { x, y, radius, color } = disk;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        // Color
        switch(color) {
            case 'white':
                ctx.fillStyle = '#f5f5f5';
                break;
            case 'black':
                ctx.fillStyle = '#2c3e50';
                break;
            case 'queen':
                ctx.fillStyle = '#e74c3c';
                break;
            default:
                ctx.fillStyle = '#999';
        }

        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Shine effect
        ctx.beginPath();
        ctx.arc(x - radius*0.3, y - radius*0.3, radius*0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
    }

    drawStriker(ctx, striker) {
        const { x, y, radius } = striker;

        // Outer ring
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();

        // Inner
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ecf0f1';
        ctx.fill();

        // Center dot
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();

        // Highlight
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
    }

    drawAimLine(ctx) {
        const striker = this.gameState.striker;
        const dx = this.aimCurrent.x - this.aimStart.x;
        const dy = this.aimCurrent.y - this.aimStart.y;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Aim line
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(
            striker.x + Math.cos(angle) * distance,
            striker.y + Math.sin(angle) * distance
        );
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Direction indicator
        ctx.beginPath();
        ctx.arc(
            striker.x + Math.cos(angle) * 30,
            striker.y + Math.sin(angle) * 30,
            5, 0, Math.PI * 2
        );
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();
    }

    drawStrikerPosition(ctx) {
        const baselineY = this.myColor === 'white' ? 680 : 120;

        ctx.beginPath();
        ctx.arc(this.strikerPos.x, baselineY, 20, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Game End
    endGame(data) {
        this.gameActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const isWinner = data.winner === (this.mode === 'online' ? this.socket?.id : 'player1');

        // Update stats
        this.stats.games++;
        if (isWinner) this.stats.wins++;
        this.saveStats();
        this.updateStatsDisplay();

        // Show result
        document.getElementById('game-result').textContent = isWinner ? 'Victory!' : 'Defeat';
        document.getElementById('game-result-sub').textContent = isWinner ? 
            'You won the match!' : `${data.winnerName} won the match`;

        document.getElementById('result-animation').innerHTML = isWinner ? '🏆' : '😔';

        // Update final scores
        const players = [
            { name: document.getElementById('player-name-game').textContent, 
              score: document.getElementById('player-score').textContent,
              avatar: document.getElementById('player-avatar-game').src },
            { name: document.getElementById('opponent-name').textContent,
              score: document.getElementById('opponent-score').textContent,
              avatar: document.getElementById('opponent-avatar').src }
        ];

        document.querySelector('#final-player1 .name').textContent = players[0].name;
        document.querySelector('#final-player1 .score').textContent = players[0].score;
        document.querySelector('#final-player1 img').src = players[0].avatar;

        document.querySelector('#final-player2 .name').textContent = players[1].name;
        document.querySelector('#final-player2 .score').textContent = players[1].score;
        document.querySelector('#final-player2 img').src = players[1].avatar;

        // Play sound
        if (isWinner) {
            this.sounds.win();
        } else {
            this.sounds.lose();
        }

        this.showScreen('game-over');
    }

    playAgain() {
        if (this.mode === 'online') {
            this.showScreen('online-menu');
        } else {
            const type = this.mode === 'offline-bot' ? 'bot' : 'local';
            this.startOffline(type);
        }
    }

    // Chat
    toggleChat() {
        document.getElementById('chat-panel').classList.toggle('open');
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        if (this.mode === 'online' && this.socket) {
            this.socket.emit('chat-message', { message });
        }

        this.addChatMessage({
            playerId: 'me',
            message,
            timestamp: Date.now()
        });

        input.value = '';
    }

    addChatMessage(data) {
        const container = document.getElementById('chat-messages');
        const isOwn = data.playerId === 'me' || data.playerId === this.socket?.id;

        const div = document.createElement('div');
        div.className = `chat-message ${isOwn ? 'own' : 'other'}`;

        if (!isOwn) {
            div.innerHTML = `<div class="sender">Opponent</div>${data.message}`;
        } else {
            div.textContent = data.message;
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // Settings
    toggleSettings() {
        document.getElementById('settings-modal').classList.toggle('active');
    }

    // Leave Game
    confirmLeave() {
        document.getElementById('leave-modal').classList.add('active');
    }

    cancelLeave() {
        document.getElementById('leave-modal').classList.remove('active');
    }

    leaveGame() {
        this.gameActive = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        document.getElementById('leave-modal').classList.remove('active');
        this.showScreen('main-menu');
    }

    // Stats
    loadStats() {
        const saved = localStorage.getItem('carrom-stats');
        return saved ? JSON.parse(saved) : { wins: 0, games: 0 };
    }

    saveStats() {
        localStorage.setItem('carrom-stats', JSON.stringify(this.stats));
    }

    updateStatsDisplay() {
        document.getElementById('total-wins').textContent = this.stats.wins;
        document.getElementById('total-games').textContent = this.stats.games;

        const rate = this.stats.games > 0 ? 
            Math.round((this.stats.wins / this.stats.games) * 100) : 0;
        document.getElementById('win-rate').textContent = rate + '%';
    }

    copyRoomCode() {
        const code = document.getElementById('generated-room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert('Room code copied!');
        });
    }
}


    // How to Play
    showHowToPlay() {
        window.open('how-to-play.html', '_blank');
    }

// Initialize game
const game = new CarromGame();
