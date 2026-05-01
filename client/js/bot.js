class CarromBot {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.physics = new CarromPhysics();

        // Difficulty settings
        this.accuracy = {
            easy: 0.6,
            medium: 0.8,
            hard: 0.95
        };

        this.powerVariance = {
            easy: 0.3,
            medium: 0.15,
            hard: 0.05
        };

        this.reactionTime = {
            easy: 2000,
            medium: 1500,
            hard: 800
        };
    }

    makeMove(boardState, botColor) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const move = this.calculateBestMove(boardState, botColor);
                resolve(move);
            }, this.reactionTime[this.difficulty]);
        });
    }

    calculateBestMove(boardState, botColor) {
        const opponentColor = botColor === 'white' ? 'black' : 'white';
        const myDisks = boardState.disks.filter(d => d.color === botColor && !d.pocketed);
        const opponentDisks = boardState.disks.filter(d => d.color === opponentColor && !d.pocketed);
        const queen = boardState.disks.find(d => d.color === 'queen' && !d.pocketed);

        // Get valid striker positions
        const strikerY = botColor === 'white' ? 680 : 120;
        const strikerPositions = this.getValidStrikerPositions(boardState, strikerY);

        let bestMove = null;
        let bestScore = -Infinity;

        // Try different striker positions
        strikerPositions.forEach(pos => {
            // Try hitting each of my disks
            myDisks.forEach(target => {
                const move = this.evaluateMove(boardState, pos, target, botColor, 'pocket');
                if (move.score > bestScore) {
                    bestScore = move.score;
                    bestMove = move;
                }
            });

            // Try hitting queen if available and not covered
            if (queen && !boardState.queenCovered) {
                const move = this.evaluateMove(boardState, pos, queen, botColor, 'queen');
                if (move.score > bestScore) {
                    bestScore = move.score;
                    bestMove = move;
                }
            }

            // Try breaking opponent's disks (defensive)
            if (this.difficulty !== 'easy') {
                opponentDisks.forEach(target => {
                    const move = this.evaluateMove(boardState, pos, target, botColor, 'break');
                    if (move.score > bestScore * 0.7) { // Lower priority
                        bestScore = move.score;
                        bestMove = move;
                    }
                });
            }
        });

        // Apply difficulty-based randomness
        if (bestMove) {
            bestMove = this.applyDifficulty(bestMove);
        }

        return bestMove || this.getRandomMove(boardState, strikerY);
    }

    getValidStrikerPositions(boardState, strikerY) {
        const positions = [];
        const step = 50;

        for (let x = 200; x <= 600; x += step) {
            // Check if position is clear
            const isClear = !boardState.disks.some(d => 
                !d.pocketed && 
                Math.abs(d.x - x) < 40 && 
                Math.abs(d.y - strikerY) < 40
            );

            if (isClear) {
                positions.push({ x, y: strikerY });
            }
        }

        // If no clear positions, return center
        if (positions.length === 0) {
            positions.push({ x: 400, y: strikerY });
        }

        return positions;
    }

    evaluateMove(boardState, strikerPos, target, botColor, intent) {
        const dx = target.x - strikerPos.x;
        const dy = target.y - strikerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate angle
        let angle = Math.atan2(dy, dx);

        // Calculate power based on distance
        let power = Math.min(1, distance / 400);
        power = Math.max(0.3, power);

        // Simulate the move
        const simulation = this.physics.simulateStrike(
            boardState, 
            angle, 
            power, 
            strikerPos
        );

        let score = 0;

        // Score based on pocketed disks
        simulation.result.pocketedDisks.forEach(disk => {
            if (disk.color === botColor) {
                score += 100;
            } else if (disk.color === 'queen') {
                score += 150;
            } else if (disk.color !== 'striker') {
                score -= 50; // Pocketed opponent's disk (foul)
            }
        });

        // Penalize fouls
        if (simulation.result.foul) {
            score -= 200;
        }

        // Bonus for continuing turn
        if (simulation.result.continueTurn) {
            score += 50;
        }

        // Queen strategy
        if (intent === 'queen') {
            if (simulation.result.queenPocketed && !simulation.result.foul) {
                score += 200;
            }
        }

        // Check if move sets up next shot well
        const nextTurnAdvantage = this.evaluateNextTurn(simulation.state, botColor);
        score += nextTurnAdvantage * 0.3;

        return {
            angle,
            power,
            position: strikerPos,
            score,
            simulation: simulation.result
        };
    }

    evaluateNextTurn(state, botColor) {
        // Simple evaluation: are my disks in good positions?
        const myDisks = state.disks.filter(d => d.color === botColor && !d.pocketed);
        let advantage = 0;

        myDisks.forEach(disk => {
            // Check if disk is near a pocket
            this.physics.pockets.forEach(pocket => {
                const dx = disk.x - pocket.x;
                const dy = disk.y - pocket.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    advantage += (100 - dist) / 10;
                }
            });
        });

        return advantage;
    }

    applyDifficulty(move) {
        const accuracy = this.accuracy[this.difficulty];
        const variance = this.powerVariance[this.difficulty];

        // Add randomness to angle
        const angleError = (1 - accuracy) * (Math.random() - 0.5) * 0.5;
        move.angle += angleError;

        // Add randomness to power
        const powerError = (Math.random() - 0.5) * variance;
        move.power = Math.max(0.2, Math.min(1, move.power + powerError));

        // Slight position error for easy/medium
        if (this.difficulty !== 'hard') {
            const posError = (1 - accuracy) * 20;
            move.position.x += (Math.random() - 0.5) * posError;
            move.position.x = Math.max(150, Math.min(650, move.position.x));
        }

        return move;
    }

    getRandomMove(boardState, strikerY) {
        const target = boardState.disks.find(d => !d.pocketed && d.color !== 'striker');

        if (!target) {
            return {
                angle: Math.random() * Math.PI * 2,
                power: 0.5,
                position: { x: 400, y: strikerY }
            };
        }

        const dx = target.x - 400;
        const dy = target.y - strikerY;
        const angle = Math.atan2(dy, dx);

        return {
            angle: angle + (Math.random() - 0.5) * 0.5,
            power: 0.4 + Math.random() * 0.4,
            position: { x: 400, y: strikerY }
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CarromBot;
}
