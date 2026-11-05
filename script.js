// =============================================================================
// CASINO POKER ENGINE - TEXAS HOLD'EM & 5-CARD DRAW
// Optimizaciones: Evaluador de 5 cartas con kickers exactos, Split Pot,
// IA heurística estratégica, Ronda de apuestas con All-In, Web Audio API,
// Runout televisado (revelación de cartas de rivales en All-In) y persistencia.
// =============================================================================

const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const CARD_NAME_MAP = {
    14: 'As', 13: 'K', 12: 'Q', 11: 'J', 10: '10',
    9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2'
};

const CARD_PLURAL_MAP = {
    14: 'Ases', 13: 'Reyes', 12: 'Damas', 11: 'Jotas', 10: 'Dieces',
    9: 'Nueves', 8: 'Ochos', 7: 'Sietes', 6: 'Seises', 5: 'Cincos', 4: 'Cuatros', 3: 'Treses', 2: 'Doses'
};

// -----------------------------------------------------------------------------
// SISTEMA DE SONIDO CON WEB AUDIO API
// -----------------------------------------------------------------------------
const SoundManager = {
    ctx: null,
    enabled: true,

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playCard() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const bufferSize = this.ctx.sampleRate * 0.08;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200;
            filter.Q.value = 2;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start();
        } catch (e) {
            console.warn("Audio error:", e);
        }
    },

    playChip() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [2200, 2800].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq + (idx * 200), now);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.02);
                osc.stop(now + idx * 0.02 + 0.06);
            });
        } catch (e) {}
    },

    playCheck() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [0, 0.08].forEach(delay => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(280, now + delay);
                osc.frequency.exponentialRampToValueAtTime(120, now + delay + 0.05);

                gain.gain.setValueAtTime(0.2, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + delay);
                osc.stop(now + delay + 0.05);
            });
        } catch (e) {}
    },

    playFold() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        } catch (e) {}
    },

    playWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.09);

                gain.gain.setValueAtTime(0.16, now + idx * 0.09);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.09);
                osc.stop(now + idx * 0.09 + 0.24);
            });
        } catch (e) {}
    }
};

function toggleSound() {
    SoundManager.enabled = !SoundManager.enabled;
    localStorage.setItem('poker_sound', SoundManager.enabled ? '1' : '0');
    updateSoundUI();
}

function updateSoundUI() {
    const isEn = SoundManager.enabled;
    const btnMenu = document.getElementById('btn-menu-sound');
    const btnGame = document.getElementById('btn-game-sound');
    if (btnMenu) btnMenu.innerText = isEn ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
    if (btnGame) btnGame.innerText = isEn ? '🔊' : '🔇';
}

// -----------------------------------------------------------------------------
// GESTOR DE ESTADÍSTICAS Y PERSISTENCIA (localStorage)
// -----------------------------------------------------------------------------
const StatsManager = {
    stats: {
        wins: 0,
        hands: 0,
        bestPot: 0
    },

    load() {
        try {
            const saved = localStorage.getItem('poker_stats');
            if (saved) {
                this.stats = Object.assign(this.stats, JSON.parse(saved));
            }
            const soundSaved = localStorage.getItem('poker_sound');
            if (soundSaved !== null) {
                SoundManager.enabled = soundSaved === '1';
            }
        } catch (e) {}
        this.updateUI();
        updateSoundUI();
    },

    save() {
        try {
            localStorage.setItem('poker_stats', JSON.stringify(this.stats));
        } catch (e) {}
        this.updateUI();
    },

    recordHand() {
        this.stats.hands++;
        this.save();
    },

    recordWin(pot) {
        this.stats.wins++;
        if (pot > this.stats.bestPot) {
            this.stats.bestPot = pot;
        }
        this.save();
    },

    reset() {
        this.stats = { wins: 0, hands: 0, bestPot: 0 };
        this.save();
    },

    updateUI() {
        const winsEl = document.getElementById('stats-wins');
        const handsEl = document.getElementById('stats-hands');
        const bestPotEl = document.getElementById('stats-best-pot');
        if (winsEl) winsEl.innerText = this.stats.wins;
        if (handsEl) handsEl.innerText = this.stats.hands;
        if (bestPotEl) bestPotEl.innerText = `$${this.stats.bestPot}`;
    }
};

function resetStats() {
    if (confirm("¿Deseas reiniciar todas tus estadísticas acumuladas?")) {
        StatsManager.reset();
    }
}

// -----------------------------------------------------------------------------
// ESTADO GLOBAL DEL JUEGO
// -----------------------------------------------------------------------------
let gameState = {
    mode: 'holdem',
    deck: [],
    players: [
        { id: 0, name: 'Tú', chips: 1000, hand: [], bet: 0, folded: false, isAi: false, status: '', isAllIn: false, isEliminated: false },
        { id: 1, name: 'Bot 1 (Carlos)', chips: 1000, hand: [], bet: 0, folded: false, isAi: true, status: '', isAllIn: false, isEliminated: false },
        { id: 2, name: 'Bot 2 (Sofía)', chips: 1000, hand: [], bet: 0, folded: false, isAi: true, status: '', isAllIn: false, isEliminated: false },
        { id: 3, name: 'Bot 3 (Lucas)', chips: 1000, hand: [], bet: 0, folded: false, isAi: true, status: '', isAllIn: false, isEliminated: false }
    ],
    communityCards: [],
    pot: 0,
    currentDealer: 0,
    activePlayerIndex: 0,
    currentBet: 0,
    minRaise: 20,
    phase: 'preflop',
    selectedForDiscard: [],
    handOver: false,
    winnerIds: [],
    isAllInRunout: false
};

// -----------------------------------------------------------------------------
// TEMAS (DARK / LIGHT)
// -----------------------------------------------------------------------------
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-mode');
    if (isDark) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        document.getElementById('theme-toggle').checked = false;
        document.getElementById('theme-toggle-game').checked = false;
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        document.getElementById('theme-toggle').checked = true;
        document.getElementById('theme-toggle-game').checked = true;
    }
}

