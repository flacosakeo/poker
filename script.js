// POKER GAME LOGIC - TEXAS HOLD'EM & 5-CARD DRAW

const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const CARD_NAME_MAP = {
    '14': 'AS',
    '13': 'K',
    '12': 'Q',
    '11': 'J',
    '10': '10',
    '9': '9',
    '8': '8',
    '7': '7',
    '6': '6',
    '5': '5',
    '4': '4',
    '3': '3',
    '2': '2'
};

let gameState = {
    mode: 'holdem',
    deck: [],
    players: [
        { id: 0, name: 'Tú', chips: 1000, hand: [], bet: 0, folded: false, isAi: false, status: '' },
        { id: 1, name: 'Bot 1 (Carlos)', chips: 1000, hand: [], bet: 0, folded: false, isAi: true, status: '' },
        { id: 2, name: 'Bot 2 (Sofía)', chips: 1000, hand: [], bet: 0, folded: false, isAi: true, status: '' },
        { id: 3, name: 'Bot 3 (Lucas)', chips: 1000, hand: [], bet: 0, folded: false, isAi: true, status: '' }
    ],
    communityCards: [],
    pot: 0,
    currentDealer: 0,
    activePlayerIndex: 0,
    currentBet: 0,
    minRaise: 50,
    phase: 'preflop',
    selectedForDiscard: [],
    handOver: false,
    winnerId: null
};

