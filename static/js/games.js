/**
 * Racket Pro Analyzer - Games Management JavaScript
 */

const API_URL = window.location.origin;
let currentToken = null;
let currentUser = null;
let currentSport = null;
let players = [];
let games = [];

// =============================================================================
// TRANSLATION HELPERS
// =============================================================================

function t(key, fallback = '') {
    if (window.i18n && window.i18n.get) {
        return window.i18n.get(key) || fallback;
    }
    return fallback;
}

function getGameTypeLabel(type) {
    if (type === 'doubles') {
        return '👥 ' + t('games.doubles', 'Duplas');
    }
    return '👤 ' + t('games.singles', 'Simples');
}

function getWithPartnerLabel(partnerName) {
    const prefix = t('games.withPartner', 'c/');
    return `${prefix} ${partnerName}`;
}

function getVersusLabel() {
    return t('games.versus', 'vs');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentToken = localStorage.getItem('token');
    if (!currentToken) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    currentUser = JSON.parse(localStorage.getItem('user') || 'null');

    // Get sport from URL
    currentSport = getSportFromUrl();
    const sportConfig = getSportConfig(currentSport);

    if (!sportConfig) {
        window.location.href = '/';
        return;
    }

    // Update UI with sport info
    updateSportDisplay();

    // Configure game type options based on sport
    configureGameTypes(sportConfig);

    // Set today's date as default (using local timezone)
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('gameDate').value = localDate;

    // Load data
    await loadPlayers();
    await loadGames();
    await loadStatistics();

    // Update user email
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }

    // Re-apply translations after all content is loaded
    // This ensures translations work even if i18n.init() ran before DOM was fully ready
    setTimeout(() => {
        if (window.i18n && window.i18n.applyTranslations) {
            window.i18n.applyTranslations();
        }
    }, 100);
});

function updateSportDisplay() {
    const sportConfig = getSportConfig(currentSport);
    const iconEl = document.getElementById('sportIcon');
    iconEl.src = sportConfig.icon;
    iconEl.alt = getSportName(currentSport);
    document.getElementById('sportName').textContent = getSportName(currentSport);
    document.title = `${getSportName(currentSport)} - Racket Pro Analyzer`;
}

// Override changeLanguage to also update sport name
const originalChangeLanguage = window.changeLanguage;
window.changeLanguage = function(lang) {
    if (originalChangeLanguage) {
        originalChangeLanguage(lang);
    }
    // Update sport name after language change
    setTimeout(updateSportDisplay, 100);
};

// =============================================================================
// CONFIGURATION
// =============================================================================

function configureGameTypes(sportConfig) {
    const singlesOption = document.getElementById('singlesOption');
    const doublesOption = document.getElementById('doublesOption');

    // Show both options by default
    if (singlesOption) singlesOption.style.display = '';
    if (doublesOption) doublesOption.style.display = '';

    // Hide doubles option if sport doesn't support it
    if (!sportConfig.gameTypes.includes('doubles')) {
        if (doublesOption) doublesOption.style.display = 'none';
    }

    // Hide singles option if sport doesn't support it
    if (!sportConfig.gameTypes.includes('singles')) {
        if (singlesOption) singlesOption.style.display = 'none';
    }

    // Pre-select the appropriate option based on sport
    if (!sportConfig.gameTypes.includes('singles') && sportConfig.gameTypes.includes('doubles')) {
        document.querySelector('input[name="gameType"][value="doubles"]').checked = true;
        toggleDoublesFields();
    } else if (sportConfig.gameTypes.includes('singles') && !sportConfig.gameTypes.includes('doubles')) {
        document.querySelector('input[name="gameType"][value="singles"]').checked = true;
        toggleDoublesFields();
    }
}

function toggleDoublesFields() {
    const gameType = document.querySelector('input[name="gameType"]:checked').value;
    const singlesFields = document.getElementById('singlesFields');
    const doublesFields = document.getElementById('doublesFields');

    if (gameType === 'doubles') {
        singlesFields.style.display = 'none';
        doublesFields.style.display = 'block';
    } else {
        singlesFields.style.display = 'block';
        doublesFields.style.display = 'none';
    }
}

// =============================================================================
// API HELPERS
// =============================================================================

async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
        ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error(t('errors.sessionExpired', 'Sessão expirada'));
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || t('errors.requestError', 'Erro na requisição'));
    }

    return response.json();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// =============================================================================
// PLAYERS
// =============================================================================

async function loadPlayers() {
    try {
        players = await apiRequest(`/api/players?sport=${currentSport}`);
        populatePlayerSelects();
    } catch (error) {
        console.error('Erro ao carregar jogadores:', error);
    }
}

function populatePlayerSelects() {
    const selects = ['opponentSelect', 'partnerSelect', 'opponent1Select', 'opponent2Select'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Keep first option (placeholder)
        const placeholder = select.options[0];
        select.innerHTML = '';
        select.appendChild(placeholder);

        // Add players
        players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            select.appendChild(option);
        });
    });
}

function openNewPlayerModal(target = '') {
    editingPlayerId = null; // Reset editing mode
    document.getElementById('playerTarget').value = target;
    document.getElementById('newPlayerForm').reset();
    // Reset modal title
    document.querySelector('#newPlayerModal .modal-header h2').textContent = t('players.newTitle', '👥 Novo Jogador');
    // Fechar modal de jogadores se estiver aberto
    closeModal('playersModal');
    openModal('newPlayerModal');
}

async function savePlayer(event) {
    event.preventDefault();

    const playerData = {
        sport: currentSport,
        name: document.getElementById('playerName').value,
        dominant_hand: document.querySelector('input[name="playerHand"]:checked').value,
        level: document.getElementById('playerLevel').value,
        play_style: document.getElementById('playerStyle').value,
        age_group: document.getElementById('playerAgeGroup').value,
        notes: document.getElementById('playerNotes').value || null
    };

    try {
        let savedPlayer;

        if (editingPlayerId) {
            // Update existing player
            savedPlayer = await apiRequest(`/api/players/${editingPlayerId}`, {
                method: 'PUT',
                body: JSON.stringify(playerData)
            });

            // Update in local array
            const index = players.findIndex(p => p.id === editingPlayerId);
            if (index !== -1) {
                players[index] = { ...players[index], ...savedPlayer };
            }

            editingPlayerId = null;
        } else {
            // Create new player
            savedPlayer = await apiRequest('/api/players', {
                method: 'POST',
                body: JSON.stringify(playerData)
            });

            players.push(savedPlayer);

            // Select the new player in the appropriate dropdown
            const target = document.getElementById('playerTarget').value;
            if (target === 'opponent') {
                document.getElementById('opponentSelect').value = savedPlayer.id;
            } else if (target === 'partner') {
                document.getElementById('partnerSelect').value = savedPlayer.id;
            } else if (target === 'opponent1') {
                document.getElementById('opponent1Select').value = savedPlayer.id;
            } else if (target === 'opponent2') {
                document.getElementById('opponent2Select').value = savedPlayer.id;
            }
        }

        populatePlayerSelects();
        onPlayerSelectChange();
        closeModal('newPlayerModal');
    } catch (error) {
        console.error('Erro ao salvar jogador:', error);
        alert('Erro ao salvar jogador: ' + error.message);
    }
}

// Prevent selecting same player in multiple fields
function onPlayerSelectChange() {
    const gameType = document.querySelector('input[name="gameType"]:checked')?.value;

    if (gameType === 'doubles') {
        const partnerId = document.getElementById('partnerSelect').value;
        const opponent1Id = document.getElementById('opponent1Select').value;
        const opponent2Id = document.getElementById('opponent2Select').value;

        const selectedIds = [partnerId, opponent1Id, opponent2Id].filter(id => id !== '');

        // Update each select to disable already selected players
        ['partnerSelect', 'opponent1Select', 'opponent2Select'].forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;

            Array.from(select.options).forEach(option => {
                if (option.value === '') return; // Skip placeholder

                // Disable if selected in another field (but not in this field)
                const isSelectedElsewhere = selectedIds.includes(option.value) && option.value !== currentValue;
                option.disabled = isSelectedElsewhere;
            });
        });
    }
}

function openPlayersModal() {
    renderPlayersList();
    openModal('playersModal');
}

function renderPlayersList() {
    const container = document.getElementById('playersList');

    if (players.length === 0) {
        container.innerHTML = `<p class="empty-message">${t('players.noPlayers', 'Nenhum jogador cadastrado')}</p>`;
        return;
    }

    const handLeft = t('players.left', 'Canhoto');
    const handRight = t('players.right', 'Destro');
    const statsAgainst = t('players.statsAgainst', 'vs:');
    const statsWith = t('players.statsWith', 'com:');
    const winsShort = t('players.winsShort', 'V');
    const lossesShort = t('players.lossesShort', 'D');

    container.innerHTML = players.map(player => `
        <div class="player-card">
            <div class="player-info">
                <h4>${player.name}</h4>
                <p>
                    ${player.dominant_hand === 'left' ? `🫲 ${handLeft}` : `🫱 ${handRight}`} •
                    ${translateLevel(player.level)} •
                    ${translateStyle(player.play_style)} •
                    ${translateAgeGroup(player.age_group)}
                </p>
                <p class="player-stats">
                    <span class="stat-against">${statsAgainst} ${player.wins_against || 0}${winsShort} / ${player.losses_against || 0}${lossesShort}</span>
                    <span class="stat-with">${statsWith} ${player.wins_with || 0}${winsShort} / ${player.losses_with || 0}${lossesShort}</span>
                </p>
            </div>
            <div class="player-actions">
                <button onclick="editPlayer(${player.id})" class="btn-edit-small" title="${t('common.edit', 'Editar')}">✏️</button>
                <button onclick="deletePlayer(${player.id})" class="btn-danger-small" title="${t('common.delete', 'Excluir')}">🗑️</button>
            </div>
        </div>
    `).join('');
}