// -----------------------------------------------------------------------------
// BITÁCORA
// -----------------------------------------------------------------------------
function addLog(text, type = 'normal') {
    const logContainer = document.getElementById('game-log');
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = text;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLog() {
    const logContainer = document.getElementById('game-log');
    if (logContainer) logContainer.innerHTML = '';
}

function setTableMsg(msg) {
    const el = document.getElementById('table-msg');
    if (el) el.innerText = msg;
}

// -----------------------------------------------------------------------------
// NAVEGACIÓN Y CONFIGURACIÓN INICIAL
// -----------------------------------------------------------------------------
function startGame(mode) {
    SoundManager.init();
    gameState.mode = mode;
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('game-mode-title').innerText = mode === 'holdem' ? "Texas Hold'em" : "5-Card Draw";

    clearLog();
    addLog(`=== Modalidad: ${mode === 'holdem' ? "Texas Hold'em" : "5-Card Draw"} ===`, 'system');

    // Resetear jugadores si todos estaban eliminados o empezar fresco
    gameState.players.forEach(p => {
        if (p.chips <= 0) p.chips = 1000;
        p.isEliminated = false;
    });

    if (mode === 'draw') {
        document.getElementById('community-area').style.display = 'none';
    } else {
        document.getElementById('community-area').style.display = 'block';
        document.getElementById('draw-actions').classList.add('hidden');
    }

    renderAiPlayers();
    startNewHand();
}

function returnToMenu() {
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
    StatsManager.updateUI();
}

// -----------------------------------------------------------------------------
// GENERACIÓN Y MEZCLA DE BARAJA
// -----------------------------------------------------------------------------
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const val of VALUES) {
            deck.push({ suit, value: val, weight: VALUE_MAP[val] });
        }
    }
    // Barajado Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// -----------------------------------------------------------------------------
// EVALUADOR PROFESIONAL DE MANOS DE PÓKER (5 CARTAS + KICKERS)
// -----------------------------------------------------------------------------
function eval5Cards(fiveCards) {
    const cards = [...fiveCards].sort((a, b) => b.weight - a.weight);
    const values = cards.map(c => c.weight);
    const suits = cards.map(c => c.suit);

    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);

    const quads = [];
    const trips = [];
    const pairs = [];
    const singles = [];

    const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => b - a);
    uniqueValues.forEach(v => {
        const count = counts[v];
        if (count === 4) quads.push(v);
        else if (count === 3) trips.push(v);
        else if (count === 2) pairs.push(v);
        else singles.push(v);
    });

    const isFlush = suits.every(s => s === suits[0]);

    let isStraight = false;
    let straightHigh = 0;

    if (uniqueValues.length === 5) {
        if (values[0] - values[4] === 4) {
            isStraight = true;
            straightHigh = values[0];
        } else if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
            isStraight = true;
            straightHigh = 5; // Escalera rueda A-2-3-4-5
        }
    }

    // 8: Escalera Real / 7: Escalera de Color
    if (isFlush && isStraight) {
        if (straightHigh === 14) {
            return {
                category: 8,
                scoreArray: [8, 14],
                name: 'Escalera Real',
                cards
            };
        }
        return {
            category: 7,
            scoreArray: [7, straightHigh],
            name: `Escalera de Color al ${CARD_NAME_MAP[straightHigh]}`,
            cards
        };
    }

    // 6: Póker
    if (quads.length === 1) {
        const kicker = singles[0];
        return {
            category: 6,
            scoreArray: [6, quads[0], kicker],
            name: `Póker de ${CARD_PLURAL_MAP[quads[0]]} (kicker ${CARD_NAME_MAP[kicker]})`,
            cards
        };
    }

    // 5: Full House
    if (trips.length === 1 && pairs.length === 1) {
        return {
            category: 5,
            scoreArray: [5, trips[0], pairs[0]],
            name: `Full House de ${CARD_PLURAL_MAP[trips[0]]} y ${CARD_PLURAL_MAP[pairs[0]]}`,
            cards
        };
    }

    // 4: Color (Flush)
    if (isFlush) {
        return {
            category: 4,
            scoreArray: [4, ...values],
            name: `Color al ${CARD_NAME_MAP[values[0]]}`,
            cards
        };
    }

    // 3: Escalera (Straight)
    if (isStraight) {
        const suffix = straightHigh === 5 ? ' (Rueda A-2-3-4-5)' : '';
        return {
            category: 3,
            scoreArray: [3, straightHigh],
            name: `Escalera al ${CARD_NAME_MAP[straightHigh]}${suffix}`,
            cards
        };
    }

    // 2: Trío
    if (trips.length === 1) {
        return {
            category: 2,
            scoreArray: [2, trips[0], singles[0], singles[1]],
            name: `Trío de ${CARD_PLURAL_MAP[trips[0]]} (kickers ${CARD_NAME_MAP[singles[0]]}, ${CARD_NAME_MAP[singles[1]]})`,
            cards
        };
    }

    // 1: Doble Pareja
    if (pairs.length === 2) {
        return {
            category: 1,
            scoreArray: [1, pairs[0], pairs[1], singles[0]],
            name: `Doble Pareja de ${CARD_PLURAL_MAP[pairs[0]]} y ${CARD_PLURAL_MAP[pairs[1]]} (kicker ${CARD_NAME_MAP[singles[0]]})`,
            cards
        };
    }

    // 0: Pareja
    if (pairs.length === 1) {
        return {
            category: 0,
            scoreArray: [0, pairs[0], singles[0], singles[1], singles[2]],
            name: `Pareja de ${CARD_PLURAL_MAP[pairs[0]]} (kicker ${CARD_NAME_MAP[singles[0]]})`,
            cards
        };
    }

    // -1: Carta Alta
    return {
        category: -1,
        scoreArray: [-1, ...values],
        name: `Carta Alta (${CARD_NAME_MAP[values[0]]} con kicker ${CARD_NAME_MAP[values[1]]})`,
        cards
    };
}

function compareScoreArrays(arrA, arrB) {
    const len = Math.max(arrA.length, arrB.length);
    for (let i = 0; i < len; i++) {
        const valA = arrA[i] !== undefined ? arrA[i] : -1;
        const valB = arrB[i] !== undefined ? arrB[i] : -1;
        if (valA > valB) return 1;
        if (valA < valB) return -1;
    }
    return 0; // Empate absoluto
}

function getCombinations(arr, k) {
    if (k === arr.length) return [arr];
    if (k === 1) return arr.map(e => [e]);
    const res = [];
    for (let i = 0; i < arr.length - k + 1; i++) {
        const head = arr[i];
        const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
        tailCombos.forEach(c => res.push([head, ...c]));
    }
    return res;
}