function toggleTheme() {
    let body = document.body;
    let isDark = body.classList.contains('dark-mode');
    
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

function addLog(text, type = 'normal') {
    let logContainer = document.getElementById('game-log');
    if (!logContainer) return;
    let entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = text;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function startGame(mode) {
    gameState.mode = mode;
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('game-mode-title').innerText = mode === 'holdem' ? "Texas Hold'em" : "5-Card Draw";
    
    document.getElementById('game-log').innerHTML = '';
    addLog(`Modo seleccionado: ${mode === 'holdem' ? "Texas Hold'em" : "5-Card Draw"}`, 'system');

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
}

function createDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let val of VALUES) {
            deck.push({ suit, value: val, weight: VALUE_MAP[val] });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function startNewHand() {
    gameState.handOver = false;
    gameState.winnerId = null;
    gameState.selectedForDiscard = [];
    gameState.deck = createDeck();
    gameState.pot = 0;
    gameState.communityCards = [];
    gameState.currentBet = 20; 
    
    gameState.players.forEach(p => {
        p.hand = [];
        p.bet = 0;
        p.folded = false;
        p.status = '';
    });

    let cardsCount = gameState.mode === 'holdem' ? 2 : 5;
    for (let i = 0; i < cardsCount; i++) {
        gameState.players.forEach(p => {
            p.hand.push(gameState.deck.pop());
        });
    }

    let sbIndex = (gameState.currentDealer + 1) % gameState.players.length;
    let bbIndex = (gameState.currentDealer + 2) % gameState.players.length;
    
    postBlind(sbIndex, 10, sbIndex);
    postBlind(bbIndex, 20, bbIndex);

    addLog(`--- Nueva Mano --- Ciega pequeña: ${gameState.players[sbIndex].name} ($10), Ciega grande: ${gameState.players[bbIndex].name} ($20)`, 'system');

    gameState.activePlayerIndex = (bbIndex + 1) % gameState.players.length;
    gameState.phase = 'preflop';

    if (gameState.mode === 'draw') {
        document.getElementById('draw-actions').classList.add('hidden');
    }

    updateUI();
    setTableMsg("¡Primera ronda de apuestas!");

    if (gameState.players[gameState.activePlayerIndex].isAi) {
        setTimeout(processAiTurn, 1000);
    }
}

function postBlind(playerIndex, amount, sourceId) {
    let p = gameState.players[playerIndex];
    let actual = Math.min(p.chips, amount);
    p.chips -= actual;
    p.bet += actual;
    gameState.pot += actual;
    animateChipToCenter(sourceId);
}

function updateUI() {
    document.getElementById('pot-amount').innerText = `$${gameState.pot}`;
    document.getElementById('center-pot-label').innerText = `$${gameState.pot}`;
    document.getElementById('player-chips').innerText = `$${gameState.players[0].chips}`;
    
    let playerSpot = document.getElementById('player-spot');
    if (!gameState.handOver && gameState.activePlayerIndex === 0 && !gameState.players[0].folded) {
        playerSpot.classList.add('active-turn');
    } else {
        playerSpot.classList.remove('active-turn');
    }

    let container = document.getElementById('player-cards');
    container.innerHTML = '';
    
    if (!gameState.players[0].folded) {
        gameState.players[0].hand.forEach((card, idx) => {
            let cardEl = createCardElement(card);
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
        container.innerHTML = `<span style="color: #e74c3c; font-weight: bold; font-style: italic;">Te retiraste de la mano</span>`;
    }

    let commContainer = document.getElementById('community-cards');
    commContainer.innerHTML = '';
    gameState.communityCards.forEach(card => {
        commContainer.appendChild(createCardElement(card));
    });

    if (gameState.players[0].hand.length > 0 && !gameState.players[0].folded) {
        let evalRes = evaluatePlayerHand(gameState.players[0]);
        document.getElementById('player-hand-rank').innerText = gameState.handOver ? `Ganó con: ${evalRes.name}` : evalRes.name;
    } else {
        document.getElementById('player-hand-rank').innerText = '';
    }

    if (gameState.mode === 'draw') {
        let drawActions = document.getElementById('draw-actions');
        let confirmBtn = document.getElementById('btn-confirm-draw');
        if (gameState.phase === 'draw' && !gameState.players[0].folded) {
            drawActions.classList.remove('hidden');
            if (confirmBtn) {
                confirmBtn.disabled = gameState.selectedForDiscard.length === 0;
            }
        } else {
            drawActions.classList.add('hidden');
        }
    }

    renderAiPlayers();
    updateControls();
}

function createCardElement(card) {
    let el = document.createElement('div');
    let isRed = card.suit === '♥' || card.suit === '♦';
    el.className = `card ${isRed ? 'red' : ''}`;
    el.innerHTML = `
        <div class="card-top">${card.value}<br>${card.suit}</div>
        <div class="card-center">${card.suit}</div>
        <div class="card-bottom">${card.value}<br>${card.suit}</div>
    `;
    return el;
}

function renderAiPlayers() {
    let container = document.getElementById('ai-players');
    container.innerHTML = '';
    for (let i = 1; i < gameState.players.length; i++) {
        let p = gameState.players[i];
        let el = document.createElement('div');
        let isWinner = gameState.handOver && gameState.winnerId === i;
        
        el.className = `ai-player ${!gameState.handOver && gameState.activePlayerIndex === i && gameState.phase !== 'draw' ? 'active-turn' : ''} ${isWinner ? 'winner-highlight' : ''} ${p.folded ? 'folded-player' : ''}`;
        
        let cardsHtml = '';
        if (!p.folded) {
            p.hand.forEach(card => {
                if (gameState.handOver || !p.isAi) {
                    let isRed = card.suit === '♥' || card.suit === '♦';
                    cardsHtml += `
                        <div class="card ${isRed ? 'red' : ''}">
                            <div class="card-top">${card.value}<br>${card.suit}</div>
                            <div class="card-center">${card.suit}</div>
                            <div class="card-bottom">${card.value}<br>${card.suit}</div>
                        </div>
                    `;
                } else {
                    cardsHtml += `<div class="card back"></div>`;
                }
            });
        } else {
            cardsHtml = `<span style="font-size:0.7rem; color:#e74c3c; font-style:italic;">Retirado</span>`;
        }

        let aiRankText = '';
        if (gameState.handOver && !p.folded) {
            aiRankText = `<br><span style="color:#f1c40f; font-size:0.7rem;">${evaluatePlayerHand(p).name}</span>`;
        }

        el.innerHTML = `
            <div class="ai-name">${p.name} ${isWinner ? '👑' : ''}</div>
            <div class="ai-chips">$${p.chips}</div>
            <div class="cards-container">${cardsHtml}</div>
            <div class="ai-status">${p.folded ? 'Retirado' : (p.status || '')} ${aiRankText}</div>
        `;
        container.appendChild(el);
    }
}

function updateControls() {
    let isPlayerTurn = !gameState.handOver && gameState.activePlayerIndex === 0 && !gameState.players[0].folded;
    if (gameState.mode === 'draw' && gameState.phase === 'draw') {
        isPlayerTurn = false;
    }

    let callAmount = gameState.currentBet - gameState.players[0].bet;
    document.getElementById('btn-check-call').innerText = callAmount === 0 ? "Check" : `Call ($${callAmount})`;
    
    let slider = document.getElementById('raise-slider');
    slider.min = gameState.currentBet + 10;
    slider.max = gameState.players[0].chips;
    slider.value = Math.min(slider.max, parseInt(slider.min));
    updateRaiseVal(slider.value);

    let disabled = !isPlayerTurn;
    document.getElementById('btn-fold').disabled = disabled;
    document.getElementById('btn-check-call').disabled = disabled;
    document.getElementById('btn-raise').disabled = disabled;
}

function updateRaiseVal(val) {
    document.getElementById('raise-val-label').innerText = `$${val}`;
}

function adjustBet(amount) {
    let slider = document.getElementById('raise-slider');
    let newVal = Math.min(parseInt(slider.max), Math.max(parseInt(slider.min), parseInt(slider.value) + amount));
    slider.value = newVal;
    updateRaiseVal(newVal);
}

function animateChipToCenter(playerId) {
    let container = document.getElementById('flying-chips-container');
    let table = document.getElementById('table-container');
    if (!container || !table) return;

    let chip = document.createElement('div');
    chip.className = 'flying-chip';

    let startX = table.clientWidth / 2;
    let startY = table.clientHeight - 60;

    if (playerId === 1) { startX = 60; startY = table.clientHeight / 2; }
    else if (playerId === 2) { startX = table.clientWidth / 2; startY = 40; }
    else if (playerId === 3) { startX = table.clientWidth - 60; startY = table.clientHeight / 2; }

    let centerX = table.clientWidth / 2 - 8;
    let centerY = table.clientHeight / 2 - 15;

    chip.style.setProperty('--startX', `${startX}px`);
    chip.style.setProperty('--startY', `${startY}px`);
    chip.style.setProperty('--centerX', `${centerX}px`);
    chip.style.setProperty('--centerY', `${centerY}px`);

    container.appendChild(chip);
    setTimeout(() => chip.remove(), 500);
}

function animateCardsFromCenter(count, targetPlayerId) {
    let container = document.getElementById('flying-cards-container');
    let table = document.getElementById('table-container');
    if (!container || !table) return;

    let centerX = table.clientWidth / 2 - 20;
    let centerY = table.clientHeight / 2 - 30;

    let targetX = table.clientWidth / 2 - 20;
    let targetY = table.clientHeight - 80;

    if (targetPlayerId === 1) { targetX = 50; targetY = table.clientHeight / 2 - 25; }
    else if (targetPlayerId === 2) { targetX = table.clientWidth / 2 - 20; targetY = 30; }
    else if (targetPlayerId === 3) { targetX = table.clientWidth - 80; targetY = table.clientHeight / 2 - 25; }

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            let flyingCard = document.createElement('div');
            flyingCard.className = 'flying-deal-card';
            flyingCard.style.setProperty('--centerX', `${centerX}px`);
            flyingCard.style.setProperty('--centerY', `${centerY}px`);
            flyingCard.style.setProperty('--targetX', `${targetX + (i * 10)}px`);
            flyingCard.style.setProperty('--targetY', `${targetY}px`);

            container.appendChild(flyingCard);
            setTimeout(() => flyingCard.remove(), 500);
        }, i * 100);
    }
}

function animateChipsToWinner(winnerId) {
    let container = document.getElementById('flying-chips-container');
    let table = document.getElementById('table-container');
    if (!container || !table) return;

    let centerX = table.clientWidth / 2 - 8;
    let centerY = table.clientHeight / 2 - 15;

    let targetX = table.clientWidth / 2;
    let targetY = table.clientHeight - 60;

    if (winnerId === 1) { targetX = 60; targetY = table.clientHeight / 2; }
    else if (winnerId === 2) { targetX = table.clientWidth / 2; targetY = 40; }
    else if (winnerId === 3) { targetX = table.clientWidth - 60; targetY = table.clientHeight / 2; }

    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            let chip = document.createElement('div');
            chip.className = 'flying-chip-to-winner';
            chip.style.setProperty('--centerX', `${centerX + (Math.random()*20-10)}px`);
            chip.style.setProperty('--centerY', `${centerY + (Math.random()*20-10)}px`);
            chip.style.setProperty('--winX', `${targetX}px`);
            chip.style.setProperty('--winY', `${targetY}px`);

            container.appendChild(chip);
            setTimeout(() => chip.remove(), 600);
        }, i * 70);
    }
}