let editingPlayerId = null;

function editPlayer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    editingPlayerId = playerId;

    // Fill the form with player data
    document.getElementById('playerName').value = player.name;
    document.querySelector(`input[name="playerHand"][value="${player.dominant_hand}"]`).checked = true;
    document.getElementById('playerLevel').value = player.level;
    document.getElementById('playerStyle').value = player.play_style;
    document.getElementById('playerAgeGroup').value = player.age_group || '20_39';
    document.getElementById('playerNotes').value = player.notes || '';
    document.getElementById('playerTarget').value = '';

    // Update modal title
    document.querySelector('#newPlayerModal .modal-header h2').textContent = t('players.editTitle', '✏️ Editar Jogador');

    closeModal('playersModal');
    openModal('newPlayerModal');
}

async function deletePlayer(playerId) {
    if (!confirm('Tem certeza que deseja excluir este jogador?')) return;

    try {
        await apiRequest(`/api/players/${playerId}`, { method: 'DELETE' });
        players = players.filter(p => p.id !== playerId);
        populatePlayerSelects();
        renderPlayersList();
    } catch (error) {
        console.error('Erro ao excluir jogador:', error);
        alert('Erro ao excluir jogador: ' + error.message);
    }
}

// =============================================================================
// GAMES
// =============================================================================

async function loadGames() {
    try {
        games = await apiRequest(`/api/games?sport=${currentSport}`);
        renderGamesList();
    } catch (error) {
        console.error('Erro ao carregar jogos:', error);
    }
}