function evaluatePlayerHand(player) {
    let pool = [...player.hand];
    if (gameState.mode === 'holdem' && gameState.communityCards.length > 0) {
        pool = pool.concat(gameState.communityCards);
    }

    if (pool.length < 5) {
        const sorted = [...pool].sort((a, b) => b.weight - a.weight);
        if (sorted.length === 2) {
            if (sorted[0].weight === sorted[1].weight) {
                return {
                    name: `Pareja de ${CARD_PLURAL_MAP[sorted[0].weight]}`,
                    scoreArray: [0, sorted[0].weight],
                    category: 0
                };
            }
            return {
                name: `${CARD_NAME_MAP[sorted[0].weight]}-${CARD_NAME_MAP[sorted[1].weight]}`,
                scoreArray: [-1, sorted[0].weight, sorted[1].weight],
                category: -1
            };
        }
        return { name: '', scoreArray: [-1], category: -1 };
    }

    if (pool.length === 5) {
        return eval5Cards(pool);
    }

    // Texas Hold'em con 6 o 7 cartas
    const combos = getCombinations(pool, 5);
    let bestEval = null;

    for (const combo of combos) {
        const currentEval = eval5Cards(combo);
        if (!bestEval || compareScoreArrays(currentEval.scoreArray, bestEval.scoreArray) > 0) {
            bestEval = currentEval;
        }
    }
    return bestEval;
}

// -----------------------------------------------------------------------------
// INICIO DE MANO Y GESTIÓN DE CIEGAS
// -----------------------------------------------------------------------------
function startNewHand() {
    gameState.isAllInRunout = false;
    gameState.players.forEach(p => {
        if (p.chips <= 0) {
            p.isEliminated = true;
            p.folded = true;
        } else {
            p.isEliminated = false;
        }
    });

    const activeTablePlayers = gameState.players.filter(p => !p.isEliminated);
    
    if (gameState.players[0].isEliminated) {
        showModal("Bancarrota", "Te has quedado sin fichas. Puedes recomprar $1000 para continuar jugando.", [
            { text: "Recomprar $1000", action: () => rebuyChips(1000) },
            { text: "Volver al Menú", action: returnToMenu }
        ]);
        return;
    }

    if (activeTablePlayers.length === 1 && activeTablePlayers[0].id === 0) {
        showModal("¡Campeón de la Mesa!", "¡Felicitaciones! Has eliminado a todos los contrincantes y ganado todas las fichas.", [
            { text: "Nueva Partida", action: () => restartGameWithFreshChips() },
            { text: "Volver al Menú", action: returnToMenu }
        ]);
        return;
    }

    gameState.handOver = false;
    gameState.winnerIds = [];
    gameState.selectedForDiscard = [];
    gameState.deck = createDeck();
    gameState.pot = 0;
    gameState.communityCards = [];
    gameState.currentBet = 20;
    gameState.minRaise = 20;

    gameState.players.forEach(p => {
        p.hand = [];
        p.bet = 0;
        p.folded = p.isEliminated;
        p.status = p.isEliminated ? 'Eliminado' : '';
        p.isAllIn = false;
    });

    const cardsCount = gameState.mode === 'holdem' ? 2 : 5;
    for (let i = 0; i < cardsCount; i++) {
        gameState.players.forEach(p => {
            if (!p.isEliminated) {
                p.hand.push(gameState.deck.pop());
            }
        });
    }

    SoundManager.playCard();

    let sbIndex = getNextActivePlayer(gameState.currentDealer);
    let bbIndex = getNextActivePlayer(sbIndex);

    postBlind(sbIndex, 10);
    postBlind(bbIndex, 20);

    StatsManager.recordHand();
    addLog(`--- Nueva Mano --- Dealer: ${gameState.players[gameState.currentDealer].name}`, 'system');
    addLog(`Ciegas: ${gameState.players[sbIndex].name} ($10) / ${gameState.players[bbIndex].name} ($20)`, 'system');

    gameState.activePlayerIndex = getNextActivePlayer(bbIndex);
    gameState.phase = 'preflop';

    if (gameState.mode === 'draw') {
        document.getElementById('draw-actions').classList.add('hidden');
    }

    updateUI();
    setTableMsg("¡Primera ronda de apuestas!");

    if (gameState.players[gameState.activePlayerIndex].isAi) {
        setTimeout(processAiTurn, 900);
    }
}

function getNextActivePlayer(fromIndex) {
    let next = (fromIndex + 1) % gameState.players.length;
    let count = 0;
    while ((gameState.players[next].isEliminated || gameState.players[next].folded) && count < gameState.players.length) {
        next = (next + 1) % gameState.players.length;
        count++;
    }
    return next;
}

function postBlind(playerIndex, amount) {
    const p = gameState.players[playerIndex];
    const actual = Math.min(p.chips, amount);
    p.chips -= actual;
    p.bet += actual;
    gameState.pot += actual;
    if (p.chips === 0) {
        p.isAllIn = true;
        p.status = 'All-in';
    }
    animateChipToCenter(p.id);
}

// -----------------------------------------------------------------------------
// CONTROL DE INTERFAZ Y REVELACIÓN DE CARTAS
// -----------------------------------------------------------------------------
function updateUI() {
    document.getElementById('pot-amount').innerText = `$${gameState.pot}`;
    document.getElementById('center-pot-label').innerText = `$${gameState.pot}`;
    document.getElementById('player-chips').innerText = `$${gameState.players[0].chips}`;

    const playerSpot = document.getElementById('player-spot');
    const isPlayerTurn = !gameState.handOver &&
        gameState.activePlayerIndex === 0 &&
        !gameState.players[0].folded &&
        !gameState.players[0].isEliminated &&
        !gameState.isAllInRunout;

    if (isPlayerTurn && gameState.phase !== 'draw') {
        playerSpot.classList.add('active-turn');
    } else {
        playerSpot.classList.remove('active-turn');
    }

    // Cartas del Jugador Humano
    const container = document.getElementById('player-cards');
    container.innerHTML = '';

    if (!gameState.players[0].folded && !gameState.players[0].isEliminated) {
        gameState.players[0].hand.forEach((card, idx) => {
            const cardEl = createCardElement(card);
            if (gameState.mode === 'draw' && gameState.phase === 'draw' && !gameState.handOver) {
                cardEl.classList.add('selectable');
                if (gameState.selectedForDiscard.includes(idx)) {
                    cardEl.classList.add('selected');
                }
                cardEl.onclick = () => toggleCardSelection(idx);
            }
            container.appendChild(cardEl);
        });
    } else {
        const statusMsg = gameState.players[0].isEliminated ? 'Eliminado' : 'Te retiraste de la mano';
        container.innerHTML = `<span style="color: #e74c3c; font-weight: bold; font-style: italic;">${statusMsg}</span>`;
    }

    // Cartas Comunitarias (Hold'em)
    const commContainer = document.getElementById('community-cards');
    commContainer.innerHTML = '';
    gameState.communityCards.forEach(card => {
        commContainer.appendChild(createCardElement(card));
    });

    // Rango actual de la mano del jugador
    const rankEl = document.getElementById('player-hand-rank');
    if (gameState.players[0].hand.length > 0 && !gameState.players[0].folded && !gameState.players[0].isEliminated) {
        const evalRes = evaluatePlayerHand(gameState.players[0]);
        rankEl.innerText = evalRes.name ? `[${evalRes.name}]` : '';
    } else {
        rankEl.innerText = '';
    }

    // Acciones de Descarte en 5-Card Draw
    if (gameState.mode === 'draw') {
        const drawActions = document.getElementById('draw-actions');
        const confirmBtn = document.getElementById('btn-confirm-draw');
        if (gameState.phase === 'draw' && !gameState.players[0].folded && !gameState.players[0].isEliminated) {
            drawActions.classList.remove('hidden');
            const numSelected = gameState.selectedForDiscard.length;
            confirmBtn.innerText = numSelected === 0 ? "Conservar Cartas (0)" : `Descartar y Cambiar (${numSelected})`;
            confirmBtn.disabled = false;
        } else {
            drawActions.classList.add('hidden');
        }
    }

    renderAiPlayers();
    updateControls();
}