function playerAction(action) {
    if (gameState.handOver || gameState.phase === 'draw') return;
    let p = gameState.players[0];
    let callAmount = gameState.currentBet - p.bet;

    if (action === 'fold') {
        p.folded = true;
        p.status = 'Fold';
        addLog(`${p.name} se retira (Fold).`, 'action');
    } else if (action === 'call') {
        let actual = Math.min(p.chips, callAmount);
        p.chips -= actual;
        p.bet += actual;
        gameState.pot += actual;
        p.status = callAmount === 0 ? 'Check' : 'Call';
        if (actual > 0) animateChipToCenter(0);
        addLog(`${p.name} ${callAmount === 0 ? 'pasa (Check)' : 'iguala (Call) $' + actual}.`, 'action');
    } else if (action === 'raise') {
        let raiseVal = parseInt(document.getElementById('raise-slider').value);
        let diff = raiseVal - p.bet;
        let actual = Math.min(p.chips, diff);
        p.chips -= actual;
        p.bet += actual;
        gameState.pot += actual;
        gameState.currentBet = p.bet;
        p.status = 'Raise';
        animateChipToCenter(0);
        addLog(`${p.name} sube la apuesta (Raise) a $${p.bet}.`, 'action');
    }

    nextTurn();
}

function nextTurn() {
    let activePlayers = gameState.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
        endHand(activePlayers[0]);
        return;
    }

    let nextIndex = (gameState.activePlayerIndex + 1) % gameState.players.length;
    let count = 0;
    while (gameState.players[nextIndex].folded && count < gameState.players.length) {
        nextIndex = (nextIndex + 1) % gameState.players.length;
        count++;
    }

    if (isRoundComplete()) {
        advancePhase();
    } else {
        gameState.activePlayerIndex = nextIndex;
        updateUI();
        if (gameState.players[gameState.activePlayerIndex].isAi && gameState.phase !== 'draw') {
            setTimeout(processAiTurn, 1000);
        }
    }
}