function renderGamesList() {
    const container = document.getElementById('gamesList');
    const filterType = document.getElementById('filterType').value;
    const filterResult = document.getElementById('filterResult').value;

    let filteredGames = games;

    if (filterType !== 'all') {
        filteredGames = filteredGames.filter(g => g.game_type === filterType);
    }
    if (filterResult !== 'all') {
        filteredGames = filteredGames.filter(g => g.result === filterResult);
    }

    if (filteredGames.length === 0) {
        container.innerHTML = `<p class="empty-message">${t('analytics.noGamesFound', 'Nenhum jogo encontrado')}</p>`;
        return;
    }

    container.innerHTML = filteredGames.map(game => {
        const isDoubles = game.game_type === 'doubles';
        const resultClass = game.result === 'win' ? 'win' : (game.result === 'draw' ? 'draw' : 'loss');

        // Build result text with score
        let resultText = '';
        if (game.result === 'win') {
            resultText = `<span class="result-text result-win">🏆 ${t('games.win', 'Vitória')} ${game.score || ''}</span>`;
        } else if (game.result === 'draw') {
            resultText = `<span class="result-text result-draw">🤝 ${t('games.draw', 'Empate')} ${game.score || ''}</span>`;
        } else {
            resultText = `<span class="result-text result-loss">❌ ${t('games.loss', 'Derrota')} ${game.score || ''}</span>`;
        }

        let opponentText = game.opponent_name;
        if (isDoubles && game.opponent2_name) {
            opponentText = `${game.opponent_name} + ${game.opponent2_name}`;
        }

        let partnerText = '';
        if (isDoubles && game.partner_name) {
            partnerText = `<span class="partner-info">${getWithPartnerLabel(game.partner_name)}</span>`;
        }

        return `
            <div class="game-card ${resultClass}">
                <div class="game-date">${formatDate(game.game_date)}</div>
                <div class="game-info">
                    <div class="game-type">${getGameTypeLabel(game.game_type)}</div>
                    <div class="game-opponent">${getVersusLabel()} ${opponentText}</div>
                    ${partnerText}
                    ${resultText}
                </div>
                <div class="game-actions">
                    <button onclick="editGame(${game.id})" class="btn-edit-small" title="Editar">✏️</button>
                    <button onclick="deleteGame(${game.id})" class="btn-danger-small" title="Excluir">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

let editingGameId = null;

function editGame(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    editingGameId = gameId;

    // Fill form with game data
    document.getElementById('gameDate').value = game.game_date;

    // Set game type
    const isDoubles = game.game_type === 'doubles';
    document.querySelector(`input[name="gameType"][value="${game.game_type}"]`).checked = true;
    toggleDoublesFields();

    // Set players
    if (isDoubles) {
        document.getElementById('partnerSelect').value = game.partner_id;
        document.getElementById('opponent1Select').value = game.opponent_id;
        document.getElementById('opponent2Select').value = game.opponent2_id;
        onPlayerSelectChange();
    } else {
        document.getElementById('opponentSelect').value = game.opponent_id;
    }

    // Parse and fill score (new simple format: "3-2")
    if (game.score) {
        const match = game.score.match(/^(\d+)-(\d+)/);
        if (match) {
            document.getElementById('setsWon').value = match[1];
            document.getElementById('setsLost').value = match[2];
        }
    } else {
        document.getElementById('setsWon').value = '';
        document.getElementById('setsLost').value = '';
    }
    updateSimpleResult();

    document.getElementById('gameLocation').value = game.location || '';
    document.getElementById('gameNotes').value = game.notes || '';

    // Update modal title
    document.querySelector('#newGameModal .modal-header h2').textContent = t('games.editTitle', '✏️ Editar Jogo');

    openModal('newGameModal');
}

function filterGames() {
    renderGamesList();
}

function openNewGameModal() {
    editingGameId = null; // Reset editing mode
    document.getElementById('newGameForm').reset();
    // Set today's date using local timezone
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('gameDate').value = localDate;

    // Reset modal title
    document.querySelector('#newGameModal .modal-header h2').textContent = t('games.newGameTitle', '➕ Registrar Jogo');

    // Reset game type based on sport
    const sportConfig = getSportConfig(currentSport);
    if (sportConfig.gameTypes.includes('singles')) {
        document.querySelector('input[name="gameType"][value="singles"]').checked = true;
    } else {
        document.querySelector('input[name="gameType"][value="doubles"]').checked = true;
    }
    toggleDoublesFields();

    // Reset score inputs
    document.getElementById('setsWon').value = '';
    document.getElementById('setsLost').value = '';
    updateSimpleResult();

    openModal('newGameModal');
}

// =============================================================================
// SETS MANAGEMENT
// =============================================================================

let currentSets = [];

function initializeSets() {
    currentSets = [];
    const container = document.getElementById('setsContainer');
    container.innerHTML = '';

    // Add initial sets (typically 1 to start)
    addSet();

    // Reset result display
    updateResultDisplay();
}

function addSet() {
    const setIndex = currentSets.length;
    currentSets.push({ you: '', opponent: '' });

    const container = document.getElementById('setsContainer');
    const setRow = document.createElement('div');
    setRow.className = 'set-row';
    setRow.id = `set-row-${setIndex}`;
    const youPlaceholder = t('games.you', 'Você');
    const oppPlaceholder = t('games.opp', 'Adv');

    setRow.innerHTML = `
        <span class="set-label">Set ${setIndex + 1}</span>
        <div class="set-inputs">
            <input type="number"
                   class="set-input"
                   id="set-you-${setIndex}"
                   placeholder="${youPlaceholder}"
                   min="0"
                   max="99"
                   oninput="onSetInputChange(${setIndex})">
            <span class="set-vs">x</span>
            <input type="number"
                   class="set-input"
                   id="set-opp-${setIndex}"
                   placeholder="${oppPlaceholder}"
                   min="0"
                   max="99"
                   oninput="onSetInputChange(${setIndex})">
        </div>
        ${setIndex > 0 ? `<button type="button" class="set-remove" onclick="removeSet(${setIndex})">×</button>` : '<span style="width:24px"></span>'}
    `;
    container.appendChild(setRow);
}

function removeSet(index) {
    const row = document.getElementById(`set-row-${index}`);
    if (row) {
        row.remove();
    }
    currentSets.splice(index, 1);

    // Re-render all sets with correct indices
    rerenderSets();
    updateResultDisplay();
}

function rerenderSets() {
    const container = document.getElementById('setsContainer');
    const setsCopy = [...currentSets];
    container.innerHTML = '';
    currentSets = [];

    setsCopy.forEach((set, i) => {
        addSet();
        document.getElementById(`set-you-${i}`).value = set.you;
        document.getElementById(`set-opp-${i}`).value = set.opponent;
    });

}

function onSetInputChange(index) {
    const youInput = document.getElementById(`set-you-${index}`);
    const oppInput = document.getElementById(`set-opp-${index}`);

    currentSets[index] = {
        you: youInput.value,
        opponent: oppInput.value
    };

    // Highlight winner/loser
    const youVal = parseInt(youInput.value) || 0;
    const oppVal = parseInt(oppInput.value) || 0;

    youInput.classList.remove('winner', 'loser');
    oppInput.classList.remove('winner', 'loser');

    if (youInput.value && oppInput.value && youVal !== oppVal) {
        if (youVal > oppVal) {
            youInput.classList.add('winner');
            oppInput.classList.add('loser');
        } else {
            youInput.classList.add('loser');
            oppInput.classList.add('winner');
        }
    }

    updateResultDisplay();
}

function calculateResult() {
    let setsWon = 0;
    let setsLost = 0;
    let validSets = 0;

    currentSets.forEach(set => {
        const you = parseInt(set.you);
        const opp = parseInt(set.opponent);

        if (!isNaN(you) && !isNaN(opp) && (you > 0 || opp > 0)) {
            validSets++;
            if (you > opp) setsWon++;
            else if (opp > you) setsLost++;
        }
    });

    // Determina resultado: quem ganhou mais sets
    let result = null;
    if (setsWon > setsLost) result = 'win';
    else if (setsLost > setsWon) result = 'loss';
    else if (validSets > 0) result = 'draw'; // Empate

    return {
        setsWon,
        setsLost,
        validSets,
        result
    };
}

function updateResultDisplay() {
    // Legacy function - now using updateSimpleResult
    updateSimpleResult();
}

// New simplified result update function
function updateSimpleResult() {
    const display = document.getElementById('resultDisplay');
    const resultInput = document.getElementById('gameResult');
    const scoreInput = document.getElementById('gameScore');

    const setsWonInput = document.getElementById('setsWon');
    const setsLostInput = document.getElementById('setsLost');

    const setsWon = parseInt(setsWonInput?.value) || 0;
    const setsLost = parseInt(setsLostInput?.value) || 0;

    // Build score string (e.g., "3-2")
    if (setsWonInput?.value !== '' && setsLostInput?.value !== '') {
        scoreInput.value = `${setsWon}-${setsLost}`;
    } else {
        scoreInput.value = '';
    }

    if (setsWonInput?.value === '' || setsLostInput?.value === '') {
        display.innerHTML = `<span class="result-pending">${t('games.fillScore', 'Preencha o placar acima')}</span>`;
        display.className = 'result-display';
        resultInput.value = '';
    } else if (setsWon > setsLost) {
        display.innerHTML = `<span>🏆 ${t('games.winResult', 'VITÓRIA')} ${setsWon}-${setsLost}</span>`;
        display.className = 'result-display result-win';
        resultInput.value = 'win';
    } else if (setsLost > setsWon) {
        display.innerHTML = `<span>❌ ${t('games.lossResult', 'DERROTA')} ${setsWon}-${setsLost}</span>`;
        display.className = 'result-display result-loss';
        resultInput.value = 'loss';
    } else {
        display.innerHTML = `<span>🤝 ${t('games.drawResult', 'EMPATE')} ${setsWon}-${setsLost}</span>`;
        display.className = 'result-display result-draw';
        resultInput.value = 'draw';
    }
}

async function saveGame(event) {
    event.preventDefault();

    const gameType = document.querySelector('input[name="gameType"]:checked').value;
    const isDoubles = gameType === 'doubles';

    // Get result from calculated value
    const result = document.getElementById('gameResult').value;
    if (!result) {
        alert(t('games.fillScoreAlert', 'Por favor, preencha o placar para determinar o resultado do jogo'));
        return;
    }

    // Validate score is filled
    const setsWon = document.getElementById('setsWon').value;
    const setsLost = document.getElementById('setsLost').value;
    if (setsWon === '' || setsLost === '') {
        alert(t('games.fillScoreAlert', 'Por favor, preencha o placar para determinar o resultado do jogo'));
        return;
    }

    const gameData = {
        sport: currentSport,
        game_type: gameType,
        game_date: document.getElementById('gameDate').value,
        result: result,
        score: document.getElementById('gameScore').value || null,
        location: document.getElementById('gameLocation').value || null,
        notes: document.getElementById('gameNotes').value || null
    };

    if (isDoubles) {
        const partnerId = document.getElementById('partnerSelect').value;
        const opponent1Id = document.getElementById('opponent1Select').value;
        const opponent2Id = document.getElementById('opponent2Select').value;

        if (!partnerId || !opponent1Id || !opponent2Id) {
            alert(t('games.selectPartnerAndOpponents', 'Por favor, selecione o parceiro e os dois adversários'));
            return;
        }

        gameData.partner_id = parseInt(partnerId);
        gameData.opponent_id = parseInt(opponent1Id);
        gameData.opponent2_id = parseInt(opponent2Id);
    } else {
        const opponentId = document.getElementById('opponentSelect').value;

        if (!opponentId) {
            alert(t('games.selectOpponentRequired', 'Por favor, selecione o adversário'));
            return;
        }

        gameData.opponent_id = parseInt(opponentId);
    }

    try {
        let savedGame;

        if (editingGameId) {
            // Update existing game
            savedGame = await apiRequest(`/api/games/${editingGameId}`, {
                method: 'PUT',
                body: JSON.stringify(gameData)
            });

            // Update in local array
            const index = games.findIndex(g => g.id === editingGameId);
            if (index !== -1) {
                games[index] = savedGame;
            }

            editingGameId = null;
        } else {
            // Create new game
            savedGame = await apiRequest('/api/games', {
                method: 'POST',
                body: JSON.stringify(gameData)
            });

            games.unshift(savedGame);
        }

        renderGamesList();
        await loadStatistics();
        await loadPlayers(); // Refresh player stats

        closeModal('newGameModal');
    } catch (error) {
        console.error('Erro ao salvar jogo:', error);
        alert('Erro ao salvar jogo: ' + error.message);
    }
}

async function deleteGame(gameId) {
    if (!confirm('Tem certeza que deseja excluir este jogo?')) return;

    try {
        await apiRequest(`/api/games/${gameId}`, { method: 'DELETE' });
        games = games.filter(g => g.id !== gameId);
        renderGamesList();
        await loadStatistics();
        await loadPlayers(); // Refresh player stats
    } catch (error) {
        console.error('Erro ao excluir jogo:', error);
        alert('Erro ao excluir jogo: ' + error.message);
    }
}

// =============================================================================
// STATISTICS
// =============================================================================

async function loadStatistics() {
    try {
        const stats = await apiRequest(`/api/statistics?sport=${currentSport}`);

        document.getElementById('totalWins').textContent = stats.wins || 0;
        document.getElementById('totalLosses').textContent = stats.losses || 0;
        document.getElementById('winRate').textContent = `${stats.win_rate || 0}%`;
        document.getElementById('totalPlayers').textContent = stats.total_players || 0;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// =============================================================================
// ANALYTICS
// =============================================================================

let charts = {};
let currentAnalyticsTab = 'singles';
let filteredGames = []; // Games filtered by period

function openAnalyticsModal() {
    openModal('analyticsModal');
    // Reset period filter to "all"
    document.getElementById('periodFilter').value = 'all';
    applyPeriodFilter();
    // Apply translations to modal elements
    if (window.i18n && window.i18n.applyTranslations) {
        window.i18n.applyTranslations();
    }
}

function applyPeriodFilter() {
    const periodValue = document.getElementById('periodFilter').value;

    if (periodValue === 'all') {
        filteredGames = [...games];
    } else {
        const days = parseInt(periodValue);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        filteredGames = games.filter(g => g.game_date >= cutoffStr);
    }

    // Refresh everything
    populateAnalyticsSelects();
    renderChartsForTab(currentAnalyticsTab);

    // Re-apply translations after dynamic content is rendered
    if (window.i18n && window.i18n.applyTranslations) {
        window.i18n.applyTranslations();
    }
}

function switchAnalyticsTab(tab) {
    currentAnalyticsTab = tab;

    // Update tab buttons using onclick attribute (works with any language)
    document.querySelectorAll('.analytics-tab').forEach(btn => {
        btn.classList.remove('active');
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`'${tab}'`)) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.analytics-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    const tabContent = document.getElementById(`${tab}Tab`);
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }

    // Render charts for the selected tab
    renderChartsForTab(tab);

    // Re-apply translations
    if (window.i18n && window.i18n.applyTranslations) {
        window.i18n.applyTranslations();
    }
}

function renderChartsForTab(tab) {
    if (tab === 'singles') {
        renderSinglesOpponentTable();
        renderSinglesPlayerHistory();
    } else if (tab === 'doubles') {
        renderDoublesPartnerTable();
        renderDoublesOpponentTable();
        renderDoublesPartnerHistory();
        renderDoublesOpponentHistory();
    } else if (tab === 'overview') {
        renderTypeChart();
        renderEvolutionChart();
        renderStreakChart();
        renderDayOfWeekChart();
        renderSetBalanceChart();
        renderFrequencyChart();
    }
}

// Populate all analytics select dropdowns
function populateAnalyticsSelects() {
    // Get unique players from singles games (opponents)
    const singlesOpponents = new Set();
    filteredGames.filter(g => g.game_type === 'singles').forEach(g => {
        if (g.opponent_name) singlesOpponents.add(g.opponent_name);
    });

    // Get unique players from doubles games
    const doublesPartners = new Set();
    const doublesOpponents = new Set();
    filteredGames.filter(g => g.game_type === 'doubles').forEach(g => {
        if (g.partner_name) doublesPartners.add(g.partner_name);
        if (g.opponent_name) doublesOpponents.add(g.opponent_name);
        if (g.opponent2_name) doublesOpponents.add(g.opponent2_name);
    });

    // Populate singles opponent select
    const singlesSelect = document.getElementById('singlesOpponentSelect');
    if (singlesSelect) {
        singlesSelect.innerHTML = `<option value="">${t('analytics.selectOpponent', 'Selecione um adversário...')}</option>`;
        [...singlesOpponents].sort().forEach(name => {
            singlesSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }

    // Populate doubles partner select
    const partnerSelect = document.getElementById('doublesPartnerSelect');
    if (partnerSelect) {
        partnerSelect.innerHTML = `<option value="">${t('analytics.selectPartner', 'Selecione um parceiro...')}</option>`;
        [...doublesPartners].sort().forEach(name => {
            partnerSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }

    // Populate doubles opponent select
    const doublesOpponentSelect = document.getElementById('doublesOpponentSelect');
    if (doublesOpponentSelect) {
        doublesOpponentSelect.innerHTML = `<option value="">${t('analytics.selectOpponent', 'Selecione um adversário...')}</option>`;
        [...doublesOpponents].sort().forEach(name => {
            doublesOpponentSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }
}

// Helper function to format date as DD/MM
function formatDateLabel(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
}

// Helper function to parse score and get set balance
function parseScore(score) {
    if (!score) return { setsWon: 0, setsLost: 0, balance: 0 };

    // Score format can be:
    // 1) "1-0 (3-0)" - wins-losses (setsWon-setsLost) - extract from parentheses
    // 2) "3-0 (11-5, 11-3, 11-7)" - setsWon-setsLost (individual set scores)

    // Check if there's content in parentheses
    const parenMatch = score.match(/\(([^)]+)\)/);
    if (parenMatch) {
        const innerContent = parenMatch[1];
        // If inner content has NO comma, it's the set score like "(3-0)"
        if (!innerContent.includes(',')) {
            const setScore = innerContent.match(/(\d+)-(\d+)/);
            if (setScore) {
                const setsWon = parseInt(setScore[1]);
                const setsLost = parseInt(setScore[2]);
                return { setsWon, setsLost, balance: setsWon - setsLost };
            }
        }
        // If inner content HAS commas, it's individual set scores like "(11-5, 11-3, 11-7)"
        // In this case, the number before parentheses IS the set count
    }

    // Fallback: use the first number pair as set count
    const match = score.match(/^(\d+)-(\d+)/);
    if (match) {
        const setsWon = parseInt(match[1]);
        const setsLost = parseInt(match[2]);
        return { setsWon, setsLost, balance: setsWon - setsLost };
    }
    return { setsWon: 0, setsLost: 0, balance: 0 };
}

// Helper function to calculate player stats
function calculatePlayerStats(playerGames) {
    let wins = 0, losses = 0, setsWon = 0, setsLost = 0;
    let lastGame = null;

    playerGames.forEach(game => {
        if (game.result === 'win') wins++;
        else losses++;

        const scoreData = parseScore(game.score);
        setsWon += scoreData.setsWon;
        setsLost += scoreData.setsLost;

        if (!lastGame || game.game_date > lastGame.game_date) {
            lastGame = game;
        }
    });

    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const setBalance = setsWon - setsLost;

    // Calculate current streak and last win info
    const streakInfo = calculateStreak(playerGames);

    // Calculate trend
    const trendInfo = calculateTrend(playerGames);

    return { wins, losses, total, winRate, setsWon, setsLost, setBalance, lastGame, ...streakInfo, ...trendInfo };
}

// Calculate winning/losing streak
function calculateStreak(playerGames) {
    if (playerGames.length === 0) {
        return { currentStreak: 0, streakType: null, gamesSinceLastWin: 0, gamesSinceLastLoss: 0 };
    }

    // Sort by date descending (most recent first)
    const sortedGames = [...playerGames].sort((a, b) => b.game_date.localeCompare(a.game_date));

    // Calculate current streak
    let currentStreak = 0;
    let streakType = sortedGames[0].result === 'win' ? 'win' : 'loss';

    for (const game of sortedGames) {
        if ((game.result === 'win' && streakType === 'win') ||
            (game.result !== 'win' && streakType === 'loss')) {
            currentStreak++;
        } else {
            break;
        }
    }

    // Calculate games since last win/loss
    let gamesSinceLastWin = 0;
    let gamesSinceLastLoss = 0;
    let foundWin = false;
    let foundLoss = false;

    for (const game of sortedGames) {
        if (!foundWin) {
            if (game.result === 'win') {
                foundWin = true;
            } else {
                gamesSinceLastWin++;
            }
        }
        if (!foundLoss) {
            if (game.result !== 'win') {
                foundLoss = true;
            } else {
                gamesSinceLastLoss++;
            }
        }
        if (foundWin && foundLoss) break;
    }

    return { currentStreak, streakType, gamesSinceLastWin, gamesSinceLastLoss };
}

// Generate streak display HTML
function getStreakDisplay(stats) {
    if (stats.total === 0) return '';

    let streakHtml = '';

    if (stats.currentStreak >= 2) {
        if (stats.streakType === 'win') {
            const winsInRow = t('analytics.winsInRow', 'vitórias seguidas!');
            streakHtml = `<span class="streak streak-win">🔥 ${stats.currentStreak} ${winsInRow}</span>`;
        } else {
            const lossesInRow = t('analytics.lossesInRow', 'derrotas seguidas');
            streakHtml = `<span class="streak streak-loss">📉 ${stats.currentStreak} ${lossesInRow}</span>`;
        }
    } else if (stats.streakType === 'win') {
        streakHtml = `<span class="streak streak-win">✅ ${t('analytics.lastWin', 'Última: Vitória')}</span>`;
    } else {
        streakHtml = `<span class="streak streak-loss">❌ ${t('analytics.lastLoss', 'Última: Derrota')}</span>`;
    }

    // Add info about games since last win if on losing streak
    if (stats.streakType === 'loss' && stats.gamesSinceLastWin > 0) {
        const gamesAgo = t('analytics.lastWinGamesAgo', 'Última vitória: há');
        const gameWord = stats.gamesSinceLastWin > 1 ? t('analytics.games', 'jogos') : t('analytics.game', 'jogo');
        streakHtml += `<span class="streak-info">${gamesAgo} ${stats.gamesSinceLastWin} ${gameWord}</span>`;
    }

    // Add trend indicator
    if (stats.trend) {
        streakHtml += stats.trend;
    }

    return streakHtml;
}

// Calculate trend based on recent games vs older games
function calculateTrend(playerGames) {
    if (playerGames.length < 4) {
        return { trend: null, trendDirection: null, recentWinRate: null, olderWinRate: null };
    }

    // Sort by date descending (most recent first)
    const sortedGames = [...playerGames].sort((a, b) => b.game_date.localeCompare(a.game_date));

    // Split into recent (last 50%) and older (first 50%)
    const midpoint = Math.floor(sortedGames.length / 2);
    const recentGames = sortedGames.slice(0, midpoint);
    const olderGames = sortedGames.slice(midpoint);

    // Calculate win rates
    const recentWins = recentGames.filter(g => g.result === 'win').length;
    const olderWins = olderGames.filter(g => g.result === 'win').length;

    const recentWinRate = Math.round((recentWins / recentGames.length) * 100);
    const olderWinRate = Math.round((olderWins / olderGames.length) * 100);

    const difference = recentWinRate - olderWinRate;

    let trend = null;
    let trendDirection = null;

    if (difference >= 15) {
        trendDirection = 'up';
        trend = `<span class="trend trend-up">↗️ ${t('analytics.improving', 'Melhorando')} (+${difference}%)</span>`;
    } else if (difference <= -15) {
        trendDirection = 'down';
        trend = `<span class="trend trend-down">↘️ ${t('analytics.declining', 'Piorando')} (${difference}%)</span>`;
    } else if (playerGames.length >= 4) {
        trendDirection = 'stable';
        trend = `<span class="trend trend-stable">→ ${t('analytics.stable', 'Estável')}</span>`;
    }

    return { trend, trendDirection, recentWinRate, olderWinRate };
}

// =============================================================================
// MINI DONUT CHART
// =============================================================================

let miniCharts = {};

function renderMiniDonutChart(canvasId, wins, losses) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Destroy existing chart if any
    if (miniCharts[canvasId]) {
        miniCharts[canvasId].destroy();
    }

    const total = wins + losses;
    if (total === 0) return;

    miniCharts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [t('stats.wins', 'Vitórias'), t('stats.losses', 'Derrotas')],
            datasets: [{
                data: [wins, losses],
                backgroundColor: ['#27ae60', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const pct = Math.round((context.raw / total) * 100);
                            return `${context.label}: ${context.raw} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// =============================================================================
// SUMMARY TABLES
// =============================================================================

// Generic sort function for ranking tables
function sortPlayerRows(rows, sortOption) {
    switch (sortOption) {
        case 'hardest':
            // Lower win rate = harder opponent
            return rows.sort((a, b) => a.winRate - b.winRate || b.total - a.total);
        case 'mostPlayed':
            // More games = more played
            return rows.sort((a, b) => b.total - a.total || b.winRate - a.winRate);
        case 'recentFirst':
            // Most recent game first
            return rows.sort((a, b) => {
                const dateA = a.lastGame ? a.lastGame.game_date : '';
                const dateB = b.lastGame ? b.lastGame.game_date : '';
                return dateB.localeCompare(dateA) || b.total - a.total;
            });
        case 'bestBalance':
            // Best set balance first
            return rows.sort((a, b) => b.setBalance - a.setBalance || b.winRate - a.winRate);
        case 'winRate':
        default:
            // Higher win rate first (default)
            return rows.sort((a, b) => b.winRate - a.winRate || b.total - a.total);
    }
}

function renderSinglesOpponentTable() {
    const tbody = document.querySelector('#singlesOpponentTable tbody');
    if (!tbody) return;

    const singlesGames = filteredGames.filter(g => g.game_type === 'singles');

    // Group by opponent
    const opponentData = {};
    singlesGames.forEach(game => {
        const name = game.opponent_name;
        if (!opponentData[name]) opponentData[name] = [];
        opponentData[name].push(game);
    });

    if (Object.keys(opponentData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-table-message">${t('analytics.noSinglesGames', 'Nenhum jogo de simples registrado')}</td></tr>`;
        return;
    }

    // Calculate stats
    let rows = Object.entries(opponentData).map(([name, playerGames]) => {
        const stats = calculatePlayerStats(playerGames);
        return { name, ...stats };
    });

    // Get sort option
    const sortSelect = document.getElementById('singlesSortOption');
    const sortOption = sortSelect ? sortSelect.value : 'winRate';
    rows = sortPlayerRows(rows, sortOption);

    tbody.innerHTML = rows.map(row => {
        const rateClass = row.winRate >= 60 ? 'win-rate-high' : row.winRate <= 40 ? 'win-rate-low' : 'win-rate-medium';
        const balanceClass = row.setBalance > 0 ? 'positive' : row.setBalance < 0 ? 'negative' : '';
        const balanceStr = row.setBalance > 0 ? `+${row.setBalance}` : row.setBalance.toString();

        return `
            <tr onclick="selectOpponentFromTable('singles', '${row.name}')">
                <td><strong>${row.name}</strong></td>
                <td class="positive">${row.wins}</td>
                <td class="negative">${row.losses}</td>
                <td class="${rateClass}">${row.winRate}%</td>
                <td class="${balanceClass}">${balanceStr}</td>
                <td class="date-cell">${row.lastGame ? formatDateLabel(row.lastGame.game_date) : '-'}</td>
            </tr>
        `;
    }).join('');
}

function renderDoublesPartnerTable() {
    const tbody = document.querySelector('#doublesPartnerTable tbody');
    if (!tbody) return;

    const doublesGames = filteredGames.filter(g => g.game_type === 'doubles' && g.partner_name);

    // Group by partner
    const partnerData = {};
    doublesGames.forEach(game => {
        const name = game.partner_name;
        if (!partnerData[name]) partnerData[name] = [];
        partnerData[name].push(game);
    });

    if (Object.keys(partnerData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-table-message">${t('analytics.noDoublesGames', 'Nenhum jogo de duplas registrado')}</td></tr>`;
        return;
    }

    // Calculate stats
    let rows = Object.entries(partnerData).map(([name, playerGames]) => {
        const stats = calculatePlayerStats(playerGames);
        return { name, ...stats };
    });

    // Get sort option
    const sortSelect = document.getElementById('doublesPartnerSortOption');
    const sortOption = sortSelect ? sortSelect.value : 'winRate';
    rows = sortPlayerRows(rows, sortOption);

    tbody.innerHTML = rows.map(row => {
        const rateClass = row.winRate >= 60 ? 'win-rate-high' : row.winRate <= 40 ? 'win-rate-low' : 'win-rate-medium';
        const balanceClass = row.setBalance > 0 ? 'positive' : row.setBalance < 0 ? 'negative' : '';
        const balanceStr = row.setBalance > 0 ? `+${row.setBalance}` : row.setBalance.toString();

        return `
            <tr onclick="selectPartnerFromTable('${row.name}')">
                <td><strong>${row.name}</strong></td>
                <td class="positive">${row.wins}</td>
                <td class="negative">${row.losses}</td>
                <td class="${rateClass}">${row.winRate}%</td>
                <td class="${balanceClass}">${balanceStr}</td>
                <td class="date-cell">${row.lastGame ? formatDateLabel(row.lastGame.game_date) : '-'}</td>
            </tr>
        `;
    }).join('');
}

function renderDoublesOpponentTable() {
    const tbody = document.querySelector('#doublesOpponentTable tbody');
    if (!tbody) return;

    const doublesGames = filteredGames.filter(g => g.game_type === 'doubles');

    // Group by opponent (both opponent1 and opponent2)
    const opponentData = {};
    doublesGames.forEach(game => {
        [game.opponent_name, game.opponent2_name].filter(Boolean).forEach(name => {
            if (!opponentData[name]) opponentData[name] = [];
            // Avoid duplicates for same game
            if (!opponentData[name].find(g => g.id === game.id)) {
                opponentData[name].push(game);
            }
        });
    });

    if (Object.keys(opponentData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-table-message">${t('analytics.noDoublesGames', 'Nenhum jogo de duplas registrado')}</td></tr>`;
        return;
    }

    // Calculate stats
    let rows = Object.entries(opponentData).map(([name, playerGames]) => {
        const stats = calculatePlayerStats(playerGames);
        return { name, ...stats };
    });

    // Get sort option
    const sortSelect = document.getElementById('doublesOpponentSortOption');
    const sortOption = sortSelect ? sortSelect.value : 'winRate';
    rows = sortPlayerRows(rows, sortOption);

    tbody.innerHTML = rows.map(row => {
        const rateClass = row.winRate >= 60 ? 'win-rate-high' : row.winRate <= 40 ? 'win-rate-low' : 'win-rate-medium';
        const balanceClass = row.setBalance > 0 ? 'positive' : row.setBalance < 0 ? 'negative' : '';
        const balanceStr = row.setBalance > 0 ? `+${row.setBalance}` : row.setBalance.toString();

        return `
            <tr onclick="selectOpponentFromTable('doubles', '${row.name}')">
                <td><strong>${row.name}</strong></td>
                <td class="positive">${row.wins}</td>
                <td class="negative">${row.losses}</td>
                <td class="${rateClass}">${row.winRate}%</td>
                <td class="${balanceClass}">${balanceStr}</td>
                <td class="date-cell">${row.lastGame ? formatDateLabel(row.lastGame.game_date) : '-'}</td>
            </tr>
        `;
    }).join('');
}

// Click handlers for table rows
function selectOpponentFromTable(type, name) {
    if (type === 'singles') {
        document.getElementById('singlesOpponentSelect').value = name;
        renderSinglesPlayerHistory();
        // Scroll to chart
        document.getElementById('singlesHistoryChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        document.getElementById('doublesOpponentSelect').value = name;
        renderDoublesOpponentHistory();
        document.getElementById('doublesOpponentHistoryChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function selectPartnerFromTable(name) {
    document.getElementById('doublesPartnerSelect').value = name;
    renderDoublesPartnerHistory();
    document.getElementById('doublesPartnerHistoryChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =============================================================================
// SINGLES CHARTS
// =============================================================================

function renderSinglesPlayerHistory() {
    const ctx = document.getElementById('singlesHistoryChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }

    if (charts.singlesHistory) charts.singlesHistory.destroy();

    const selectedPlayer = document.getElementById('singlesOpponentSelect')?.value;
    const statsBox = document.getElementById('singlesStatsBox');

    if (!selectedPlayer) {
        charts.singlesHistory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('analytics.selectOpponent', 'Selecione um adversário')],
                datasets: [{ label: t('analytics.result', 'Resultado'), data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 1 } },
                plugins: { title: { display: true, text: t('analytics.selectToViewHistory', 'Selecione um adversário para ver o histórico'), color: '#999' } }
            }
        });
        if (statsBox) statsBox.style.display = 'none';
        return;
    }

    const playerGames = filteredGames
        .filter(g => g.game_type === 'singles' && g.opponent_name === selectedPlayer)
        .sort((a, b) => a.game_date.localeCompare(b.game_date));

    if (playerGames.length === 0) {
        charts.singlesHistory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('analytics.noGames', 'Sem jogos')],
                datasets: [{ label: t('analytics.result', 'Resultado'), data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 1 } },
                plugins: { title: { display: true, text: `${t('analytics.noGamesAgainst', 'Nenhum jogo contra')} ${selectedPlayer}`, color: '#999' } }
            }
        });
        if (statsBox) statsBox.style.display = 'none';
        return;
    }

    const labels = playerGames.map(g => formatDateLabel(g.game_date));
    const data = playerGames.map(g => g.result === 'win' ? 1 : -1);
    const colors = playerGames.map(g => g.result === 'win' ? '#27ae60' : '#e74c3c');

    charts.singlesHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: t('analytics.result', 'Resultado'),
                data: data,
                backgroundColor: colors,
                borderRadius: 4,
                gameData: playerGames // Store game data for tooltip
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: -1.5,
                    max: 1.5,
                    ticks: {
                        callback: function(value) {
                            if (value === 1) return t('games.win', 'Vitória');
                            if (value === -1) return t('games.loss', 'Derrota');
                            return '';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const game = playerGames[context[0].dataIndex];
                            return `${formatDateLabel(game.game_date)} ${getVersusLabel()} ${game.opponent_name}`;
                        },
                        label: function(context) {
                            const game = playerGames[context.dataIndex];
                            const result = game.result === 'win' ? `🏆 ${t('games.win', 'Vitória')}` : `❌ ${t('games.loss', 'Derrota')}`;
                            return result;
                        },
                        afterLabel: function(context) {
                            const game = playerGames[context.dataIndex];
                            if (game.score) {
                                return `📊 ${game.score}`;
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });

    // Update stats box with set balance and streak
    const stats = calculatePlayerStats(playerGames);

    if (statsBox) {
        statsBox.style.display = 'block';
        const balanceClass = stats.setBalance > 0 ? 'wins' : stats.setBalance < 0 ? 'losses' : '';
        const balanceStr = stats.setBalance > 0 ? `+${stats.setBalance}` : stats.setBalance.toString();
        const streakHtml = getStreakDisplay(stats);

        statsBox.innerHTML = `
            <div class="stats-with-chart">
                <div class="mini-chart-container">
                    <canvas id="singlesMiniChart"></canvas>
                </div>
                <div class="stats-row">
                    <div class="player-stat-item">
                        <div class="player-stat-value wins">${stats.wins}</div>
                        <div class="player-stat-label">${t('stats.wins', 'Vitórias')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value losses">${stats.losses}</div>
                        <div class="player-stat-label">${t('stats.losses', 'Derrotas')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value">${stats.winRate}%</div>
                        <div class="player-stat-label">${t('analytics.winRateLabel', 'Taxa de Vitória')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value ${balanceClass}">${balanceStr}</div>
                        <div class="player-stat-label">${t('analytics.setBalance', 'Saldo de Sets')}</div>
                    </div>
                </div>
            </div>
            <div class="streak-container">${streakHtml}</div>
            <div class="h2h-button-container">
                <button class="btn btn-secondary btn-sm" onclick="openH2HModal('${selectedPlayer}', 'singles', 'opponent')">
                    📋 ${t('analytics.viewFullHistory', 'Ver histórico completo')}
                </button>
            </div>
        `;

        // Render mini donut chart
        renderMiniDonutChart('singlesMiniChart', stats.wins, stats.losses);
    }
}

// =============================================================================
// DOUBLES CHARTS
// =============================================================================

function renderDoublesPartnerHistory() {
    const ctx = document.getElementById('doublesPartnerHistoryChart');
    if (!ctx) return;

    if (charts.doublesPartnerHistory) charts.doublesPartnerHistory.destroy();

    const selectedPartner = document.getElementById('doublesPartnerSelect')?.value;
    const statsBox = document.getElementById('doublesPartnerStatsBox');

    if (!selectedPartner) {
        charts.doublesPartnerHistory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('analytics.selectPartner', 'Selecione um parceiro')],
                datasets: [{ label: t('analytics.result', 'Resultado'), data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 1 } },
                plugins: { title: { display: true, text: t('analytics.selectPartnerToViewHistory', 'Selecione um parceiro para ver o histórico'), color: '#999' } }
            }
        });
        if (statsBox) statsBox.style.display = 'none';
        return;
    }

    const partnerGames = filteredGames
        .filter(g => g.game_type === 'doubles' && g.partner_name === selectedPartner)
        .sort((a, b) => a.game_date.localeCompare(b.game_date));

    if (partnerGames.length === 0) {
        charts.doublesPartnerHistory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('analytics.noGames', 'Sem jogos')],
                datasets: [{ label: t('analytics.result', 'Resultado'), data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 1 } },
                plugins: { title: { display: true, text: `${t('analytics.noGamesWith', 'Nenhum jogo com')} ${selectedPartner}`, color: '#999' } }
            }
        });
        if (statsBox) statsBox.style.display = 'none';
        return;
    }

    const labels = partnerGames.map(g => formatDateLabel(g.game_date));
    const data = partnerGames.map(g => g.result === 'win' ? 1 : -1);
    const colors = partnerGames.map(g => g.result === 'win' ? '#27ae60' : '#e74c3c');

    charts.doublesPartnerHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: t('analytics.result', 'Resultado'),
                data: data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: -1.5,
                    max: 1.5,
                    ticks: {
                        callback: function(value) {
                            if (value === 1) return t('games.win', 'Vitória');
                            if (value === -1) return t('games.loss', 'Derrota');
                            return '';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const game = partnerGames[context[0].dataIndex];
                            const opponents = game.opponent2_name
                                ? `${game.opponent_name} & ${game.opponent2_name}`
                                : game.opponent_name;
                            return `${formatDateLabel(game.game_date)} ${getVersusLabel()} ${opponents}`;
                        },
                        label: function(context) {
                            const game = partnerGames[context.dataIndex];
                            const result = game.result === 'win' ? `🏆 ${t('games.win', 'Vitória')}` : `❌ ${t('games.loss', 'Derrota')}`;
                            return result;
                        },
                        afterLabel: function(context) {
                            const game = partnerGames[context.dataIndex];
                            if (game.score) {
                                return `📊 ${game.score}`;
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });

    const stats = calculatePlayerStats(partnerGames);

    if (statsBox) {
        statsBox.style.display = 'block';
        const balanceClass = stats.setBalance > 0 ? 'wins' : stats.setBalance < 0 ? 'losses' : '';
        const balanceStr = stats.setBalance > 0 ? `+${stats.setBalance}` : stats.setBalance.toString();
        const streakHtml = getStreakDisplay(stats);

        statsBox.innerHTML = `
            <div class="stats-with-chart">
                <div class="mini-chart-container">
                    <canvas id="doublesPartnerMiniChart"></canvas>
                </div>
                <div class="stats-row">
                    <div class="player-stat-item">
                        <div class="player-stat-value wins">${stats.wins}</div>
                        <div class="player-stat-label">${t('stats.wins', 'Vitórias')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value losses">${stats.losses}</div>
                        <div class="player-stat-label">${t('stats.losses', 'Derrotas')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value">${stats.winRate}%</div>
                        <div class="player-stat-label">${t('analytics.winRateLabel', 'Taxa de Vitória')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value ${balanceClass}">${balanceStr}</div>
                        <div class="player-stat-label">${t('analytics.setBalance', 'Saldo de Sets')}</div>
                    </div>
                </div>
            </div>
            <div class="streak-container">${streakHtml}</div>
            <div class="h2h-button-container">
                <button class="btn btn-secondary btn-sm" onclick="openH2HModal('${selectedPartner}', 'doubles', 'partner')">
                    📋 ${t('analytics.viewFullHistory', 'Ver histórico completo')}
                </button>
            </div>
        `;

        // Render mini donut chart
        renderMiniDonutChart('doublesPartnerMiniChart', stats.wins, stats.losses);
    }
}