function createCardElement(card) {
    const el = document.createElement('div');
    const isRed = card.suit === '♥' || card.suit === '♦';
    el.className = `card ${isRed ? 'red' : ''}`;
    el.innerHTML = `
        <div class="card-top">${card.value}<br>${card.suit}</div>
        <div class="card-center">${card.suit}</div>
        <div class="card-bottom">${card.value}<br>${card.suit}</div>
    `;
    return el;
}

function renderAiPlayers() {
    const container = document.getElementById('ai-players');
    container.innerHTML = '';

    // ¡REGLA CLAVE!: Se muestran las cartas de los rivales si la mano terminó O si estamos en un All-In Runout
    const showCards = gameState.handOver || (gameState.mode === 'holdem' && gameState.isAllInRunout);

    for (let i = 1; i < gameState.players.length; i++) {
        const p = gameState.players[i];
        const el = document.createElement('div');
        const isWinner = gameState.handOver && gameState.winnerIds.includes(i);
        const isTurn = !gameState.handOver &&
            !gameState.isAllInRunout &&
            gameState.activePlayerIndex === i &&
            gameState.phase !== 'draw';

        el.className = `ai-player ${isTurn ? 'active-turn' : ''} ${isWinner ? 'winner-highlight' : ''} ${p.folded ? 'folded-player' : ''} ${p.isEliminated ? 'eliminated-player' : ''}`;

        let cardsHtml = '';
        if (!p.folded && !p.isEliminated) {
            p.hand.forEach((card, cardIdx) => {
                if (showCards) {
                    const isRed = card.suit === '♥' || card.suit === '♦';
                    cardsHtml += `
                        <div class="card ai-card ${isRed ? 'red' : ''}" style="z-index: ${cardIdx + 1};">
                            <div class="card-top">${card.value}<br>${card.suit}</div>
                            <div class="card-center">${card.suit}</div>
                            <div class="card-bottom">${card.value}<br>${card.suit}</div>
                        </div>
                    `;
                } else {
                    cardsHtml += `<div class="card back ai-card" style="z-index: ${cardIdx + 1};"></div>`;
                }
            });
        } else if (p.isEliminated) {
            cardsHtml = `<span style="font-size:0.7rem; color:#e74c3c;">Sin fichas</span>`;
        } else {
            cardsHtml = `<span style="font-size:0.7rem; color:#e74c3c; font-style:italic;">Retirado</span>`;
        }

        // Mostrar el rango de la mano del bot en vivo si sus cartas están boca arriba
        let aiRankText = '';
        if (showCards && !p.folded && !p.isEliminated && p.hand.length > 0) {
            const aiEval = evaluatePlayerHand(p);
            if (aiEval && aiEval.name) {
                aiRankText = `<br><span style="color:#f1c40f; font-size:0.7rem; font-weight:bold;">${aiEval.name}</span>`;
            }
        }

        el.innerHTML = `
            <div class="ai-name">${p.name} ${isWinner ? '👑' : ''}</div>
            <div class="ai-chips">$${p.chips}</div>
            <div class="cards-container ai-cards-fan">${cardsHtml}</div>
            <div class="ai-status">${p.isEliminated ? 'Eliminado' : (p.folded ? 'Fold' : (p.status || ''))} ${aiRankText}</div>
        `;
        container.appendChild(el);
    }
}

// -----------------------------------------------------------------------------
// CONTROLES DE ACCIÓN DEL JUGADOR HUMANO
// -----------------------------------------------------------------------------
function updateControls() {
    const isPlayerTurn = !gameState.handOver &&
        !gameState.isAllInRunout &&
        gameState.activePlayerIndex === 0 &&
        !gameState.players[0].folded &&
        !gameState.players[0].isEliminated &&
        gameState.phase !== 'draw';

    const p = gameState.players[0];
    const callAmount = gameState.currentBet - p.bet;

    const callBtn = document.getElementById('btn-check-call');
    if (callAmount <= 0) {
        callBtn.innerText = "Check (Pasar)";
    } else if (callAmount >= p.chips) {
        callBtn.innerText = `All-in ($${p.chips})`;
    } else {
        callBtn.innerText = `Call ($${callAmount})`;
    }

    const slider = document.getElementById('raise-slider');
    const minPossibleRaise = gameState.currentBet + gameState.minRaise;
    slider.min = Math.min(minPossibleRaise, p.bet + p.chips);
    slider.max = p.bet + p.chips;
    
    const canRaise = p.chips > callAmount;
    document.getElementById('btn-raise').disabled = !isPlayerTurn || !canRaise;

    slider.disabled = !isPlayerTurn || !canRaise;
    if (canRaise) {
        slider.value = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), parseInt(slider.value) || parseInt(slider.min)));
        updateRaiseVal(slider.value);
    } else {
        document.getElementById('raise-val-label').innerText = `$${slider.max}`;
    }

    document.getElementById('btn-fold').disabled = !isPlayerTurn;
    callBtn.disabled = !isPlayerTurn;
}

