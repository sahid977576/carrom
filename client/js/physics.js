class CarromPhysics {
    constructor() {
        this.boardWidth = 800;
        this.boardHeight = 800;
        this.friction = 0.985;
        this.wallBounce = 0.8;
        this.diskBounce = 0.9;
        this.pocketRadius = 28;
        this.minVelocity = 0.1;

        this.pockets = [
            { x: 45, y: 45 },
            { x: 755, y: 45 },
            { x: 45, y: 755 },
            { x: 755, y: 755 }
        ];
    }

    initializeBoard() {
        const disks = [];
        const centerX = this.boardWidth / 2;
        const centerY = this.boardHeight / 2;
        const spacing = 28;

        // Triangle formation positions
        const positions = [
            [0, 0],
            [-1, -1], [1, -1],
            [-2, -2], [0, -2], [2, -2],
            [-1, -3], [1, -3],
            [-3, -3], [-1, -3], [1, -3], [3, -3],
            [-2, -4], [0, -4], [2, -4],
            [-4, -4], [-2, -4], [0, -4], [2, -4]
        ];

        let whiteCount = 0;
        let blackCount = 0;

        positions.forEach((pos, i) => {
            if (i >= 19) return;

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
                pocketed: false,
                mass: 1
            });
        });

        return {
            disks,
            striker: {
                x: centerX,
                y: 680,
                radius: 15,
                color: 'striker',
                vx: 0,
                vy: 0,
                mass: 1.2
            },
            queenCovered: false,
            queenPocketedBy: null,
            lastPocketed: []
        };
    }

    simulateStrike(boardState, angle, power, strikerPos) {
        const state = JSON.parse(JSON.stringify(boardState));
        const speed = power * 20;

        state.striker.x = strikerPos.x;
        state.striker.y = strikerPos.y;
        state.striker.vx = Math.cos(angle) * speed;
        state.striker.vy = Math.sin(angle) * speed;

        // Run physics simulation
        this.runSimulation(state);

        // Process results
        const result = {
            pocketedDisks: [],
            queenPocketed: false,
            foul: false,
            continueTurn: false,
            strikerPocketed: false
        };

        // Check pocketed disks
        state.disks.forEach(disk => {
            if (!disk.pocketed && this.checkPocketed(disk)) {
                disk.pocketed = true;
                result.pocketedDisks.push({
                    id: disk.id,
                    color: disk.color,
                    x: disk.x,
                    y: disk.y
                });

                if (disk.color === 'queen') {
                    result.queenPocketed = true;
                }
            }
        });

        // Check striker pocketed
        if (this.checkPocketed(state.striker)) {
            result.foul = true;
            result.strikerPocketed = true;
            state.striker.x = state.striker.y = -100; // Off board
        }

        // Check if any disk was hit (foul if none)
        const anyDiskHit = state.disks.some(d => 
            Math.abs(d.vx) > 0.01 || Math.abs(d.vy) > 0.01
        );

        if (!anyDiskHit && result.pocketedDisks.length === 0) {
            // No disk hit - not necessarily foul but turn ends
        }

        return { state, result };
    }

    runSimulation(state) {
        const maxIterations = 300;
        let moving = true;
        let iterations = 0;

        while (moving && iterations < maxIterations) {
            moving = false;
            iterations++;

            // Update striker
            if (Math.abs(state.striker.vx) > this.minVelocity || 
                Math.abs(state.striker.vy) > this.minVelocity) {
                state.striker.x += state.striker.vx;
                state.striker.y += state.striker.vy;
                state.striker.vx *= this.friction;
                state.striker.vy *= this.friction;

                this.handleWallCollision(state.striker);
                moving = true;
            }

            // Update disks
            state.disks.forEach(disk => {
                if (disk.pocketed) return;

                if (Math.abs(disk.vx) > this.minVelocity || 
                    Math.abs(disk.vy) > this.minVelocity) {
                    disk.x += disk.vx;
                    disk.y += disk.vy;
                    disk.vx *= this.friction;
                    disk.vy *= this.friction;

                    this.handleWallCollision(disk);
                    moving = true;
                }

                // Disk-disk collisions
                state.disks.forEach(other => {
                    if (other.id !== disk.id && !other.pocketed) {
                        if (this.handleDiskCollision(disk, other)) {
                            moving = true;
                        }
                    }
                });

                // Striker-disk collision
                if (this.handleDiskCollision(state.striker, disk)) {
                    moving = true;
                }
            });
        }
    }

    handleWallCollision(obj) {
        const margin = obj.radius + 5;

        if (obj.x < margin) {
            obj.x = margin;
            obj.vx *= -this.wallBounce;
        }
        if (obj.x > this.boardWidth - margin) {
            obj.x = this.boardWidth - margin;
            obj.vx *= -this.wallBounce;
        }
        if (obj.y < margin) {
            obj.y = margin;
            obj.vy *= -this.wallBounce;
        }
        if (obj.y > this.boardHeight - margin) {
            obj.y = this.boardHeight - margin;
            obj.vy *= -this.wallBounce;
        }
    }

    handleDiskCollision(d1, d2) {
        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = d1.radius + d2.radius;

        if (distance < minDist && distance > 0) {
            const nx = dx / distance;
            const ny = dy / distance;

            const dvx = d1.vx - d2.vx;
            const dvy = d1.vy - d2.vy;

            const velAlongNormal = dvx * nx + dvy * ny;

            if (velAlongNormal > 0) return false;

            const restitution = this.diskBounce;
            const m1 = d1.mass || 1;
            const m2 = d2.mass || 1;

            let j = -(1 + restitution) * velAlongNormal;
            j /= (1/m1 + 1/m2);

            const impulseX = j * nx;
            const impulseY = j * ny;

            d1.vx += impulseX / m1;
            d1.vy += impulseY / m1;
            d2.vx -= impulseX / m2;
            d2.vy -= impulseY / m2;

            const overlap = minDist - distance;
            const sepX = nx * overlap * 0.5;
            const sepY = ny * overlap * 0.5;

            d1.x -= sepX;
            d1.y -= sepY;
            d2.x += sepX;
            d2.y += sepY;

            return true;
        }
        return false;
    }

    checkPocketed(disk) {
        return this.pockets.some(pocket => {
            const dx = disk.x - pocket.x;
            const dy = disk.y - pocket.y;
            return Math.sqrt(dx * dx + dy * dy) < this.pocketRadius;
        });
    }

    checkWinCondition(state, playerColor) {
        const whiteDisks = state.disks.filter(d => d.color === 'white');
        const blackDisks = state.disks.filter(d => d.color === 'black');

        const whiteAllPocketed = whiteDisks.every(d => d.pocketed);
        const blackAllPocketed = blackDisks.every(d => d.pocketed);

        if (whiteAllPocketed && state.queenCovered) {
            return { gameOver: true, winner: 'white', reason: 'All disks pocketed' };
        }
        if (blackAllPocketed && state.queenCovered) {
            return { gameOver: true, winner: 'black', reason: 'All disks pocketed' };
        }

        return { gameOver: false };
    }

    getStrikerPosition(boardState, playerColor) {
        // Return valid striker positions based on player
        const baselineY = playerColor === 'white' ? 680 : 120;
        return {
            minX: 150,
            maxX: 650,
            y: baselineY,
            x: boardState.striker.x || 400
        };
    }

    isValidStrikerPosition(x, y, playerColor) {
        const baselineY = playerColor === 'white' ? 680 : 120;
        const tolerance = 50;

        return x >= 150 && x <= 650 && 
               Math.abs(y - baselineY) < tolerance;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CarromPhysics;
}