function renderDoublesOpponentHistory() {
    const ctx = document.getElementById('doublesOpponentHistoryChart');
    if (!ctx) return;

    if (charts.doublesOpponentHistory) charts.doublesOpponentHistory.destroy();

    const selectedOpponent = document.getElementById('doublesOpponentSelect')?.value;
    const statsBox = document.getElementById('doublesOpponentStatsBox');

    if (!selectedOpponent) {
        charts.doublesOpponentHistory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('analytics.selectOpponent', 'Selecione um adversário')],
                datasets: [{ label: t('analytics.result', 'Resultado'), data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 1 } },
                plugins: { title: { display: true, text: t('analytics.selectToViewHistory', 'Selecione um adversário para ver o histórico'), color: '#999' } }
            }
        });
        if (statsBox) statsBox.style.display = 'none';
        return;
    }

    const opponentGames = filteredGames
        .filter(g => g.game_type === 'doubles' &&
            (g.opponent_name === selectedOpponent || g.opponent2_name === selectedOpponent))
        .sort((a, b) => a.game_date.localeCompare(b.game_date));

    if (opponentGames.length === 0) {
        charts.doublesOpponentHistory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('analytics.noGames', 'Sem jogos')],
                datasets: [{ label: t('analytics.result', 'Resultado'), data: [0], backgroundColor: '#ccc' }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 1 } },
                plugins: { title: { display: true, text: `${t('analytics.noGamesAgainst', 'Nenhum jogo contra')} ${selectedOpponent}`, color: '#999' } }
            }
        });
        if (statsBox) statsBox.style.display = 'none';
        return;
    }

    const labels = opponentGames.map(g => formatDateLabel(g.game_date));
    const data = opponentGames.map(g => g.result === 'win' ? 1 : -1);
    const colors = opponentGames.map(g => g.result === 'win' ? '#27ae60' : '#e74c3c');

    charts.doublesOpponentHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: t('analytics.result', 'Resultado'),
                data: data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: -1.5,
                    max: 1.5,
                    ticks: {
                        callback: function(value) {
                            if (value === 1) return t('games.win', 'Vitória');
                            if (value === -1) return t('games.loss', 'Derrota');
                            return '';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const game = opponentGames[context[0].dataIndex];
                            return `${formatDateLabel(game.game_date)} ${getWithPartnerLabel(game.partner_name)}`;
                        },
                        label: function(context) {
                            const game = opponentGames[context.dataIndex];
                            const winLabel = t('games.win', 'Vitória');
                            const lossLabel = t('games.loss', 'Derrota');
                            const result = game.result === 'win' ? `🏆 ${winLabel}` : `❌ ${lossLabel}`;
                            const opponents = game.opponent2_name
                                ? `${getVersusLabel()} ${game.opponent_name} & ${game.opponent2_name}`
                                : `${getVersusLabel()} ${game.opponent_name}`;
                            return [result, opponents];
                        },
                        afterLabel: function(context) {
                            const game = opponentGames[context.dataIndex];
                            if (game.score) {
                                return `📊 ${game.score}`;
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });

    const stats = calculatePlayerStats(opponentGames);

    if (statsBox) {
        statsBox.style.display = 'block';
        const balanceClass = stats.setBalance > 0 ? 'wins' : stats.setBalance < 0 ? 'losses' : '';
        const balanceStr = stats.setBalance > 0 ? `+${stats.setBalance}` : stats.setBalance.toString();
        const streakHtml = getStreakDisplay(stats);

        statsBox.innerHTML = `
            <div class="stats-with-chart">
                <div class="mini-chart-container">
                    <canvas id="doublesOpponentMiniChart"></canvas>
                </div>
                <div class="stats-row">
                    <div class="player-stat-item">
                        <div class="player-stat-value wins">${stats.wins}</div>
                        <div class="player-stat-label">${t('stats.wins', 'Vitórias')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value losses">${stats.losses}</div>
                        <div class="player-stat-label">${t('stats.losses', 'Derrotas')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value">${stats.winRate}%</div>
                        <div class="player-stat-label">${t('analytics.winRateLabel', 'Taxa de Vitória')}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-value ${balanceClass}">${balanceStr}</div>
                        <div class="player-stat-label">${t('analytics.setBalance', 'Saldo de Sets')}</div>
                    </div>
                </div>
            </div>
            <div class="streak-container">${streakHtml}</div>
            <div class="h2h-button-container">
                <button class="btn btn-secondary btn-sm" onclick="openH2HModal('${selectedOpponent}', 'doubles', 'opponent')">
                    📋 ${t('analytics.viewFullHistory', 'Ver histórico completo')}
                </button>
            </div>
        `;

        // Render mini donut chart
        renderMiniDonutChart('doublesOpponentMiniChart', stats.wins, stats.losses);
    }
}