function updateRaiseVal(val) {
    document.getElementById('raise-val-label').innerText = `$${val}`;
}

function adjustBet(amount) {
    const slider = document.getElementById('raise-slider');
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const current = parseInt(slider.value) || min;
    const newVal = Math.min(max, Math.max(min, current + amount));
    slider.value = newVal;
    updateRaiseVal(newVal);
}

function setQuickBet(type) {
    const p = gameState.players[0];
    const slider = document.getElementById('raise-slider');
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);

    if (type === 'min') {
        slider.value = min;
    } else if (type === 'half-pot') {
        const halfPot = Math.floor(gameState.pot / 2);
        slider.value = Math.min(max, Math.max(min, p.bet + halfPot));
    } else if (type === 'pot') {
        slider.value = Math.min(max, Math.max(min, p.bet + gameState.pot));
    } else if (type === 'allin') {
        slider.value = max;
    }
    updateRaiseVal(slider.value);
}

// -----------------------------------------------------------------------------
// ANIMACIONES VISUALES
// -----------------------------------------------------------------------------
function animateChipToCenter(playerId) {
    SoundManager.playChip();
    const container = document.getElementById('flying-chips-container');
    const table = document.getElementById('table-container');
    if (!container || !table) return;

    const chip = document.createElement('div');
    chip.className = 'flying-chip';

    let startX = table.clientWidth / 2;
    let startY = table.clientHeight - 60;

    if (playerId === 1) { startX = 60; startY = table.clientHeight / 2; }
    else if (playerId === 2) { startX = table.clientWidth / 2; startY = 40; }
    else if (playerId === 3) { startX = table.clientWidth - 60; startY = table.clientHeight / 2; }

    const centerX = table.clientWidth / 2 - 8;
    const centerY = table.clientHeight / 2 - 15;

    chip.style.setProperty('--startX', `${startX}px`);
    chip.style.setProperty('--startY', `${startY}px`);
    chip.style.setProperty('--centerX', `${centerX}px`);
    chip.style.setProperty('--centerY', `${centerY}px`);

    container.appendChild(chip);
    setTimeout(() => chip.remove(), 500);
}

function animateCardsFromCenter(count, targetPlayerId) {
    SoundManager.playCard();
    const container = document.getElementById('flying-cards-container');
    const table = document.getElementById('table-container');
    if (!container || !table) return;

    const centerX = table.clientWidth / 2 - 20;
    const centerY = table.clientHeight / 2 - 30;

    let targetX = table.clientWidth / 2 - 20;
    let targetY = table.clientHeight - 80;

    if (targetPlayerId === 1) { targetX = 50; targetY = table.clientHeight / 2 - 25; }
    else if (targetPlayerId === 2) { targetX = table.clientWidth / 2 - 20; targetY = 30; }
    else if (targetPlayerId === 3) { targetX = table.clientWidth - 80; targetY = table.clientHeight / 2 - 25; }

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const flyingCard = document.createElement('div');
            flyingCard.className = 'flying-deal-card';
            flyingCard.style.setProperty('--centerX', `${centerX}px`);
            flyingCard.style.setProperty('--centerY', `${centerY}px`);
            flyingCard.style.setProperty('--targetX', `${targetX + (i * 10)}px`);
            flyingCard.style.setProperty('--targetY', `${targetY}px`);

            container.appendChild(flyingCard);
            setTimeout(() => flyingCard.remove(), 500);
        }, i * 90);
    }
}

function animateChipsToWinner(winnerId) {
    const container = document.getElementById('flying-chips-container');
    const table = document.getElementById('table-container');
    if (!container || !table) return;

    const centerX = table.clientWidth / 2 - 8;
    const centerY = table.clientHeight / 2 - 15;

    let targetX = table.clientWidth / 2;
    let targetY = table.clientHeight - 60;

    if (winnerId === 1) { targetX = 60; targetY = table.clientHeight / 2; }
    else if (winnerId === 2) { targetX = table.clientWidth / 2; targetY = 40; }
    else if (winnerId === 3) { targetX = table.clientWidth - 60; targetY = table.clientHeight / 2; }

    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            const chip = document.createElement('div');
            chip.className = 'flying-chip-to-winner';
            chip.style.setProperty('--centerX', `${centerX + (Math.random() * 20 - 10)}px`);
            chip.style.setProperty('--centerY', `${centerY + (Math.random() * 20 - 10)}px`);
            chip.style.setProperty('--winX', `${targetX}px`);
            chip.style.setProperty('--winY', `${targetY}px`);

            container.appendChild(chip);
            setTimeout(() => chip.remove(), 600);
        }, i * 60);
    }
}

// -----------------------------------------------------------------------------
// ACCIÓN DEL JUGADOR HUMANO
// -----------------------------------------------------------------------------
function playerAction(action) {
    if (gameState.handOver || gameState.phase === 'draw' || gameState.isAllInRunout) return;
    const p = gameState.players[0];
    const callAmount = gameState.currentBet - p.bet;

    if (action === 'fold') {
        p.folded = true;
        p.status = 'Fold';
        SoundManager.playFold();
        addLog(`${p.name} se retira (Fold).`, 'action');
    } else if (action === 'call') {
        if (callAmount <= 0) {
            p.status = 'Check';
            SoundManager.playCheck();
            addLog(`${p.name} pasa (Check).`, 'action');
        } else {
            const actual = Math.min(p.chips, callAmount);
            p.chips -= actual;
            p.bet += actual;
            gameState.pot += actual;
            if (p.chips === 0) {
                p.isAllIn = true;
                p.status = 'All-in';
                addLog(`${p.name} va All-in ($${p.bet})!`, 'action');
            } else {
                p.status = 'Call';
                addLog(`${p.name} iguala la apuesta (Call $${actual}).`, 'action');
            }
            animateChipToCenter(0);
        }
    } else if (action === 'raise') {
        const raiseVal = parseInt(document.getElementById('raise-slider').value);
        const diff = raiseVal - p.bet;
        const actual = Math.min(p.chips, diff);
        p.chips -= actual;
        p.bet += actual;
        gameState.pot += actual;

        const previousBet = gameState.currentBet;
        gameState.currentBet = p.bet;
        gameState.minRaise = Math.max(20, p.bet - previousBet);

        if (p.chips === 0) {
            p.isAllIn = true;
            p.status = 'All-in';
            addLog(`${p.name} sube y va All-in a $${p.bet}!`, 'action');
        } else {
            p.status = 'Raise';
            addLog(`${p.name} sube la apuesta (Raise) a $${p.bet}.`, 'action');
        }

        resetOtherPlayersStatus(0);
        animateChipToCenter(0);
    }

    nextTurn();
}