function isRoundComplete() {
    let active = gameState.players.filter(p => !p.folded);
    let maxBet = Math.max(...active.map(p => p.bet));
    let allMatched = active.every(p => p.bet === maxBet || p.chips === 0);
    let allActed = active.every(p => p.status !== '');
    return allMatched && allActed;
}

function advancePhase() {
    gameState.players.forEach(p => { 
        p.bet = 0; 
        p.status = ''; 
    });
    gameState.currentBet = 0;

    if (gameState.mode === 'holdem') {
        if (gameState.phase === 'preflop') {
            gameState.phase = 'flop';
            gameState.communityCards.push(gameState.deck.pop(), gameState.deck.pop(), gameState.deck.pop());
            setTableMsg("Flop repartido. ¡Ronda de apuestas!");
            addLog("Se reparte el Flop (3 cartas comunitarias).", 'system');
        } else if (gameState.phase === 'flop') {
            gameState.phase = 'turn';
            gameState.communityCards.push(gameState.deck.pop());
            setTableMsg("Turn repartido. ¡Ronda de apuestas!");
            addLog("Se reparte el Turn (4ª carta comunitaria).", 'system');
        } else if (gameState.phase === 'turn') {
            gameState.phase = 'river';
            gameState.communityCards.push(gameState.deck.pop());
            setTableMsg("River repartido. ¡Ronda de apuestas!");
            addLog("Se reparte el River (5ª carta comunitaria).", 'system');
        } else if (gameState.phase === 'river') {
            showdown();
            return;
        }
    } else {
        if (gameState.phase === 'preflop') {
            gameState.phase = 'draw';
            setTableMsg("¡Fase de descarte! Selecciona tus cartas y presiona 'Cambiar Cartas'.");
            addLog("Finaliza la primera ronda de apuestas. Inicia el descarte de cartas.", 'system');
            updateUI();
            return;
        } else if (gameState.phase === 'betting') {
            showdown();
            return;
        }
    }

    gameState.activePlayerIndex = (gameState.currentDealer + 1) % gameState.players.length;
    while (gameState.players[gameState.activePlayerIndex].folded) {
        gameState.activePlayerIndex = (gameState.activePlayerIndex + 1) % gameState.players.length;
    }

    updateUI();
    if (gameState.players[gameState.activePlayerIndex].isAi && gameState.phase !== 'draw') {
        setTimeout(processAiTurn, 1000);
    }
}