// =============================================================================
// HEAD-TO-HEAD MODAL
// =============================================================================

function openH2HModal(playerName, type, role) {
    // type: 'singles' or 'doubles'
    // role: 'opponent' or 'partner'

    let playerGames;
    let titlePrefix;

    if (type === 'singles') {
        playerGames = filteredGames.filter(g => g.game_type === 'singles' && g.opponent_name === playerName);
        titlePrefix = 'vs';
    } else if (role === 'partner') {
        playerGames = filteredGames.filter(g => g.game_type === 'doubles' && g.partner_name === playerName);
        titlePrefix = 'com';
    } else {
        playerGames = filteredGames.filter(g => g.game_type === 'doubles' &&
            (g.opponent_name === playerName || g.opponent2_name === playerName));
        titlePrefix = 'vs';
    }

    if (playerGames.length === 0) return;

    // Sort by date descending
    playerGames.sort((a, b) => b.game_date.localeCompare(a.game_date));

    const stats = calculatePlayerStats(playerGames);

    // Update title
    document.getElementById('h2hTitle').textContent = `Head-to-Head ${titlePrefix} ${playerName}`;

    // Build summary HTML
    const summaryHtml = buildH2HSummary(playerName, stats, type, role);
    document.getElementById('h2hSummary').innerHTML = summaryHtml;

    // Build games list HTML
    const gamesHtml = buildH2HGamesList(playerGames, type, role, playerName);
    document.getElementById('h2hGamesList').innerHTML = gamesHtml;

    openModal('h2hModal');
}