function resetOtherPlayersStatus(raiserId) {
    gameState.players.forEach(p => {
        if (p.id !== raiserId && !p.folded && !p.isEliminated && !p.isAllIn) {
            p.status = '';
        }
    });
}

// -----------------------------------------------------------------------------
// CONTROL DE TURNOS Y FASES DE LA RONDA
// -----------------------------------------------------------------------------
function nextTurn() {
    const activePlayers = gameState.players.filter(p => !p.folded && !p.isEliminated);

    if (activePlayers.length === 1) {
        endHandByFold(activePlayers[0]);
        return;
    }

    if (isRoundComplete()) {
        advancePhase();
    } else {
        gameState.activePlayerIndex = getNextActionPlayerIndex(gameState.activePlayerIndex);
        updateUI();
        if (gameState.players[gameState.activePlayerIndex].isAi && gameState.phase !== 'draw') {
            setTimeout(processAiTurn, 850);
        }
    }
}

function getNextActionPlayerIndex(fromIndex) {
    let next = (fromIndex + 1) % gameState.players.length;
    let count = 0;
    while ((gameState.players[next].folded || gameState.players[next].isEliminated || gameState.players[next].isAllIn) && count < gameState.players.length) {
        next = (next + 1) % gameState.players.length;
        count++;
    }
    return next;
}

function isRoundComplete() {
    const active = gameState.players.filter(p => !p.folded && !p.isEliminated);
    const nonAllIn = active.filter(p => !p.isAllIn);

    if (nonAllIn.length <= 1) {
        const maxBet = Math.max(...active.map(p => p.bet));
        const allMatched = nonAllIn.every(p => p.bet === maxBet);
        const allActed = nonAllIn.every(p => p.status !== '');
        if (allMatched && allActed) return true;
    }

    const maxBet = Math.max(...active.map(p => p.bet));
    const allMatched = active.every(p => p.bet === maxBet || p.isAllIn);
    const allActed = active.every(p => p.status !== '' || p.isAllIn);

    return allMatched && allActed;
}

// Comprueba si se debe iniciar el runout con cartas de rivales a la vista
function checkAllInRunout() {
    if (gameState.mode !== 'holdem') return false;
    const active = gameState.players.filter(p => !p.folded && !p.isEliminated);
    if (active.length <= 1) return false;
    const playersWithChips = active.filter(p => p.chips > 0);
    return playersWithChips.length <= 1;
}

function advancePhase() {
    gameState.players.forEach(p => {
        p.bet = 0;
        if (!p.folded && !p.isEliminated && !p.isAllIn) {
            p.status = '';
        }
    });
    gameState.currentBet = 0;
    gameState.minRaise = 20;

    // SITUACIÓN DE ALL-IN EN TEXAS HOLD'EM:
    // Todos jugaron sus fichas o solo queda 1 con fichas frente a rivales All-in
    if (checkAllInRunout()) {
        startAllInRunoutSequence();
        return;
    }

    if (gameState.mode === 'holdem') {
        if (gameState.phase === 'preflop') {
            gameState.phase = 'flop';
            gameState.communityCards.push(gameState.deck.pop(), gameState.deck.pop(), gameState.deck.pop());
            SoundManager.playCard();
            setTableMsg("Flop repartido. ¡Ronda de apuestas!");
            addLog("Se reparte el Flop (3 cartas comunitarias).", 'system');
        } else if (gameState.phase === 'flop') {
            gameState.phase = 'turn';
            gameState.communityCards.push(gameState.deck.pop());
            SoundManager.playCard();
            setTableMsg("Turn repartido. ¡Ronda de apuestas!");
            addLog("Se reparte el Turn (4ª carta comunitaria).", 'system');
        } else if (gameState.phase === 'turn') {
            gameState.phase = 'river';
            gameState.communityCards.push(gameState.deck.pop());
            SoundManager.playCard();
            setTableMsg("River repartido. ¡Ronda de apuestas final!");
            addLog("Se reparte el River (5ª carta comunitaria).", 'system');
        } else if (gameState.phase === 'river') {
            showdown();
            return;
        }
    } else {
        // Modo 5-Card Draw
        if (gameState.phase === 'preflop') {
            gameState.phase = 'draw';
            setTableMsg("¡Fase de descarte! Selecciona cartas a cambiar y presiona el botón.");
            addLog("Fase de descarte iniciada.", 'system');
            updateUI();
            return;
        } else if (gameState.phase === 'betting') {
            showdown();
            return;
        }
    }

    gameState.activePlayerIndex = getNextActivePlayer(gameState.currentDealer);
    updateUI();

    if (gameState.players[gameState.activePlayerIndex].isAi && gameState.phase !== 'draw') {
        setTimeout(processAiTurn, 850);
    }
}

// SECUENCIA DE RUNOUT DE ALL-IN: REVELA CARTAS DE LOS RIVALES Y REPARTE LA MESA PASO A PASO
function startAllInRunoutSequence() {
    gameState.isAllInRunout = true;
    setTableMsg("¡ALL-IN! Cartas boca arriba. Repartiendo mesa...");
    addLog("¡ALL-IN! No hay más apuestas posibles. Se revelan las cartas de todos los rivales.", 'system');
    SoundManager.playCard();
    updateUI(); // ¡Inmediatamente da vuelta las cartas de todos los rivales!

    function runStep() {
        if (gameState.phase === 'preflop') {
            gameState.phase = 'flop';
            gameState.communityCards.push(gameState.deck.pop(), gameState.deck.pop(), gameState.deck.pop());
            SoundManager.playCard();
            setTableMsg("¡All-In! Flop repartido en la mesa...");
            addLog("All-In: Se reparte el Flop.", 'system');
            updateUI();
            setTimeout(runStep, 1500);
        } else if (gameState.phase === 'flop') {
            gameState.phase = 'turn';
            gameState.communityCards.push(gameState.deck.pop());
            SoundManager.playCard();
            setTableMsg("¡All-In! Turn repartido en la mesa...");
            addLog("All-In: Se reparte el Turn.", 'system');
            updateUI();
            setTimeout(runStep, 1500);
        } else if (gameState.phase === 'turn') {
            gameState.phase = 'river';
            gameState.communityCards.push(gameState.deck.pop());
            SoundManager.playCard();
            setTableMsg("¡All-In! River final repartido...");
            addLog("All-In: Se reparte el River final.", 'system');
            updateUI();
            setTimeout(runStep, 1500);
        } else {
            showdown();
        }
    }

    // Pequeña pausa inicial de 1.2s para observar las cartas de los rivales antes de que caigan las cartas comunitarias
    setTimeout(runStep, 1300);
}