function processAiTurn() {
    if (gameState.handOver || gameState.phase === 'draw') return;
    let ai = gameState.players[gameState.activePlayerIndex];
    if (ai.folded) {
        nextTurn();
        return;
    }

    let callAmount = gameState.currentBet - ai.bet;
    let rand = Math.random();

    if (callAmount > ai.chips) {
        ai.folded = true;
        ai.status = 'Fold';
        addLog(`${ai.name} se retira (Fold).`, 'action');
    } else if (callAmount === 0) {
        if (rand < 0.2 && ai.chips > 50) {
            let raiseAmount = 50;
            ai.chips -= raiseAmount;
            ai.bet += raiseAmount;
            gameState.pot += raiseAmount;
            gameState.currentBet = ai.bet;
            ai.status = 'Raise';
            animateChipToCenter(ai.id);
            addLog(`${ai.name} sube la apuesta a $${ai.bet}.`, 'action');
        } else {
            ai.status = 'Check';
            addLog(`${ai.name} pasa (Check).`, 'action');
        }
    } else {
        if (rand < 0.15 && ai.chips > callAmount) {
            ai.folded = true;
            ai.status = 'Fold';
            addLog(`${ai.name} se retira (Fold).`, 'action');
        } else {
            ai.chips -= callAmount;
            ai.bet += callAmount;
            gameState.pot += callAmount;
            ai.status = 'Call';
            animateChipToCenter(ai.id);
            addLog(`${ai.name} iguala la apuesta (Call).`, 'action');
        }
    }

    updateUI();
    setTimeout(nextTurn, 1000);
}

function toggleCardSelection(idx) {
    if (gameState.phase !== 'draw' || gameState.handOver) return;
    let pos = gameState.selectedForDiscard.indexOf(idx);
    if (pos > -1) {
        gameState.selectedForDiscard.splice(pos, 1);
    } else {
        gameState.selectedForDiscard.push(idx);
    }
    updateUI();
}

function confirmDiscard() {
    if (gameState.phase !== 'draw') return;
    
    let count = gameState.selectedForDiscard.length;
    animateCardsFromCenter(count, 0);

    gameState.selectedForDiscard.sort((a,b) => b - a).forEach(idx => {
        gameState.players[0].hand[idx] = gameState.deck.pop();
    });
    addLog(`Tú cambiaste ${count} cartas.`, 'action');
    gameState.selectedForDiscard = [];

    for (let i = 1; i < gameState.players.length; i++) {
        let ai = gameState.players[i];
        if (!ai.folded) {
            let discardCount = Math.floor(Math.random() * 3);
            if (discardCount > 0) {
                animateCardsFromCenter(discardCount, ai.id);
                for (let c = 0; c < discardCount; c++) {
                    ai.hand[c] = gameState.deck.pop();
                }
            }
            addLog(`${ai.name} cambió ${discardCount} cartas.`, 'action');
        }
    }

    gameState.phase = 'betting';
    setTableMsg("Cartas cambiadas. ¡Última ronda de apuestas!");
    
    gameState.activePlayerIndex = (gameState.currentDealer + 1) % gameState.players.length;
    while (gameState.players[gameState.activePlayerIndex].folded) {
        gameState.activePlayerIndex = (gameState.activePlayerIndex + 1) % gameState.players.length;
    }

    updateUI();
    if (gameState.players[gameState.activePlayerIndex].isAi) {
        setTimeout(processAiTurn, 1000);
    }
}