function buildH2HSummary(playerName, stats, type, role) {
    const streakHtml = getStreakDisplay(stats);
    const balanceClass = stats.setBalance > 0 ? 'positive' : stats.setBalance < 0 ? 'negative' : '';
    const balanceStr = stats.setBalance > 0 ? `+${stats.setBalance}` : stats.setBalance.toString();

    const youLabel = role === 'partner' ? t('analytics.youPlural', 'Vocês') : t('analytics.you', 'Você');
    const opponentLabel = role === 'partner' ? t('analytics.opponents', 'Adversários') : playerName;

    const winsLabel = stats.wins !== 1 ? t('stats.wins', 'vitórias').toLowerCase() : t('games.win', 'vitória').toLowerCase();
    const lossesAsWinsLabel = stats.losses !== 1 ? t('stats.wins', 'vitórias').toLowerCase() : t('games.win', 'vitória').toLowerCase();
    const gamesLabel = stats.total !== 1 ? t('analytics.games', 'jogos') : t('analytics.game', 'jogo');

    return `
        <div class="h2h-player left">
            <div class="h2h-player-name">${youLabel}</div>
            <div class="h2h-player-wins">${stats.wins}</div>
            <div>${winsLabel}</div>
        </div>
        <div class="h2h-vs">
            <div class="h2h-vs-text">${getVersusLabel().toUpperCase()}</div>
            <div class="h2h-total">${stats.total} ${gamesLabel}</div>
        </div>
        <div class="h2h-player right">
            <div class="h2h-player-name">${opponentLabel}</div>
            <div class="h2h-player-wins">${stats.losses}</div>
            <div>${lossesAsWinsLabel}</div>
        </div>
        <div class="h2h-stats-row" style="grid-column: 1 / -1;">
            <div class="h2h-stat">
                <div class="h2h-stat-value">${stats.winRate}%</div>
                <div class="h2h-stat-label">${t('analytics.winRateLabel', 'Taxa de Vitória')}</div>
            </div>
            <div class="h2h-stat">
                <div class="h2h-stat-value ${balanceClass}">${balanceStr}</div>
                <div class="h2h-stat-label">${t('analytics.setBalance', 'Saldo de Sets')}</div>
            </div>
            <div class="h2h-stat">
                <div class="h2h-stat-value">${stats.setsWon}-${stats.setsLost}</div>
                <div class="h2h-stat-label">${t('analytics.setsWonLost', 'Sets (G-P)')}</div>
            </div>
        </div>
        <div class="streak-container" style="grid-column: 1 / -1;">${streakHtml}</div>
    `;
}