// -----------------------------------------------------------------------------
// INTELIGENCIA ARTIFICIAL ESTRATÉGICA
// -----------------------------------------------------------------------------
function processAiTurn() {
    if (gameState.handOver || gameState.phase === 'draw' || gameState.isAllInRunout) return;
    const ai = gameState.players[gameState.activePlayerIndex];
    if (ai.folded || ai.isEliminated || ai.isAllIn) {
        nextTurn();
        return;
    }

    const callAmount = gameState.currentBet - ai.bet;
    const potOdds = gameState.pot > 0 ? callAmount / (gameState.pot + callAmount) : 0;
    const evalRes = evaluatePlayerHand(ai);
    const category = evalRes.category !== undefined ? evalRes.category : -1;
    const rand = Math.random();

    if (callAmount === 0) {
        const shouldRaise = (category >= 1 && rand < 0.45) || (category >= 3) || (rand < 0.12);
        if (shouldRaise && ai.chips > 40) {
            aiRaise(ai, 40);
        } else {
            ai.status = 'Check';
            SoundManager.playCheck();
            addLog(`${ai.name} pasa (Check).`, 'action');
            finishAiAction();
        }
        return;
    }

    let strength = 0.3;
    if (gameState.mode === 'holdem') {
        if (gameState.phase === 'preflop') {
            const c1 = ai.hand[0].weight;
            const c2 = ai.hand[1].weight;
            const isPair = c1 === c2;
            const highCard = Math.max(c1, c2);
            const suited = ai.hand[0].suit === ai.hand[1].suit;

            if (isPair) strength = c1 >= 10 ? 0.9 : 0.65;
            else if (highCard >= 13) strength = suited ? 0.75 : 0.6;
            else if (highCard >= 11 && suited) strength = 0.55;
            else strength = 0.25;
        } else {
            if (category >= 3) strength = 0.95;
            else if (category === 2) strength = 0.85;
            else if (category === 1) strength = 0.70;
            else if (category === 0) strength = 0.45;
            else strength = 0.20;
        }
    } else {
        if (category >= 2) strength = 0.90;
        else if (category === 1) strength = 0.70;
        else if (category === 0) strength = 0.50;
        else strength = 0.25;
    }

    if (strength > 0.8 && ai.chips > callAmount + 40 && rand < 0.4) {
        aiRaise(ai, callAmount + 40);
    } else if (strength >= potOdds || callAmount <= 20 || (rand < 0.15 && callAmount <= 50)) {
        const actual = Math.min(ai.chips, callAmount);
        ai.chips -= actual;
        ai.bet += actual;
        gameState.pot += actual;
        if (ai.chips === 0) {
            ai.isAllIn = true;
            ai.status = 'All-in';
            addLog(`${ai.name} paga y va All-in ($${ai.bet})!`, 'action');
        } else {
            ai.status = 'Call';
            addLog(`${ai.name} iguala la apuesta (Call $${actual}).`, 'action');
        }
        animateChipToCenter(ai.id);
        finishAiAction();
    } else {
        ai.folded = true;
        ai.status = 'Fold';
        SoundManager.playFold();
        addLog(`${ai.name} se retira (Fold).`, 'action');
        finishAiAction();
    }
}

function aiRaise(ai, amount) {
    const minRaiseTotal = gameState.currentBet + gameState.minRaise;
    const targetBet = Math.max(minRaiseTotal, ai.bet + amount);
    const diff = targetBet - ai.bet;
    const actual = Math.min(ai.chips, diff);

    ai.chips -= actual;
    ai.bet += actual;
    gameState.pot += actual;

    const previousBet = gameState.currentBet;
    gameState.currentBet = ai.bet;
    gameState.minRaise = Math.max(20, ai.bet - previousBet);

    if (ai.chips === 0) {
        ai.isAllIn = true;
        ai.status = 'All-in';
        addLog(`${ai.name} sube y va All-in a $${ai.bet}!`, 'action');
    } else {
        ai.status = 'Raise';
        addLog(`${ai.name} sube la apuesta (Raise) a $${ai.bet}.`, 'action');
    }

    resetOtherPlayersStatus(ai.id);
    animateChipToCenter(ai.id);
    finishAiAction();
}

function finishAiAction() {
    updateUI();
    setTimeout(nextTurn, 850);
}

// -----------------------------------------------------------------------------
// FASE DE DESCARTE EN 5-CARD DRAW
// -----------------------------------------------------------------------------
function toggleCardSelection(idx) {
    if (gameState.phase !== 'draw' || gameState.handOver) return;
    const pos = gameState.selectedForDiscard.indexOf(idx);
    if (pos > -1) {
        gameState.selectedForDiscard.splice(pos, 1);
    } else {
        if (gameState.selectedForDiscard.length < 4) {
            gameState.selectedForDiscard.push(idx);
        }
    }
    updateUI();
}

function confirmDiscard() {
    if (gameState.phase !== 'draw') return;

    const count = gameState.selectedForDiscard.length;
    if (count > 0) {
        animateCardsFromCenter(count, 0);
        gameState.selectedForDiscard.sort((a, b) => b - a).forEach(idx => {
            gameState.players[0].hand[idx] = gameState.deck.pop();
        });
        addLog(`Tú cambiaste ${count} carta(s).`, 'action');
    } else {
        addLog(`Tú conservaste todas tus cartas.`, 'action');
    }
    gameState.selectedForDiscard = [];

    for (let i = 1; i < gameState.players.length; i++) {
        const ai = gameState.players[i];
        if (!ai.folded && !ai.isEliminated) {
            const discardIndices = getAiDiscardIndices(ai.hand);
            if (discardIndices.length > 0) {
                animateCardsFromCenter(discardIndices.length, ai.id);
                discardIndices.forEach(idx => {
                    ai.hand[idx] = gameState.deck.pop();
                });
                addLog(`${ai.name} cambió ${discardIndices.length} carta(s).`, 'action');
            } else {
                addLog(`${ai.name} conservó sus cartas (pat).`, 'action');
            }
        }
    }

    gameState.phase = 'betting';
    setTableMsg("Cartas cambiadas. ¡Última ronda de apuestas!");

    gameState.activePlayerIndex = getNextActivePlayer(gameState.currentDealer);
    updateUI();

    if (gameState.players[gameState.activePlayerIndex].isAi) {
        setTimeout(processAiTurn, 900);
    }
}