function evaluatePlayerHand(player) {
    let cards = [...player.hand];
    if (gameState.mode === 'holdem' && gameState.communityCards.length > 0) {
        cards = cards.concat(gameState.communityCards);
    }

    cards.sort((a, b) => b.weight - a.weight);

    let values = cards.map(c => c.weight);
    let suits = cards.map(c => c.suit);

    let counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);

    let pairs = Object.keys(counts).map(Number).filter(k => counts[k] === 2).sort((a,b) => b - a);
    let trips = Object.keys(counts).map(Number).filter(k => counts[k] === 3).sort((a,b) => b - a);
    let quads = Object.keys(counts).map(Number).filter(k => counts[k] === 4).sort((a,b) => b - a);

    let flushSuit = null;
    let suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    for (let s in suitCounts) {
        if (suitCounts[s] >= 5) {
            flushSuit = s;
            break;
        }
    }

    let flushCards = flushSuit ? cards.filter(c => c.suit === flushSuit).map(c => c.weight) : [];

    function findStraight(valList) {
        let uniqueVals = [...new Set(valList)].sort((a,b) => b - a);
        if (uniqueVals.includes(14)) {
            uniqueVals.push(1);
        }
        let streak = 1;
        let highStraight = -1;
        for (let i = 0; i < uniqueVals.length - 1; i++) {
            if (uniqueVals[i] - 1 === uniqueVals[i+1]) {
                streak++;
                if (streak >= 5) {
                    highStraight = uniqueVals[i - 3];
                    break;
                }
            } else if (uniqueVals[i] !== uniqueVals[i+1]) {
                streak = 1;
            }
        }
        return highStraight;
    }

    let straightHigh = findStraight(values);
    let flushStraightHigh = flushCards.length >= 5 ? findStraight(flushCards) : -1;

    if (flushStraightHigh === 14) {
        return { score: 1000, name: 'Escalera Real' };
    }
    if (flushStraightHigh !== -1) {
        return { score: 900 + flushStraightHigh, name: 'Escalera de Color (' + CARD_NAME_MAP[flushStraightHigh] + ')' };
    }
    if (quads.length > 0) {
        return { score: 800 + quads[0], name: 'Póker de ' + CARD_NAME_MAP[quads[0]] };
    }
    if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
        return { score: 700 + trips[0], name: 'Full House (' + CARD_NAME_MAP[trips[0]] + ')' };
    }
    if (flushCards.length >= 5) {
        return { score: 600 + flushCards[0], name: 'Color (' + CARD_NAME_MAP[flushCards[0]] + ' alta)' };
    }
    if (straightHigh !== -1) {
        return { score: 500 + straightHigh, name: 'Escalera al ' + CARD_NAME_MAP[straightHigh] };
    }
    if (trips.length > 0) {
        return { score: 400 + trips[0], name: 'Trío de ' + CARD_NAME_MAP[trips[0]] };
    }
    if (pairs.length >= 2) {
        return { score: 300 + pairs[0], name: 'Doble Pareja (' + CARD_NAME_MAP[pairs[0]] + ' y ' + CARD_NAME_MAP[pairs[1]] + ')' };
    }
    if (pairs.length === 1) {
        return { score: 200 + pairs[0], name: 'Pareja de ' + CARD_NAME_MAP[pairs[0]] };
    }
    
    let highCardNum = values[0];
    let highCardName = CARD_NAME_MAP[highCardNum] || highCardNum;
    return { score: 100 + highCardNum, name: 'Carta Alta (' + highCardName + ')' };
}

function showdown() {
    gameState.handOver = true;
    let active = gameState.players.filter(p => !p.folded);
    let bestPlayer = active[0];
    let bestScore = -1;

    active.forEach(p => {
        let evalRes = evaluatePlayerHand(p);
        if (evalRes.score > bestScore) {
            bestScore = evalRes.score;
            bestPlayer = p;
        }
    });

    gameState.winnerId = bestPlayer.id;
    updateUI();

    animateChipsToWinner(bestPlayer.id);
    bestPlayer.chips += gameState.pot;
    let handName = evaluatePlayerHand(bestPlayer).name;
    addLog(`¡${bestPlayer.name} gana el pozo de $${gameState.pot} con ${handName}!`, 'system');
    
    setTimeout(() => {
        showModal("¡Fin de la Mano!", `${bestPlayer.name} gana el pozo de $${gameState.pot} con ${handName}.`);
    }, 700);
}

function endHand(winner) {
    gameState.handOver = true;
    gameState.winnerId = winner.id;
    updateUI();

    animateChipsToWinner(winner.id);
    winner.chips += gameState.pot;
    addLog(`${winner.name} gana el pozo de $${gameState.pot} por retirada de los demás.`, 'system');
    
    setTimeout(() => {
        showModal("¡Fin de la Mano!", `${winner.name} gana el pozo de $${gameState.pot} porque los demás se retiraron.`);
    }, 700);
}

function showModal(title, text) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    document.getElementById('modal-msg').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-msg').classList.add('hidden');
    gameState.currentDealer = (gameState.currentDealer + 1) % gameState.players.length;
    startNewHand();
}

function setTableMsg(msg) {
    document.getElementById('table-msg').innerText = msg;
}