function buildH2HGamesList(playerGames, type, role, selectedPlayer) {
    return playerGames.map(game => {
        const date = formatDateLabel(game.game_date);
        const resultClass = game.result === 'win' ? 'win' : 'loss';
        const resultText = game.result === 'win' ? t('games.win', 'Vitória') : t('games.loss', 'Derrota');

        let playersInfo = '';
        const vs = getVersusLabel();
        if (type === 'singles') {
            playersInfo = `${vs} ${game.opponent_name}`;
        } else if (role === 'partner') {
            const opponents = game.opponent2_name
                ? `${game.opponent_name} & ${game.opponent2_name}`
                : game.opponent_name;
            playersInfo = `${vs} ${opponents}`;
        } else {
            const opponents = game.opponent2_name
                ? `${game.opponent_name} & ${game.opponent2_name}`
                : game.opponent_name;
            playersInfo = `${getWithPartnerLabel(game.partner_name)} ${vs} ${opponents}`;
        }

        const gameType = type === 'singles' ? t('games.singles', 'Simples') : t('games.doubles', 'Duplas');

        return `
            <div class="h2h-game-item ${resultClass}">
                <div class="h2h-game-date">${date}</div>
                <div class="h2h-game-info">
                    <div class="h2h-game-players">${playersInfo}</div>
                    <div class="h2h-game-type">${gameType}</div>
                </div>
                <div class="h2h-game-score">${game.score || '-'}</div>
                <div class="h2h-game-result ${resultClass}">${resultText}</div>
            </div>
        `;
    }).join('');
}

// =============================================================================
// OVERVIEW CHARTS
// =============================================================================

function renderTypeChart() {
    const ctx = document.getElementById('typeChart');
    if (!ctx) return;

    if (charts.type) charts.type.destroy();

    const singlesWins = filteredGames.filter(g => g.game_type === 'singles' && g.result === 'win').length;
    const singlesLosses = filteredGames.filter(g => g.game_type === 'singles' && g.result !== 'win').length;
    const doublesWins = filteredGames.filter(g => g.game_type === 'doubles' && g.result === 'win').length;
    const doublesLosses = filteredGames.filter(g => g.game_type === 'doubles' && g.result !== 'win').length;

    charts.type = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [t('games.singles', 'Simples'), t('games.doubles', 'Duplas')],
            datasets: [
                { label: t('stats.wins', 'Vitórias'), data: [singlesWins, doublesWins], backgroundColor: '#27ae60' },
                { label: t('stats.losses', 'Derrotas'), data: [singlesLosses, doublesLosses], backgroundColor: '#e74c3c' }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderEvolutionChart() {
    const ctx = document.getElementById('evolutionChart');
    if (!ctx) return;

    if (charts.evolution) charts.evolution.destroy();

    if (filteredGames.length === 0) {
        charts.evolution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [t('common.noData', 'Sem dados')],
                datasets: [{ label: t('analytics.winRatePct', 'Taxa de Vitória (%)'), data: [0], borderColor: '#27ae60', fill: false }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
        return;
    }

    // Group games by date
    const dateStats = {};
    filteredGames.forEach(game => {
        const date = game.game_date;
        if (!dateStats[date]) {
            dateStats[date] = { wins: 0, total: 0 };
        }
        dateStats[date].total++;
        if (game.result === 'win') dateStats[date].wins++;
    });

    const sortedDates = Object.keys(dateStats).sort();
    let cumulativeWins = 0;
    let cumulativeTotal = 0;
    const labels = [];
    const dataPoints = [];

    sortedDates.forEach(date => {
        cumulativeWins += dateStats[date].wins;
        cumulativeTotal += dateStats[date].total;
        const winRate = Math.round((cumulativeWins / cumulativeTotal) * 100);
        dataPoints.push(winRate);
        labels.push(formatDateLabel(date));
    });

    charts.evolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: t('analytics.winRatePct', 'Taxa de Vitória (%)'),
                data: dataPoints,
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointBackgroundColor: '#27ae60'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: t('analytics.ratePct', 'Taxa (%)') } },
                x: { title: { display: true, text: t('analytics.date', 'Data') } }
            }
        }
    });
}