function getAiDiscardIndices(hand) {
    const evalRes = eval5Cards(hand);
    const cat = evalRes.category;

    if (cat >= 3) return [];

    const counts = {};
    hand.forEach(c => counts[c.weight] = (counts[c.weight] || 0) + 1);

    if (cat === 2) {
        const tripVal = Object.keys(counts).map(Number).find(v => counts[v] === 3);
        const indices = [];
        hand.forEach((c, idx) => {
            if (c.weight !== tripVal) indices.push(idx);
        });
        return indices.slice(0, 2);
    }

    if (cat === 1) {
        const pairVals = Object.keys(counts).map(Number).filter(v => counts[v] === 2);
        const indices = [];
        hand.forEach((c, idx) => {
            if (!pairVals.includes(c.weight)) indices.push(idx);
        });
        return indices.slice(0, 1);
    }

    if (cat === 0) {
        const pairVal = Object.keys(counts).map(Number).find(v => counts[v] === 2);
        const indices = [];
        hand.forEach((c, idx) => {
            if (c.weight !== pairVal) indices.push(idx);
        });
        return indices.slice(0, 3);
    }

    const suitCounts = {};
    hand.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
    for (const suit in suitCounts) {
        if (suitCounts[suit] === 4) {
            const idx = hand.findIndex(c => c.suit !== suit);
            return [idx];
        }
    }

    const sortedIndices = hand.map((c, idx) => ({ weight: c.weight, idx }))
                              .sort((a, b) => b.weight - a.weight);
    return [sortedIndices[2].idx, sortedIndices[3].idx, sortedIndices[4].idx];
}

// -----------------------------------------------------------------------------
// SHOWDOWN Y RESOLUCIÓN EXACTA (SPLIT POT Y KICKERS)
// -----------------------------------------------------------------------------
function showdown() {
    gameState.handOver = true;
    gameState.isAllInRunout = false;
    const active = gameState.players.filter(p => !p.folded && !p.isEliminated);

    const evaluated = active.map(p => ({
        player: p,
        eval: evaluatePlayerHand(p)
    }));

    evaluated.sort((a, b) => compareScoreArrays(b.eval.scoreArray, a.eval.scoreArray));

    const bestEval = evaluated[0].eval;
    const winners = evaluated.filter(e => compareScoreArrays(e.eval.scoreArray, bestEval.scoreArray) === 0)
                             .map(e => e.player);

    gameState.winnerIds = winners.map(w => w.id);
    updateUI();

    const splitAmount = Math.floor(gameState.pot / winners.length);
    const isHumanWinner = gameState.winnerIds.includes(0);

    winners.forEach(w => {
        w.chips += splitAmount;
        animateChipsToWinner(w.id);
    });

    if (isHumanWinner) {
        SoundManager.playWin();
        StatsManager.recordWin(splitAmount);
    }

    const handDesc = bestEval.name;
    let resultMsg = "";
    if (winners.length === 1) {
        const winner = winners[0];
        resultMsg = `¡${winner.name} gana el pozo de $${gameState.pot} con ${handDesc}!`;
        addLog(resultMsg, 'system');
        setTimeout(() => {
            showModal("¡Fin de la Mano!", `${winner.name} gana el pozo de $${gameState.pot} con ${handDesc}.`);
        }, 800);
    } else {
        const names = winners.map(w => w.name).join(' y ');
        resultMsg = `¡Empate entre ${names}! Se reparte el pozo de $${gameState.pot} ($${splitAmount} c/u) con ${handDesc}.`;
        addLog(resultMsg, 'system');
        setTimeout(() => {
            showModal("¡Empate! (Split Pot)", `${resultMsg}`);
        }, 800);
    }
}

function endHandByFold(winner) {
    gameState.handOver = true;
    gameState.isAllInRunout = false;
    gameState.winnerIds = [winner.id];
    updateUI();

    winner.chips += gameState.pot;
    animateChipsToWinner(winner.id);

    if (winner.id === 0) {
        SoundManager.playWin();
        StatsManager.recordWin(gameState.pot);
    }

    const msg = `${winner.name} gana el pozo de $${gameState.pot} porque todos los demás se retiraron.`;
    addLog(msg, 'system');

    setTimeout(() => {
        showModal("¡Mano Ganada!", msg);
    }, 700);
}

// -----------------------------------------------------------------------------
// GESTIÓN DE MODALES, REBUY Y CONTINUACIÓN
// -----------------------------------------------------------------------------
function showModal(title, text, customActions = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;

    const actionsContainer = document.getElementById('modal-actions');
    actionsContainer.innerHTML = '';

    if (customActions && customActions.length > 0) {
        customActions.forEach((actionItem, idx) => {
            const btn = document.createElement('button');
            btn.className = idx === 0 ? 'btn-primary' : 'btn-secondary';
            btn.innerText = actionItem.text;
            btn.onclick = () => {
                closeModalRaw();
                actionItem.action();
            };
            actionsContainer.appendChild(btn);
        });
    } else {
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.innerText = 'Siguiente Mano';
        btn.onclick = closeModal;
        actionsContainer.appendChild(btn);
    }

    document.getElementById('modal-msg').classList.remove('hidden');
}

function closeModalRaw() {
    document.getElementById('modal-msg').classList.add('hidden');
}

function closeModal() {
    closeModalRaw();
    gameState.currentDealer = getNextActivePlayer(gameState.currentDealer);
    startNewHand();
}

function rebuyChips(amount = 1000) {
    gameState.players[0].chips = amount;
    gameState.players[0].isEliminated = false;
    addLog(`Has recomprado $${amount} fichas. ¡Bienvenido de vuelta a la mesa!`, 'system');
    startNewHand();
}

function restartGameWithFreshChips() {
    gameState.players.forEach(p => {
        p.chips = 1000;
        p.isEliminated = false;
        p.folded = false;
    });
    addLog("Mesa reiniciada con $1000 para cada jugador. ¡Suerte!", 'system');
    startNewHand();
}

// Inicialización de estadísticas al cargar
document.addEventListener('DOMContentLoaded', () => {
    StatsManager.load();
});