// Streak History Chart - shows win/loss streaks over time
function renderStreakChart() {
    const ctx = document.getElementById('streakChart');
    if (!ctx) return;

    if (charts.streak) charts.streak.destroy();

    if (filteredGames.length === 0) {
        charts.streak = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('common.noData', 'Sem dados')],
                datasets: [{ label: t('analytics.currentStreak', 'Sequência'), data: [0], backgroundColor: '#ccc' }]
            },
            options: { responsive: true }
        });
        return;
    }

    // Sort games by date
    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));

    // Calculate streaks
    const streakData = [];
    let currentStreak = 0;
    let lastResult = null;

    sortedGames.forEach((game, index) => {
        if (lastResult === null || game.result === lastResult) {
            currentStreak = game.result === 'win' ? currentStreak + 1 : currentStreak - 1;
        } else {
            currentStreak = game.result === 'win' ? 1 : -1;
        }
        lastResult = game.result;
        streakData.push({
            date: game.game_date,
            streak: currentStreak,
            result: game.result
        });
    });

    const labels = streakData.map(d => formatDateLabel(d.date));
    const data = streakData.map(d => d.streak);
    const colors = data.map(v => v > 0 ? '#27ae60' : '#e74c3c');

    charts.streak = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: t('analytics.currentStreak', 'Sequência Atual'),
                data,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    title: { display: true, text: t('analytics.currentStreak', 'Sequência') },
                    ticks: {
                        callback: function(value) {
                            return value > 0 ? `+${value}` : value;
                        }
                    }
                },
                x: { title: { display: true, text: t('analytics.date', 'Data') } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            if (value > 0) {
                                return `${value} ${t('analytics.winsInRow', 'vitórias seguidas')}`;
                            } else {
                                return `${Math.abs(value)} ${t('analytics.lossesInRow', 'derrotas seguidas')}`;
                            }
                        }
                    }
                }
            }
        }
    });
}

// Day of Week Chart - shows games distribution and win rate by day
function renderDayOfWeekChart() {
    const ctx = document.getElementById('dayOfWeekChart');
    if (!ctx) return;

    if (charts.dayOfWeek) charts.dayOfWeek.destroy();

    const dayNames = [
        t('analytics.sunday', 'Dom'),
        t('analytics.monday', 'Seg'),
        t('analytics.tuesday', 'Ter'),
        t('analytics.wednesday', 'Qua'),
        t('analytics.thursday', 'Qui'),
        t('analytics.friday', 'Sex'),
        t('analytics.saturday', 'Sáb')
    ];

    if (filteredGames.length === 0) {
        charts.dayOfWeek = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dayNames,
                datasets: [{ label: t('stats.totalGames', 'Total de Jogos'), data: [0,0,0,0,0,0,0], backgroundColor: '#ccc' }]
            },
            options: { responsive: true }
        });
        return;
    }

    // Count games and wins by day of week
    const dayStats = Array(7).fill(null).map(() => ({ total: 0, wins: 0 }));

    filteredGames.forEach(game => {
        const date = new Date(game.game_date + 'T12:00:00');
        const dayOfWeek = date.getDay();
        dayStats[dayOfWeek].total++;
        if (game.result === 'win') dayStats[dayOfWeek].wins++;
    });

    const totals = dayStats.map(d => d.total);
    const winRates = dayStats.map(d => d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0);

    charts.dayOfWeek = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [
                {
                    label: t('stats.totalGames', 'Total de Jogos'),
                    data: totals,
                    backgroundColor: '#3498db',
                    yAxisID: 'y'
                },
                {
                    label: t('analytics.winRatePct', 'Taxa de Vitória (%)'),
                    data: winRates,
                    type: 'line',
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: false,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: { display: true, text: t('stats.totalGames', 'Jogos') }
                },
                y1: {
                    beginAtZero: true,
                    max: 100,
                    position: 'right',
                    title: { display: true, text: t('analytics.ratePct', 'Taxa (%)') },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// Set Balance Evolution Chart - cumulative set balance over time
function renderSetBalanceChart() {
    const ctx = document.getElementById('setBalanceChart');
    if (!ctx) return;

    if (charts.setBalance) charts.setBalance.destroy();

    if (filteredGames.length === 0) {
        charts.setBalance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [t('common.noData', 'Sem dados')],
                datasets: [{ label: t('analytics.cumulativeBalance', 'Saldo Acumulado'), data: [0], borderColor: '#9b59b6' }]
            },
            options: { responsive: true }
        });
        return;
    }

    // Sort games by date
    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));

    // Calculate cumulative set balance
    let cumulativeBalance = 0;
    const labels = [];
    const balanceData = [];

    sortedGames.forEach(game => {
        // Calculate set balance from score using parseScore helper
        // Score format: "2-1 (6-4, 4-6, 6-3)" where 2-1 is the set count
        const scoreData = parseScore(game.score);
        let gameBalance = scoreData.balance;

        // If no score, use result as approximation (win = +1, loss = -1)
        if (!game.score) {
            gameBalance = game.result === 'win' ? 1 : -1;
        }

        cumulativeBalance += gameBalance;
        labels.push(formatDateLabel(game.game_date));
        balanceData.push(cumulativeBalance);
    });

    // Create gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(39, 174, 96, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(231, 76, 60, 0.3)');

    charts.setBalance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: t('analytics.cumulativeBalance', 'Saldo Acumulado'),
                data: balanceData,
                borderColor: '#9b59b6',
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: balanceData.map(v => v >= 0 ? '#27ae60' : '#e74c3c')
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    title: { display: true, text: t('analytics.cumulativeBalance', 'Saldo') },
                    ticks: {
                        callback: function(value) {
                            return value > 0 ? `+${value}` : value;
                        }
                    }
                },
                x: { title: { display: true, text: t('analytics.date', 'Data') } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return `${t('analytics.cumulativeBalance', 'Saldo')}: ${value > 0 ? '+' : ''}${value}`;
                        }
                    }
                }
            }
        }
    });
}

// Games Frequency Chart - games per week over time
function renderFrequencyChart() {
    const ctx = document.getElementById('frequencyChart');
    if (!ctx) return;

    if (charts.frequency) charts.frequency.destroy();

    if (filteredGames.length === 0) {
        charts.frequency = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('common.noData', 'Sem dados')],
                datasets: [{ label: t('analytics.gamesPerWeek', 'Jogos por Semana'), data: [0], backgroundColor: '#f39c12' }]
            },
            options: { responsive: true }
        });
        return;
    }

    // Group games by week
    const weekStats = {};

    filteredGames.forEach(game => {
        const date = new Date(game.game_date + 'T12:00:00');
        // Get the Monday of this week
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0];

        if (!weekStats[weekKey]) {
            weekStats[weekKey] = 0;
        }
        weekStats[weekKey]++;
    });

    const sortedWeeks = Object.keys(weekStats).sort();
    const labels = sortedWeeks.map(week => {
        const date = new Date(week + 'T12:00:00');
        return `${t('analytics.week', 'Sem')} ${formatDateLabel(week)}`;
    });
    const data = sortedWeeks.map(week => weekStats[week]);

    // Calculate average
    const avgGames = data.length > 0 ? (data.reduce((a, b) => a + b, 0) / data.length) : 0;

    charts.frequency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.gamesPerWeek', 'Jogos por Semana'),
                    data,
                    backgroundColor: '#f39c12',
                    borderColor: '#e67e22',
                    borderWidth: 1
                },
                {
                    label: t('analytics.average', 'Média'),
                    data: Array(data.length).fill(avgGames.toFixed(1)),
                    type: 'line',
                    borderColor: '#e74c3c',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: t('stats.totalGames', 'Jogos') },
                    ticks: { stepSize: 1 }
                },
                x: { title: { display: true, text: t('analytics.week', 'Semana') } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 1) {
                                return `${t('analytics.average', 'Média')}: ${context.raw}`;
                            }
                            return `${context.raw} ${context.raw === 1 ? t('analytics.game', 'jogo') : t('analytics.games', 'jogos')}`;
                        }
                    }
                }
            }
        }
    });
}

// =============================================================================
// MODAL HELPERS
// =============================================================================

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function openHelpModal() {
    openModal('helpModal');
    if (window.i18n && window.i18n.applyTranslations) {
        window.i18n.applyTranslations();
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function translateLevel(level) {
    const levelKeys = {
        beginner: 'players.beginner',
        intermediate: 'players.intermediate',
        advanced: 'players.advanced',
        professional: 'players.professional'
    };
    const fallbacks = {
        beginner: 'Iniciante',
        intermediate: 'Intermediário',
        advanced: 'Avançado',
        professional: 'Profissional'
    };
    return t(levelKeys[level], fallbacks[level] || level);
}

function translateStyle(style) {
    const styleKeys = {
        offensive: 'players.offensive',
        defensive: 'players.defensive',
        all_around: 'players.allAround'
    };
    const fallbacks = {
        offensive: 'Ofensivo',
        defensive: 'Defensivo',
        all_around: 'Equilibrado'
    };
    return t(styleKeys[style], fallbacks[style] || style);
}

function translateAgeGroup(ageGroup) {
    const ageGroupKeys = {
        under_20: 'players.under20',
        '20_39': 'players.age2039',
        '40_59': 'players.age4059',
        '60_plus': 'players.age60plus'
    };
    const fallbacks = {
        under_20: '-19',
        '20_39': '20-39',
        '40_59': '40-59',
        '60_plus': '60+'
    };
    return t(ageGroupKeys[ageGroup], fallbacks[ageGroup] || ageGroup || '20-39');
}
