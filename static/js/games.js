/**
 * Racket Pro Analyzer - Games Management JavaScript
 */

const API_URL = window.location.origin;
let currentToken = null;
let currentUser = null;
let currentSport = null;
let players = [];
let games = [];

// Export variables to window for voice-game-entry.js access
window.players = players;
window.currentToken = currentToken;
window.currentSport = currentSport;

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
// CUSTOM CONFIRM DIALOG
// =============================================================================

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <p class="confirm-message">${message}</p>
                <div class="confirm-buttons">
                    <button class="confirm-btn confirm-cancel">${t('common.cancel', 'Cancelar')}</button>
                    <button class="confirm-btn confirm-ok">${t('common.confirm', 'OK')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Focus OK button
        overlay.querySelector('.confirm-ok').focus();

        // Handle clicks
        overlay.querySelector('.confirm-cancel').onclick = () => {
            overlay.remove();
            resolve(false);
        };
        overlay.querySelector('.confirm-ok').onclick = () => {
            overlay.remove();
            resolve(true);
        };

        // Handle escape key
        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                resolve(false);
            }
        };
    });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentToken = localStorage.getItem('token');
    window.currentToken = currentToken; // Update window reference for voice-game-entry.js
    if (!currentToken) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    currentUser = JSON.parse(localStorage.getItem('user') || 'null');

    // Get sport from URL
    currentSport = getSportFromUrl();
    window.currentSport = currentSport; // Update window reference for voice-game-entry.js
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

// Override changeLanguage to also update sport name and re-render dynamic content
const originalChangeLanguage = window.changeLanguage;
window.changeLanguage = function(lang) {
    if (originalChangeLanguage) {
        originalChangeLanguage(lang);
    }
    // Update sport name and re-render games list after language change
    setTimeout(() => {
        updateSportDisplay();
        renderGamesList();
    }, 100);
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
        window.players = players; // Update window reference for voice-game-entry.js
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
                <button onclick="openPlayerProfile(${player.id})" class="btn-profile-small" title="${t('players.viewProfile', 'Ver Perfil')}">📊</button>
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
    const confirmed = await showConfirmDialog(t('players.confirmDelete', 'Tem certeza que deseja excluir este jogador?'));
    if (!confirmed) return;

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
// PLAYER PROFILE
// =============================================================================

function openPlayerProfile(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    // Get all games involving this player
    const gamesAgainst = games.filter(g =>
        g.opponent_id === playerId || g.opponent2_id === playerId
    );
    const gamesWith = games.filter(g => g.partner_id === playerId);

    // Calculate stats
    const winsAgainst = gamesAgainst.filter(g => g.result === 'win').length;
    const lossesAgainst = gamesAgainst.filter(g => g.result === 'loss').length;
    const winsWith = gamesWith.filter(g => g.result === 'win').length;
    const lossesWith = gamesWith.filter(g => g.result === 'loss').length;

    const winRateAgainst = gamesAgainst.length > 0 ? Math.round((winsAgainst / gamesAgainst.length) * 100) : 0;
    const winRateWith = gamesWith.length > 0 ? Math.round((winsWith / gamesWith.length) * 100) : 0;

    // Sort games by date (most recent first)
    const allPlayerGames = [...gamesAgainst.map(g => ({...g, role: 'opponent'})),
                           ...gamesWith.map(g => ({...g, role: 'partner'}))]
        .sort((a, b) => b.game_date.localeCompare(a.game_date));

    // Build profile HTML
    const handLabel = player.dominant_hand === 'left'
        ? (isPt ? '🫲 Canhoto' : isJa ? '🫲 左利き' : '🫲 Left-handed')
        : (isPt ? '🫱 Destro' : isJa ? '🫱 右利き' : '🫱 Right-handed');

    const profileTitle = isPt ? 'Perfil do Jogador' : isJa ? 'プレーヤープロファイル' : 'Player Profile';
    const statsTitle = isPt ? 'Estatísticas' : isJa ? '統計' : 'Statistics';
    const historyTitle = isPt ? 'Histórico de Jogos' : isJa ? '試合履歴' : 'Game History';
    const asOpponentLabel = isPt ? 'Como Adversário' : isJa ? '対戦相手として' : 'As Opponent';
    const asPartnerLabel = isPt ? 'Como Parceiro' : isJa ? 'パートナーとして' : 'As Partner';
    const gamesLabel = isPt ? 'jogos' : isJa ? '試合' : 'games';
    const winsLabel = isPt ? 'vitórias' : isJa ? '勝利' : 'wins';
    const lossesLabel = isPt ? 'derrotas' : isJa ? '敗北' : 'losses';
    const noGamesLabel = isPt ? 'Nenhum jogo registrado' : isJa ? '試合記録なし' : 'No games recorded';
    const winLabel = isPt ? 'VITÓRIA' : isJa ? '勝利' : 'WIN';
    const lossLabel = isPt ? 'DERROTA' : isJa ? '敗北' : 'LOSS';
    const vsLabel = isPt ? 'vs' : isJa ? 'vs' : 'vs';
    const withLabel = isPt ? 'com' : isJa ? 'と' : 'with';

    let html = `
        <div class="player-profile-header">
            <h2>👤 ${player.name}</h2>
            <p class="player-profile-details">
                ${handLabel} • ${translateLevel(player.level)} • ${translateStyle(player.play_style)} • ${translateAgeGroup(player.age_group)}
            </p>
            ${player.notes ? `<p class="player-profile-notes">📝 ${player.notes}</p>` : ''}
        </div>

        <div class="player-profile-stats">
            <h3>📊 ${statsTitle}</h3>
            <div class="stats-grid">
                <div class="stat-box ${winRateAgainst >= 50 ? 'stat-positive' : 'stat-negative'}">
                    <h4>⚔️ ${asOpponentLabel}</h4>
                    <div class="stat-value">${winRateAgainst}%</div>
                    <div class="stat-detail">${gamesAgainst.length} ${gamesLabel} (${winsAgainst} ${winsLabel} / ${lossesAgainst} ${lossesLabel})</div>
                </div>
                <div class="stat-box ${winRateWith >= 50 ? 'stat-positive' : 'stat-negative'}">
                    <h4>🤝 ${asPartnerLabel}</h4>
                    <div class="stat-value">${winRateWith}%</div>
                    <div class="stat-detail">${gamesWith.length} ${gamesLabel} (${winsWith} ${winsLabel} / ${lossesWith} ${lossesLabel})</div>
                </div>
            </div>
        </div>

        <div class="player-profile-history">
            <h3>📋 ${historyTitle}</h3>
            <div class="history-list">
    `;

    if (allPlayerGames.length === 0) {
        html += `<p class="no-games">${noGamesLabel}</p>`;
    } else {
        allPlayerGames.slice(0, 20).forEach(game => {
            const gameDate = formatDateLabel(game.game_date);
            const isWin = game.result === 'win';
            const resultClass = isWin ? 'result-win' : 'result-loss';
            const resultText = isWin ? winLabel : lossLabel;

            // Get opponent/partner names
            let opponentName = '';
            if (game.role === 'opponent') {
                // This player was the opponent
                opponentName = player.name;
            } else {
                // This player was the partner, show opponent
                const opponent = players.find(p => p.id === game.opponent_id);
                opponentName = opponent ? opponent.name : 'Unknown';
            }

            const roleIcon = game.role === 'opponent' ? '⚔️' : '🤝';
            const roleLabel = game.role === 'opponent' ? vsLabel : withLabel;
            const gameTypeIcon = game.game_type === 'doubles' ? '👥' : '👤';

            html += `
                <div class="history-item ${resultClass}">
                    <div class="history-date">${gameDate}</div>
                    <div class="history-details">
                        <span class="history-type">${gameTypeIcon}</span>
                        <span class="history-role">${roleIcon} ${roleLabel} ${player.name}</span>
                        ${game.score ? `<span class="history-score">${game.score}</span>` : ''}
                    </div>
                    <div class="history-result ${resultClass}">${resultText}</div>
                </div>
            `;
        });

        if (allPlayerGames.length > 20) {
            const moreGames = allPlayerGames.length - 20;
            const moreLabel = isPt ? `+ ${moreGames} jogos anteriores` : isJa ? `+ ${moreGames}試合` : `+ ${moreGames} more games`;
            html += `<p class="more-games">${moreLabel}</p>`;
        }
    }

    html += `
            </div>
        </div>
    `;

    // Show modal
    const modal = document.getElementById('playerProfileModal');
    if (!modal) {
        // Create modal if it doesn't exist
        const modalHtml = `
            <div id="playerProfileModal" class="modal" style="display: flex;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h2>👤 ${profileTitle}</h2>
                        <button onclick="closeModal('playerProfileModal')" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body" id="playerProfileContent">
                        ${html}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        document.getElementById('playerProfileContent').innerHTML = html;
        modal.style.display = 'flex';
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
                    <button onclick="viewGameDetails(${game.id})" class="btn-view-small" title="${t('games.viewDetails', 'Ver detalhes')}">🔍</button>
                    <button onclick="editGame(${game.id})" class="btn-edit-small" title="${t('games.edit', 'Editar')}">✏️</button>
                    <button onclick="deleteGame(${game.id})" class="btn-danger-small" title="${t('games.delete', 'Excluir')}">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to format W/L record according to language
function formatWinLoss(wins, losses) {
    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';

    if (lang.startsWith('ja')) {
        return `${wins}勝${losses}敗`;
    } else if (lang.startsWith('en')) {
        return `${wins}W/${losses}L`;
    }
    return `${wins}V/${losses}D`;
}

/**
 * Format detailed score for display (e.g., "11-5,8-11,12-10" -> "11x5, 8x11, 12x10")
 */
function formatDetailedScore(detailedScore) {
    if (!detailedScore) return '-';

    return detailedScore
        .split(',')
        .map((set, index) => {
            const [you, opp] = set.split('-').map(s => s.trim());
            const isWin = parseInt(you) > parseInt(opp);
            const setLabel = `Set ${index + 1}: `;
            const scoreText = `${you}x${opp}`;
            const icon = isWin ? '✓' : '✗';
            return `<span class="${isWin ? 'set-win' : 'set-loss'}">${scoreText} ${icon}</span>`;
        })
        .join(' | ');
}

function viewGameDetails(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const isDoubles = game.game_type === 'doubles';
    const opponent = players.find(p => p.id === game.opponent_id);
    const opponent2 = isDoubles ? players.find(p => p.id === game.opponent2_id) : null;
    const partner = isDoubles ? players.find(p => p.id === game.partner_id) : null;

    const opponentName = opponent ? opponent.name : t('common.unknown', 'Desconhecido');
    const opponent2Name = opponent2 ? opponent2.name : '';
    const partnerName = partner ? partner.name : '';

    const resultClass = game.result === 'win' ? 'win' : 'loss';
    const resultText = game.result === 'win' ? t('games.win', 'Vitória') : t('games.loss', 'Derrota');

    // Get head-to-head stats against opponent 1
    const h2hGames = games.filter(g => g.opponent_id === game.opponent_id);
    const h2hWins = h2hGames.filter(g => g.result === 'win').length;
    const h2hTotal = h2hGames.length;
    const h2hRate = h2hTotal > 0 ? Math.round((h2hWins / h2hTotal) * 100) : 0;

    // Get head-to-head stats against opponent 2 (for doubles)
    let h2h2Stats = null;
    if (isDoubles && opponent2) {
        const h2h2Games = games.filter(g => g.opponent_id === game.opponent2_id || g.opponent2_id === game.opponent2_id);
        const h2h2Wins = h2h2Games.filter(g => g.result === 'win').length;
        const h2h2Total = h2h2Games.length;
        const h2h2Rate = h2h2Total > 0 ? Math.round((h2h2Wins / h2h2Total) * 100) : 0;
        h2h2Stats = { wins: h2h2Wins, total: h2h2Total, rate: h2h2Rate };
    }

    // Get partnership stats (games played WITH partner)
    let partnerStats = null;
    if (isDoubles && partner) {
        const partnerGames = games.filter(g => g.partner_id === game.partner_id);
        const partnerWins = partnerGames.filter(g => g.result === 'win').length;
        const partnerTotal = partnerGames.length;
        const partnerRate = partnerTotal > 0 ? Math.round((partnerWins / partnerTotal) * 100) : 0;
        partnerStats = { wins: partnerWins, total: partnerTotal, rate: partnerRate };
    }

    let content = `
        <div class="game-details-content">
            <div class="game-detail-row">
                <span class="detail-label">${t('games.date', 'Data')}:</span>
                <span class="detail-value">${formatDate(game.game_date)}</span>
            </div>
            <div class="game-detail-row">
                <span class="detail-label">${t('games.gameType', 'Tipo')}:</span>
                <span class="detail-value">${getGameTypeLabel(game.game_type)}</span>
            </div>
            <div class="game-detail-row">
                <span class="detail-label">${t('games.opponent', 'Adversário')}:</span>
                <span class="detail-value">${opponentName}${opponent2Name ? ' & ' + opponent2Name : ''}</span>
            </div>
            ${partnerName ? `
            <div class="game-detail-row">
                <span class="detail-label">${t('games.partner', 'Parceiro')}:</span>
                <span class="detail-value">${partnerName}</span>
            </div>
            ` : ''}
            <div class="game-detail-row">
                <span class="detail-label">${t('games.score', 'Placar')}:</span>
                <span class="detail-value">${game.score || '-'}</span>
            </div>
            ${game.detailed_score ? `
            <div class="game-detail-row">
                <span class="detail-label">${t('games.detailedScore', 'Placar detalhado')}:</span>
                <span class="detail-value">${formatDetailedScore(game.detailed_score)}</span>
            </div>
            ` : ''}
            <div class="game-detail-row">
                <span class="detail-label">${t('games.result', 'Resultado')}:</span>
                <span class="detail-value result-${resultClass}">${resultText}</span>
            </div>
            <hr style="margin: 12px 0; border: none; border-top: 1px solid var(--border-color);">
            <div class="game-detail-row">
                <span class="detail-label">${t('analytics.h2hVs', 'Histórico vs')} ${opponentName}:</span>
                <span class="detail-value">${formatWinLoss(h2hWins, h2hTotal - h2hWins)} (${h2hRate}%)</span>
            </div>
            ${h2h2Stats ? `
            <div class="game-detail-row">
                <span class="detail-label">${t('analytics.h2hVs', 'Histórico vs')} ${opponent2Name}:</span>
                <span class="detail-value">${formatWinLoss(h2h2Stats.wins, h2h2Stats.total - h2h2Stats.wins)} (${h2h2Stats.rate}%)</span>
            </div>
            ` : ''}
            ${partnerStats ? `
            <div class="game-detail-row">
                <span class="detail-label">${t('games.historyWith', 'Histórico com')} ${partnerName}:</span>
                <span class="detail-value">${formatWinLoss(partnerStats.wins, partnerStats.total - partnerStats.wins)} (${partnerStats.rate}%)</span>
            </div>
            ` : ''}
        </div>
    `;

    // Create or update modal
    let modal = document.getElementById('gameDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gameDetailsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2 id="gameDetailsTitle"></h2>
                    <button onclick="closeModal('gameDetailsModal')" class="close-btn">&times;</button>
                </div>
                <div class="modal-body" id="gameDetailsBody"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('gameDetailsTitle').textContent = t('games.gameDetails', 'Detalhes do Jogo');
    document.getElementById('gameDetailsBody').innerHTML = content;
    modal.style.display = 'flex';
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

    // Load detailed score if exists
    const enableDetailedScore = document.getElementById('enableDetailedScore');
    const detailedScoreContainer = document.getElementById('detailedScoreContainer');
    const detailedScoreInput = document.getElementById('detailedScore');

    if (game.detailed_score) {
        enableDetailedScore.checked = true;
        detailedScoreContainer.style.display = 'block';
        detailedScoreInput.value = game.detailed_score;
        generateDetailedScoreInputs();

        // Fill in the detailed score values
        const scores = game.detailed_score.split(',');
        scores.forEach((score, index) => {
            const setNumber = index + 1;
            const [youScore, oppScore] = score.split('-').map(s => s.trim());
            const youInput = document.getElementById(`detailedSetYou${setNumber}`);
            const oppInput = document.getElementById(`detailedSetOpp${setNumber}`);
            if (youInput && oppInput) {
                youInput.value = youScore;
                oppInput.value = oppScore;
                updateDetailedSetResult(setNumber);
            }
        });
        updateDetailedScoreSummary();
    } else {
        enableDetailedScore.checked = false;
        detailedScoreContainer.style.display = 'none';
        detailedScoreInput.value = '';
    }

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

    // Reset detailed score section
    const enableDetailedScore = document.getElementById('enableDetailedScore');
    if (enableDetailedScore) {
        enableDetailedScore.checked = false;
        document.getElementById('detailedScoreContainer').style.display = 'none';
        document.getElementById('detailedScore').value = '';
        document.getElementById('detailedScoreInputs').innerHTML = '';
        document.getElementById('detailedScoreSummary').style.display = 'none';
    }

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

    // Update detailed score inputs if enabled
    const enableDetailedScore = document.getElementById('enableDetailedScore');
    if (enableDetailedScore?.checked) {
        generateDetailedScoreInputs();
    }
}

/**
 * Toggle detailed score section visibility
 */
function toggleDetailedScore() {
    const checkbox = document.getElementById('enableDetailedScore');
    const container = document.getElementById('detailedScoreContainer');

    if (checkbox.checked) {
        container.style.display = 'block';
        generateDetailedScoreInputs();
    } else {
        container.style.display = 'none';
        document.getElementById('detailedScore').value = '';
    }
}

/**
 * Generate detailed score input fields based on total sets
 */
function generateDetailedScoreInputs() {
    const setsWonInput = document.getElementById('setsWon');
    const setsLostInput = document.getElementById('setsLost');
    const setsWon = parseInt(setsWonInput.value) || 0;
    const setsLost = parseInt(setsLostInput.value) || 0;
    const totalSets = setsWon + setsLost;

    const container = document.getElementById('detailedScoreInputs');
    const summaryContainer = document.getElementById('detailedScoreSummary');

    // Check if BOTH fields are filled (not empty strings)
    const bothFieldsFilled = setsWonInput.value !== '' && setsLostInput.value !== '';

    if (!bothFieldsFilled || totalSets === 0) {
        container.innerHTML = `<p style="color: var(--text-light); text-align: center; font-size: 0.9em;">
            ${t('games.fillSetsFirst', 'Preencha o placar em sets acima primeiro')}
        </p>`;
        summaryContainer.style.display = 'none';
        return;
    }

    // Add header row with "You" and "Opponent" labels
    let html = `
        <div class="detailed-set-header">
            <span class="detailed-set-label"></span>
            <div class="detailed-set-inputs">
                <span class="detailed-header-label">${t('games.you', 'Você')}</span>
                <span class="detailed-set-vs"></span>
                <span class="detailed-header-label">${t('games.opponent', 'Adversário')}</span>
            </div>
            <span class="detailed-set-result"></span>
        </div>
    `;

    for (let i = 1; i <= totalSets; i++) {
        html += `
            <div class="detailed-set-row">
                <span class="detailed-set-label">Set ${i}</span>
                <div class="detailed-set-inputs">
                    <input type="number"
                           class="detailed-set-input"
                           id="detailedSetYou${i}"
                           min="0"
                           max="99"
                           placeholder="0"
                           oninput="updateDetailedSetResult(${i}); updateDetailedScoreSummary();">
                    <span class="detailed-set-vs">x</span>
                    <input type="number"
                           class="detailed-set-input"
                           id="detailedSetOpp${i}"
                           min="0"
                           max="99"
                           placeholder="0"
                           oninput="updateDetailedSetResult(${i}); updateDetailedScoreSummary();">
                </div>
                <span class="detailed-set-result" id="detailedSetResult${i}"></span>
            </div>
        `;
    }

    container.innerHTML = html;
    summaryContainer.style.display = 'none';
}

/**
 * Update visual feedback for a specific set result
 */
function updateDetailedSetResult(setNumber) {
    const youInput = document.getElementById(`detailedSetYou${setNumber}`);
    const oppInput = document.getElementById(`detailedSetOpp${setNumber}`);
    const resultSpan = document.getElementById(`detailedSetResult${setNumber}`);

    const youScore = parseInt(youInput.value) || 0;
    const oppScore = parseInt(oppInput.value) || 0;

    // Reset classes
    youInput.classList.remove('winner', 'loser');
    oppInput.classList.remove('winner', 'loser');

    if (youInput.value === '' && oppInput.value === '') {
        resultSpan.textContent = '';
        return;
    }

    if (youScore > oppScore) {
        youInput.classList.add('winner');
        oppInput.classList.add('loser');
        resultSpan.textContent = '✓';
    } else if (oppScore > youScore) {
        youInput.classList.add('loser');
        oppInput.classList.add('winner');
        resultSpan.textContent = '✗';
    } else {
        resultSpan.textContent = '=';
    }
}

/**
 * Update the summary showing total points
 */
function updateDetailedScoreSummary() {
    const setsWon = parseInt(document.getElementById('setsWon').value) || 0;
    const setsLost = parseInt(document.getElementById('setsLost').value) || 0;
    const totalSets = setsWon + setsLost;

    const summaryContainer = document.getElementById('detailedScoreSummary');

    let totalYou = 0;
    let totalOpp = 0;
    let filledSets = 0;
    let detailedScores = [];
    let detailedSetsWon = 0;
    let detailedSetsLost = 0;

    for (let i = 1; i <= totalSets; i++) {
        const youScore = parseInt(document.getElementById(`detailedSetYou${i}`)?.value) || 0;
        const oppScore = parseInt(document.getElementById(`detailedSetOpp${i}`)?.value) || 0;

        const youInput = document.getElementById(`detailedSetYou${i}`);
        const oppInput = document.getElementById(`detailedSetOpp${i}`);

        if (youInput?.value !== '' || oppInput?.value !== '') {
            totalYou += youScore;
            totalOpp += oppScore;
            filledSets++;
            detailedScores.push(`${youScore}-${oppScore}`);

            // Count sets won/lost based on detailed scores
            if (youScore > oppScore) {
                detailedSetsWon++;
            } else if (oppScore > youScore) {
                detailedSetsLost++;
            }
        }
    }

    // Update hidden input with detailed score
    const detailedScoreInput = document.getElementById('detailedScore');
    if (filledSets === totalSets && totalSets > 0) {
        detailedScoreInput.value = detailedScores.join(',');
    } else {
        detailedScoreInput.value = '';
    }

    if (filledSets > 0) {
        const diff = totalYou - totalOpp;
        const diffClass = diff > 0 ? 'positive' : (diff < 0 ? 'negative' : '');
        const diffSign = diff > 0 ? '+' : '';

        // Check if detailed scores match the set score
        const isConsistent = (detailedSetsWon === setsWon && detailedSetsLost === setsLost);
        const warningHtml = !isConsistent && filledSets === totalSets ? `
            <div class="summary-item summary-warning">
                <span class="summary-label" style="color: var(--danger-color);">⚠️ ${t('games.scoreInconsistent', 'Placar inconsistente!')}</span>
                <span class="summary-value" style="color: var(--danger-color);">${detailedSetsWon}-${detailedSetsLost} ≠ ${setsWon}-${setsLost}</span>
            </div>
        ` : '';

        summaryContainer.innerHTML = `
            ${warningHtml}
            <div class="summary-item">
                <span class="summary-label">📊 ${t('games.totalPoints', 'Total')}:</span>
                <span class="summary-value">${totalYou} x ${totalOpp}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">⚖️ ${t('games.pointsDiff', 'Saldo')}:</span>
                <span class="summary-value ${diffClass}">${diffSign}${diff}</span>
            </div>
        `;
        summaryContainer.style.display = 'flex';
    } else {
        summaryContainer.style.display = 'none';
    }
}

/**
 * Validate that detailed scores are consistent with set score
 * Returns { valid: boolean, message: string, detailedSetsWon: number, detailedSetsLost: number }
 */
function validateDetailedScoreConsistency() {
    const setsWon = parseInt(document.getElementById('setsWon').value) || 0;
    const setsLost = parseInt(document.getElementById('setsLost').value) || 0;
    const totalSets = setsWon + setsLost;

    let detailedSetsWon = 0;
    let detailedSetsLost = 0;

    for (let i = 1; i <= totalSets; i++) {
        const youScore = parseInt(document.getElementById(`detailedSetYou${i}`)?.value) || 0;
        const oppScore = parseInt(document.getElementById(`detailedSetOpp${i}`)?.value) || 0;

        if (youScore > oppScore) {
            detailedSetsWon++;
        } else if (oppScore > youScore) {
            detailedSetsLost++;
        }
        // Ties don't count as won or lost
    }

    const isConsistent = (detailedSetsWon === setsWon && detailedSetsLost === setsLost);

    return {
        valid: isConsistent,
        detailedSetsWon,
        detailedSetsLost,
        expectedWon: setsWon,
        expectedLost: setsLost,
        message: isConsistent ? '' : t('games.detailedScoreMismatch',
            `Os placares detalhados (${detailedSetsWon}x${detailedSetsLost}) não correspondem ao placar em sets (${setsWon}x${setsLost}). Deseja corrigir?`)
    };
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

    // Ensure detailed score is updated before submit
    const enableDetailedScore = document.getElementById('enableDetailedScore');
    if (enableDetailedScore?.checked) {
        updateDetailedScoreSummary();

        // Validate consistency between detailed scores and set score
        const validation = validateDetailedScoreConsistency();
        if (!validation.valid) {
            const confirmSave = confirm(
                t('games.detailedScoreMismatch',
                    `Os placares detalhados (${validation.detailedSetsWon}x${validation.detailedSetsLost}) não correspondem ao placar em sets (${validation.expectedWon}x${validation.expectedLost}).\n\nDeseja salvar mesmo assim?`)
            );
            if (!confirmSave) {
                return;
            }
        }
    }

    const detailedScoreValue = document.getElementById('detailedScore').value;

    const gameData = {
        sport: currentSport,
        game_type: gameType,
        game_date: document.getElementById('gameDate').value,
        result: result,
        score: document.getElementById('gameScore').value || null,
        detailed_score: detailedScoreValue || null,
        location: document.getElementById('gameLocation').value || null,
        notes: document.getElementById('gameNotes').value || null
    };

    console.log('Saving game with detailed_score:', detailedScoreValue);

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

        // Check for new achievements after saving game
        if (window.gamification && window.gamification.checkAchievementsAfterGame) {
            window.gamification.checkAchievementsAfterGame();
        }
    } catch (error) {
        console.error('Erro ao salvar jogo:', error);
        alert('Erro ao salvar jogo: ' + error.message);
    }
}

async function deleteGame(gameId) {
    const confirmed = await showConfirmDialog(t('games.confirmDelete', 'Tem certeza que deseja excluir este jogo?'));
    if (!confirmed) return;

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
    // Initialize chart expansion after a small delay to ensure charts are rendered
    setTimeout(() => {
        initChartExpansion();
    }, 200);
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
        // Generate analyses after charts are rendered
        setTimeout(() => {
            generateChartAnalyses();
            generateComprehensiveAnalysis();
        }, 100);
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

// Helper function to format date as DD/MM/YY (with year for clarity)
function formatDateLabel(dateStr) {
    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const date = new Date(dateStr + 'T00:00:00');

    if (lang.startsWith('ja')) {
        // Japanese format: YYYY年MM月DD日
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}年${month}月${day}日`;
    } else if (lang.startsWith('en')) {
        // English format: MM/DD/YY
        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    }
    // Portuguese format: DD/MM/YY
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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

// Calculate trend based on last 3 games
function calculateTrend(playerGames) {
    if (playerGames.length < 3) {
        return { trend: null, trendDirection: null };
    }

    // Sort by date descending (most recent first)
    const sortedGames = [...playerGames].sort((a, b) => b.game_date.localeCompare(a.game_date));

    // Analyze last 3 games
    const last3 = sortedGames.slice(0, 3);
    const winsInLast3 = last3.filter(g => g.result === 'win').length;
    const lastGameWon = last3[0].result === 'win';

    let trend = null;
    let trendDirection = null;

    // Logic:
    // 3 wins → Improving
    // 2 wins + last win → Improving
    // 2 wins + last loss → Stable
    // 1 win + last win → Stable
    // 1 win + last loss → Declining
    // 0 wins → Declining

    if (winsInLast3 === 3) {
        trendDirection = 'up';
        trend = `<span class="trend trend-up">↗️ ${t('analytics.improving', 'Melhorando')}</span>`;
    } else if (winsInLast3 === 2) {
        if (lastGameWon) {
            trendDirection = 'up';
            trend = `<span class="trend trend-up">↗️ ${t('analytics.improving', 'Melhorando')}</span>`;
        } else {
            trendDirection = 'stable';
            trend = `<span class="trend trend-stable">→ ${t('analytics.stable', 'Estável')}</span>`;
        }
    } else if (winsInLast3 === 1) {
        if (lastGameWon) {
            trendDirection = 'stable';
            trend = `<span class="trend trend-stable">→ ${t('analytics.stable', 'Estável')}</span>`;
        } else {
            trendDirection = 'down';
            trend = `<span class="trend trend-down">↘️ ${t('analytics.declining', 'Piorando')}</span>`;
        }
    } else {
        trendDirection = 'down';
        trend = `<span class="trend trend-down">↘️ ${t('analytics.declining', 'Piorando')}</span>`;
    }

    return { trend, trendDirection };
}

// Calculate linear regression for chart display
function calculateLinearRegression(playerGames) {
    if (playerGames.length < 2) {
        return null;
    }

    // Sort by date ascending (oldest first)
    const sortedGames = [...playerGames].sort((a, b) => a.game_date.localeCompare(b.game_date));

    const n = sortedGames.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    sortedGames.forEach((game, index) => {
        const x = index + 1;
        const y = game.result === 'win' ? 1 : -1; // 1 for win, -1 for loss (matches chart)
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });

    // slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX^2)
    // intercept = (sumY - slope*sumX) / n
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate start and end points for the regression line
    const startY = intercept + slope * 1;
    const endY = intercept + slope * n;

    return { slope, intercept, startY, endY, n };
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
// PERFORMANCE ANALYSIS MODAL
// =============================================================================

let performanceGameType = 'singles';
let performancePeriod = 'all';

// Helper to filter games by period
function filterGamesByPeriod(gamesList, period) {
    if (period === 'all') return gamesList;

    const now = new Date();
    let cutoffDate;

    switch (period) {
        case 'month':
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
        case 'quarter':
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            break;
        case 'semester':
            cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            break;
        default:
            return gamesList;
    }

    return gamesList.filter(g => new Date(g.game_date) >= cutoffDate);
}

// Open Performance Analysis Modal
function openPerformanceModal(gameType) {
    performanceGameType = gameType;
    performancePeriod = 'all';

    // Reset period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === 'all') {
            btn.classList.add('active');
        }
    });

    document.getElementById('performanceModal').style.display = 'flex';
    renderPerformanceCharts();
}

// Set performance period
function setPerformancePeriod(period) {
    performancePeriod = period;

    // Update button states
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        }
    });

    renderPerformanceCharts();
}

// Render both performance charts
function renderPerformanceCharts() {
    renderTemporalEvolutionChart();
    renderResultsDistributionChart();
}

// Render Temporal Evolution Chart (line chart with wins/losses by month)
function renderTemporalEvolutionChart() {
    const ctx = document.getElementById('temporalEvolutionChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;

    if (charts.temporalEvolution) charts.temporalEvolution.destroy();

    // Filter games by type and period
    const typeGames = filteredGames.filter(g => g.game_type === performanceGameType);
    const periodGames = filterGamesByPeriod(typeGames, performancePeriod);

    if (periodGames.length === 0) {
        charts.temporalEvolution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [t('analytics.noGamesInPeriod', 'Sem jogos no período')],
                datasets: [{ data: [0], borderColor: '#ccc' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
        return;
    }

    // Group games by month (YYYY-MM format)
    const monthlyData = {};
    periodGames.forEach(game => {
        const date = new Date(game.game_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { wins: 0, losses: 0 };
        }

        if (game.result === 'win') {
            monthlyData[monthKey].wins++;
        } else if (game.result === 'loss') {
            monthlyData[monthKey].losses++;
        }
    });

    // Sort months and create arrays
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths;
    const winsData = sortedMonths.map(m => monthlyData[m].wins);
    const lossesData = sortedMonths.map(m => monthlyData[m].losses);

    charts.temporalEvolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: t('stats.wins', 'Wins'),
                    data: winsData,
                    borderColor: '#27ae60',
                    backgroundColor: '#27ae60',
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: false
                },
                {
                    label: t('stats.losses', 'Losses'),
                    data: lossesData,
                    borderColor: '#e74c3c',
                    backgroundColor: '#e74c3c',
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    borderDash: [5, 5],
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// Render Results Distribution Chart (donut/pie chart)
function renderResultsDistributionChart() {
    const ctx = document.getElementById('resultsDistributionChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;

    if (charts.resultsDistribution) charts.resultsDistribution.destroy();

    // Filter games by type and period
    const typeGames = filteredGames.filter(g => g.game_type === performanceGameType);
    const periodGames = filterGamesByPeriod(typeGames, performancePeriod);

    const wins = periodGames.filter(g => g.result === 'win').length;
    const losses = periodGames.filter(g => g.result === 'loss').length;
    const total = wins + losses;

    if (total === 0) {
        charts.resultsDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [t('analytics.noGamesInPeriod', 'Sem jogos')],
                datasets: [{ data: [1], backgroundColor: ['#ccc'] }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
        return;
    }

    const winPct = Math.round((wins / total) * 100);
    const lossPct = Math.round((losses / total) * 100);

    charts.resultsDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `${t('stats.wins', 'Vitórias')} (${winPct}%)`,
                `${t('stats.losses', 'Derrotas')} (${lossPct}%)`
            ],
            datasets: [{
                data: [wins, losses],
                backgroundColor: ['#27ae60', '#e74c3c'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                            return ` ${value} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
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

    // Calculate linear regression for trend line
    const regression = calculateLinearRegression(playerGames);
    const regressionData = regression ?
        playerGames.map((_, index) => regression.intercept + regression.slope * (index + 1)) :
        [];

    charts.singlesHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.result', 'Resultado'),
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 4,
                    gameData: playerGames, // Store game data for tooltip
                    order: 1
                },
                {
                    label: t('analytics.trendLine', 'Tendência'),
                    data: regressionData,
                    type: 'line',
                    borderColor: '#3498db',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 0
                }
            ]
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
                    filter: function(tooltipItem) {
                        return tooltipItem.datasetIndex === 0; // Only show tooltip for bar chart
                    },
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

    // Calculate linear regression for trend line
    const regression = calculateLinearRegression(partnerGames);
    const regressionData = regression ?
        partnerGames.map((_, index) => regression.intercept + regression.slope * (index + 1)) :
        [];

    charts.doublesPartnerHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.result', 'Resultado'),
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 4,
                    order: 1
                },
                {
                    label: t('analytics.trendLine', 'Tendência'),
                    data: regressionData,
                    type: 'line',
                    borderColor: '#3498db',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 0
                }
            ]
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
                    filter: function(tooltipItem) {
                        return tooltipItem.datasetIndex === 0;
                    },
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

    // Calculate linear regression for trend line
    const regression = calculateLinearRegression(opponentGames);
    const regressionData = regression ?
        opponentGames.map((_, index) => regression.intercept + regression.slope * (index + 1)) :
        [];

    charts.doublesOpponentHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.result', 'Resultado'),
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 4,
                    order: 1
                },
                {
                    label: t('analytics.trendLine', 'Tendência'),
                    data: regressionData,
                    type: 'line',
                    borderColor: '#3498db',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 0
                }
            ]
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
                    filter: function(tooltipItem) {
                        return tooltipItem.datasetIndex === 0;
                    },
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

    // Generate analysis text
    const analysisHtml = generateH2HAnalysis(playerName, stats, type, role);

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
        <div class="h2h-analysis" style="grid-column: 1 / -1;">${analysisHtml}</div>
    `;
}

function generateH2HAnalysis(playerName, stats, type, role) {
    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    const parts = [];

    // Dominance analysis
    if (stats.winRate >= 70) {
        if (role === 'partner') {
            if (isPt) parts.push(`<span class="analysis-positive">Excelente parceria!</span> Vocês têm ${stats.winRate}% de aproveitamento juntos.`);
            else if (isJa) parts.push(`<span class="analysis-positive">素晴らしいパートナーシップ！</span> 一緒に${stats.winRate}%の勝率。`);
            else parts.push(`<span class="analysis-positive">Excellent partnership!</span> You have ${stats.winRate}% win rate together.`);
        } else {
            if (isPt) parts.push(`<span class="analysis-positive">Você domina este confronto!</span> Aproveitamento de ${stats.winRate}%.`);
            else if (isJa) parts.push(`<span class="analysis-positive">この対戦を支配しています！</span> 勝率${stats.winRate}%。`);
            else parts.push(`<span class="analysis-positive">You dominate this matchup!</span> ${stats.winRate}% win rate.`);
        }
    } else if (stats.winRate <= 30) {
        if (role === 'partner') {
            if (isPt) parts.push(`<span class="analysis-negative">Parceria difícil.</span> Apenas ${stats.winRate}% de aproveitamento juntos.`);
            else if (isJa) parts.push(`<span class="analysis-negative">難しいパートナーシップ。</span> 一緒に${stats.winRate}%の勝率のみ。`);
            else parts.push(`<span class="analysis-negative">Difficult partnership.</span> Only ${stats.winRate}% win rate together.`);
        } else {
            if (isPt) parts.push(`<span class="analysis-negative">Adversário difícil!</span> Apenas ${stats.winRate}% de aproveitamento.`);
            else if (isJa) parts.push(`<span class="analysis-negative">難しい相手！</span> 勝率は${stats.winRate}%のみ。`);
            else parts.push(`<span class="analysis-negative">Tough opponent!</span> Only ${stats.winRate}% win rate.`);
        }
    } else if (stats.winRate >= 45 && stats.winRate <= 55) {
        if (isPt) parts.push(`<span class="analysis-highlight">Confronto equilibrado!</span> ${stats.wins} vitórias x ${stats.losses} derrotas.`);
        else if (isJa) parts.push(`<span class="analysis-highlight">バランスの取れた対戦！</span> ${stats.wins}勝 x ${stats.losses}敗。`);
        else parts.push(`<span class="analysis-highlight">Balanced matchup!</span> ${stats.wins} wins x ${stats.losses} losses.`);
    }

    // Recent trend (streak)
    if (stats.currentStreak >= 3) {
        if (stats.lastResult === 'win') {
            if (isPt) parts.push(`🔥 Em alta! ${stats.currentStreak} vitórias consecutivas.`);
            else if (isJa) parts.push(`🔥 好調！ ${stats.currentStreak}連勝中。`);
            else parts.push(`🔥 Hot streak! ${stats.currentStreak} consecutive wins.`);
        } else {
            if (isPt) parts.push(`⚠️ Atenção: ${stats.currentStreak} derrotas consecutivas.`);
            else if (isJa) parts.push(`⚠️ 注意: ${stats.currentStreak}連敗中。`);
            else parts.push(`⚠️ Warning: ${stats.currentStreak} consecutive losses.`);
        }
    }

    // Set balance insight
    if (stats.setBalance > 5) {
        if (isPt) parts.push(`Saldo de sets muito favorável: <span class="analysis-positive">+${stats.setBalance}</span>.`);
        else if (isJa) parts.push(`セットバランスが非常に有利: <span class="analysis-positive">+${stats.setBalance}</span>。`);
        else parts.push(`Very favorable set balance: <span class="analysis-positive">+${stats.setBalance}</span>.`);
    } else if (stats.setBalance < -5) {
        if (isPt) parts.push(`Saldo de sets desfavorável: <span class="analysis-negative">${stats.setBalance}</span>.`);
        else if (isJa) parts.push(`セットバランスが不利: <span class="analysis-negative">${stats.setBalance}</span>。`);
        else parts.push(`Unfavorable set balance: <span class="analysis-negative">${stats.setBalance}</span>.`);
    }

    // Last game info
    if (stats.lastGame) {
        const lastDate = formatDateLabel(stats.lastGame);
        if (stats.lastResult === 'win') {
            if (isPt) parts.push(`Último jogo (${lastDate}): <span class="analysis-positive">Vitória</span>.`);
            else if (isJa) parts.push(`最後の試合 (${lastDate}): <span class="analysis-positive">勝利</span>。`);
            else parts.push(`Last game (${lastDate}): <span class="analysis-positive">Win</span>.`);
        } else {
            if (isPt) parts.push(`Último jogo (${lastDate}): <span class="analysis-negative">Derrota</span>.`);
            else if (isJa) parts.push(`最後の試合 (${lastDate}): <span class="analysis-negative">敗北</span>。`);
            else parts.push(`Last game (${lastDate}): <span class="analysis-negative">Loss</span>.`);
        }
    }

    if (parts.length === 0) {
        if (isPt) return `<p>Histórico de ${stats.total} ${stats.total === 1 ? 'jogo' : 'jogos'} registrado(s).</p>`;
        else if (isJa) return `<p>${stats.total}試合の履歴。</p>`;
        else return `<p>History of ${stats.total} ${stats.total === 1 ? 'game' : 'games'} recorded.</p>`;
    }

    return `<p>${parts.join(' ')}</p>`;
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

    // Sort all games by date
    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));

    const labels = [];
    const movingAvg10 = [];
    const movingAvg30 = [];
    const pointColors = [];

    sortedGames.forEach((game, index) => {
        const isWin = game.result === 'win';

        // Moving average - last 10 games
        const start10 = Math.max(0, index + 1 - 10);
        const window10 = sortedGames.slice(start10, index + 1);
        const wins10 = window10.filter(g => g.result === 'win').length;
        movingAvg10.push(Math.round((wins10 / window10.length) * 100));

        // Moving average - last 30 games
        const start30 = Math.max(0, index + 1 - 30);
        const window30 = sortedGames.slice(start30, index + 1);
        const wins30 = window30.filter(g => g.result === 'win').length;
        movingAvg30.push(Math.round((wins30 / window30.length) * 100));

        // Point color based on game result
        pointColors.push(isWin ? '#27ae60' : '#e74c3c');

        labels.push(formatDateLabel(game.game_date));
    });

    charts.evolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.movingAvg10', 'Últimos 10 jogos (%)'),
                    data: movingAvg10,
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    pointBorderWidth: 2,
                    order: 0
                },
                {
                    label: t('analytics.movingAvg30', 'Últimos 30 jogos (%)'),
                    data: movingAvg30,
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    min: -5,
                    max: 105,
                    title: { display: true, text: t('analytics.winRatePct', 'Taxa de Vitória (%)') }
                },
                x: { title: { display: true, text: t('analytics.date', 'Data') } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw;
                            if (context.datasetIndex === 0) {
                                const gameIndex = context.dataIndex;
                                const isWin = sortedGames[gameIndex]?.result === 'win';
                                const resultText = isWin ? t('stats.win', 'Vitória') : t('stats.loss', 'Derrota');
                                return [`${label}: ${value}%`, resultText];
                            }
                            return `${label}: ${value}%`;
                        }
                    }
                }
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

    // Separate data into wins and losses for proper legend
    const winData = data.map(v => v > 0 ? v : null);
    const lossData = data.map(v => v < 0 ? v : null);

    charts.streak = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.winStreakLegend', 'Vitórias consecutivas'),
                    data: winData,
                    backgroundColor: '#27ae60',
                    borderColor: '#27ae60',
                    borderWidth: 1
                },
                {
                    label: t('analytics.lossStreakLegend', 'Derrotas consecutivas'),
                    data: lossData,
                    backgroundColor: '#e74c3c',
                    borderColor: '#e74c3c',
                    borderWidth: 1
                }
            ]
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
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: t('analytics.winRatePct', 'Taxa de Vitória (%)'),
                    data: winRates,
                    type: 'line',
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: false,
                    tension: 0.3,
                    yAxisID: 'y1',
                    order: 1
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

// Set Statistics Chart - shows sets won/lost by month with win rate line
function renderSetBalanceChart() {
    const ctx = document.getElementById('setBalanceChart');
    if (!ctx) return;

    if (charts.setBalance) charts.setBalance.destroy();

    if (filteredGames.length === 0) {
        charts.setBalance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [t('common.noData', 'Sem dados')],
                datasets: [{ label: t('analytics.setsWon', 'Sets Ganhos'), data: [0], backgroundColor: '#27ae60' }]
            },
            options: { responsive: true }
        });
        return;
    }

    // Sort games by date
    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));

    // Group by month (YYYY-MM)
    const monthStats = {};

    sortedGames.forEach(game => {
        const monthKey = game.game_date.substring(0, 7); // YYYY-MM

        if (!monthStats[monthKey]) {
            monthStats[monthKey] = { setsWon: 0, setsLost: 0 };
        }

        // Calculate sets from score using parseScore helper
        const scoreData = parseScore(game.score);

        // If no score data, estimate based on result
        if (!game.score || (scoreData.setsWon === 0 && scoreData.setsLost === 0)) {
            // Estimate: win = 2-0 or 2-1, loss = 0-2 or 1-2
            if (game.result === 'win') {
                monthStats[monthKey].setsWon += 2;
                monthStats[monthKey].setsLost += Math.random() < 0.6 ? 0 : 1;
            } else {
                monthStats[monthKey].setsLost += 2;
                monthStats[monthKey].setsWon += Math.random() < 0.6 ? 0 : 1;
            }
        } else {
            monthStats[monthKey].setsWon += scoreData.setsWon;
            monthStats[monthKey].setsLost += scoreData.setsLost;
        }
    });

    // Convert to arrays sorted by month
    const sortedMonths = Object.keys(monthStats).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return `${month}/${year.slice(-2)}`;
    });
    const setsWonData = sortedMonths.map(m => monthStats[m].setsWon);
    const setsLostData = sortedMonths.map(m => monthStats[m].setsLost);
    const winRateData = sortedMonths.map(m => {
        const total = monthStats[m].setsWon + monthStats[m].setsLost;
        return total > 0 ? Math.round((monthStats[m].setsWon / total) * 100) : 0;
    });

    charts.setBalance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('analytics.setsWon', 'Sets Ganhos'),
                    data: setsWonData,
                    backgroundColor: '#27ae60',
                    yAxisID: 'y'
                },
                {
                    label: t('analytics.setsLost', 'Sets Perdidos'),
                    data: setsLostData,
                    backgroundColor: '#e74c3c',
                    yAxisID: 'y'
                },
                {
                    label: t('analytics.setWinRate', 'Taxa Sets (%)'),
                    data: winRateData,
                    type: 'line',
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#9b59b6',
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
                    title: { display: true, text: t('analytics.sets', 'Sets') },
                    ticks: { stepSize: 1 }
                },
                y1: {
                    beginAtZero: true,
                    max: 100,
                    position: 'right',
                    title: { display: true, text: t('analytics.ratePct', 'Taxa (%)') },
                    grid: { drawOnChartArea: false }
                },
                x: { title: { display: true, text: t('analytics.month', 'Mês') } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw;
                            if (context.datasetIndex === 2) {
                                return `${label}: ${value}%`;
                            }
                            return `${label}: ${value}`;
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
                    ticks: { stepSize: 1 },
                    afterBuildTicks: function(scale) {
                        // Add average value to ticks if not already present
                        const avgVal = parseFloat(avgGames.toFixed(1));
                        if (!scale.ticks.some(tick => Math.abs(tick.value - avgVal) < 0.1)) {
                            scale.ticks.push({ value: avgVal });
                            scale.ticks.sort((a, b) => a.value - b.value);
                        }
                    }
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
                },
                legend: {
                    labels: {
                        generateLabels: function(chart) {
                            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            // Update average label to show the value
                            if (original[1]) {
                                original[1].text = `${t('analytics.average', 'Média')}: ${avgGames.toFixed(1)}`;
                            }
                            return original;
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
    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const date = new Date(dateStr + 'T00:00:00');

    if (lang.startsWith('ja')) {
        // Japanese format: YYYY年MM月DD日
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}年${month}月${day}日`;
    } else if (lang.startsWith('en')) {
        // English format: MM/DD/YY
        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    }
    // Portuguese format: DD/MM/YY
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
    if (!ageGroup) return '20-39';

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
    const key = ageGroupKeys[ageGroup];
    if (!key) return fallbacks[ageGroup] || ageGroup || '20-39';
    return t(key, fallbacks[ageGroup] || ageGroup || '20-39');
}

// =============================================================================
// CHART ANALYSIS FUNCTIONS
// =============================================================================

function generateChartAnalyses() {
    generateTypeChartAnalysis();
    generateEvolutionChartAnalysis();
    generateStreakChartAnalysis();
    generateDayOfWeekChartAnalysis();
    generateSetBalanceChartAnalysis();
    generateFrequencyChartAnalysis();
}

function generateTypeChartAnalysis() {
    const el = document.getElementById('typeChartAnalysis');
    if (!el) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    const singlesGames = filteredGames.filter(g => g.game_type === 'singles');
    const doublesGames = filteredGames.filter(g => g.game_type === 'doubles');
    const singlesWins = singlesGames.filter(g => g.result === 'win').length;
    const doublesWins = doublesGames.filter(g => g.result === 'win').length;
    const singlesLosses = singlesGames.length - singlesWins;
    const doublesLosses = doublesGames.length - doublesWins;
    const singlesRate = singlesGames.length > 0 ? Math.round((singlesWins / singlesGames.length) * 100) : 0;
    const doublesRate = doublesGames.length > 0 ? Math.round((doublesWins / doublesGames.length) * 100) : 0;

    if (filteredGames.length === 0) {
        el.innerHTML = '';
        return;
    }

    let parts = [];

    // Singles stats
    if (singlesGames.length > 0) {
        if (isPt) {
            parts.push(`<strong>Simples:</strong> ${singlesGames.length} jogos (${singlesWins}V/${singlesLosses}D) = <span class="${singlesRate >= 50 ? 'analysis-positive' : 'analysis-negative'}">${singlesRate}%</span>`);
        } else if (isJa) {
            parts.push(`<strong>シングルス:</strong> ${singlesGames.length}試合 (${singlesWins}勝/${singlesLosses}敗) = <span class="${singlesRate >= 50 ? 'analysis-positive' : 'analysis-negative'}">${singlesRate}%</span>`);
        } else {
            parts.push(`<strong>Singles:</strong> ${singlesGames.length} games (${singlesWins}W/${singlesLosses}L) = <span class="${singlesRate >= 50 ? 'analysis-positive' : 'analysis-negative'}">${singlesRate}%</span>`);
        }
    }

    // Doubles stats
    if (doublesGames.length > 0) {
        if (isPt) {
            parts.push(`<strong>Duplas:</strong> ${doublesGames.length} jogos (${doublesWins}V/${doublesLosses}D) = <span class="${doublesRate >= 50 ? 'analysis-positive' : 'analysis-negative'}">${doublesRate}%</span>`);
        } else if (isJa) {
            parts.push(`<strong>ダブルス:</strong> ${doublesGames.length}試合 (${doublesWins}勝/${doublesLosses}敗) = <span class="${doublesRate >= 50 ? 'analysis-positive' : 'analysis-negative'}">${doublesRate}%</span>`);
        } else {
            parts.push(`<strong>Doubles:</strong> ${doublesGames.length} games (${doublesWins}W/${doublesLosses}L) = <span class="${doublesRate >= 50 ? 'analysis-positive' : 'analysis-negative'}">${doublesRate}%</span>`);
        }
    }

    // Comparison
    const diff = Math.abs(singlesRate - doublesRate);
    if (singlesGames.length > 0 && doublesGames.length > 0 && diff >= 10) {
        if (singlesRate > doublesRate) {
            if (isPt) parts.push(`Você é <span class="analysis-highlight">${diff}% melhor</span> em simples.`);
            else if (isJa) parts.push(`シングルスが<span class="analysis-highlight">${diff}%上</span>`);
            else parts.push(`You're <span class="analysis-highlight">${diff}% better</span> at singles.`);
        } else {
            if (isPt) parts.push(`Você é <span class="analysis-highlight">${diff}% melhor</span> em duplas.`);
            else if (isJa) parts.push(`ダブルスが<span class="analysis-highlight">${diff}%上</span>`);
            else parts.push(`You're <span class="analysis-highlight">${diff}% better</span> at doubles.`);
        }
    }

    el.innerHTML = parts.join(' | ');
}

function generateEvolutionChartAnalysis() {
    const el = document.getElementById('evolutionChartAnalysis');
    if (!el) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    if (filteredGames.length < 5) {
        el.innerHTML = '';
        return;
    }

    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));
    const totalGames = sortedGames.length;
    const totalWins = filteredGames.filter(g => g.result === 'win').length;
    const overallRate = Math.round((totalWins / totalGames) * 100);

    // Calculate last 10 and last 30 games rates
    const last10Games = sortedGames.slice(-Math.min(10, totalGames));
    const last30Games = sortedGames.slice(-Math.min(30, totalGames));

    const last10Wins = last10Games.filter(g => g.result === 'win').length;
    const last30Wins = last30Games.filter(g => g.result === 'win').length;

    const rate10 = Math.round((last10Wins / last10Games.length) * 100);
    const rate30 = Math.round((last30Wins / last30Games.length) * 100);

    // Trend: compare short-term (10) vs medium-term (30)
    const trendDiff = rate10 - rate30;

    // Recent streak
    let recentStreak = 0;
    let streakType = null;
    for (let i = sortedGames.length - 1; i >= 0; i--) {
        const isWin = sortedGames[i].result === 'win';
        if (streakType === null) {
            streakType = isWin ? 'win' : 'loss';
            recentStreak = 1;
        } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
            recentStreak++;
        } else {
            break;
        }
    }

    let parts = [];

    // Current form based on moving averages
    if (isPt) {
        parts.push(`<strong>Últimos 10 jogos:</strong> <span class="analysis-highlight">${rate10}%</span> (${last10Wins}V/${last10Games.length - last10Wins}D)`);
        if (totalGames >= 30) {
            parts.push(`<strong>Últimos 30 jogos:</strong> <span class="analysis-highlight">${rate30}%</span> (${last30Wins}V/${last30Games.length - last30Wins}D)`);
        }
    } else if (isJa) {
        parts.push(`<strong>直近10試合:</strong> <span class="analysis-highlight">${rate10}%</span> (${last10Wins}勝/${last10Games.length - last10Wins}敗)`);
        if (totalGames >= 30) {
            parts.push(`<strong>直近30試合:</strong> <span class="analysis-highlight">${rate30}%</span> (${last30Wins}勝/${last30Games.length - last30Wins}敗)`);
        }
    } else {
        parts.push(`<strong>Last 10 games:</strong> <span class="analysis-highlight">${rate10}%</span> (${last10Wins}W/${last10Games.length - last10Wins}L)`);
        if (totalGames >= 30) {
            parts.push(`<strong>Last 30 games:</strong> <span class="analysis-highlight">${rate30}%</span> (${last30Wins}W/${last30Games.length - last30Wins}L)`);
        }
    }

    // Trend analysis
    if (totalGames >= 30) {
        if (trendDiff > 10) {
            if (isPt) parts.push(`<span class="analysis-positive">↑ Em alta!</span> Curto prazo ${trendDiff}% acima do médio prazo`);
            else if (isJa) parts.push(`<span class="analysis-positive">↑ 好調！</span> 短期が中期より${trendDiff}%上`);
            else parts.push(`<span class="analysis-positive">↑ Hot streak!</span> Short-term ${trendDiff}% above medium-term`);
        } else if (trendDiff < -10) {
            if (isPt) parts.push(`<span class="analysis-negative">↓ Em baixa</span> Curto prazo ${Math.abs(trendDiff)}% abaixo do médio prazo`);
            else if (isJa) parts.push(`<span class="analysis-negative">↓ 不調</span> 短期が中期より${Math.abs(trendDiff)}%下`);
            else parts.push(`<span class="analysis-negative">↓ Cold streak</span> Short-term ${Math.abs(trendDiff)}% below medium-term`);
        } else {
            if (isPt) parts.push(`<span class="analysis-highlight">→ Estável</span> Tendência constante`);
            else if (isJa) parts.push(`<span class="analysis-highlight">→ 安定</span> 一定のパフォーマンス`);
            else parts.push(`<span class="analysis-highlight">→ Stable</span> Consistent performance`);
        }
    }

    // Current streak
    if (recentStreak >= 3) {
        if (streakType === 'win') {
            if (isPt) parts.push(`🔥 <span class="analysis-positive">${recentStreak} vitórias seguidas!</span>`);
            else if (isJa) parts.push(`🔥 <span class="analysis-positive">${recentStreak}連勝中！</span>`);
            else parts.push(`🔥 <span class="analysis-positive">${recentStreak} wins in a row!</span>`);
        } else {
            if (isPt) parts.push(`⚠️ <span class="analysis-negative">${recentStreak} derrotas seguidas</span>`);
            else if (isJa) parts.push(`⚠️ <span class="analysis-negative">${recentStreak}連敗中</span>`);
            else parts.push(`⚠️ <span class="analysis-negative">${recentStreak} losses in a row</span>`);
        }
    }

    el.innerHTML = parts.join('<br>');
}

function generateStreakChartAnalysis() {
    const el = document.getElementById('streakChartAnalysis');
    if (!el) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    if (filteredGames.length < 3) {
        el.innerHTML = '';
        return;
    }

    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));

    // Calculate streaks with dates
    let currentStreak = 0;
    let bestWinStreak = 0, bestWinStreakEnd = null;
    let worstLossStreak = 0, worstLossStreakEnd = null;
    let tempStreak = 0;
    let lastResult = null;

    sortedGames.forEach(game => {
        if (game.result === lastResult) {
            tempStreak++;
        } else {
            tempStreak = 1;
        }

        if (game.result === 'win') {
            if (tempStreak > bestWinStreak) {
                bestWinStreak = tempStreak;
                bestWinStreakEnd = game.game_date;
            }
        } else {
            if (tempStreak > worstLossStreak) {
                worstLossStreak = tempStreak;
                worstLossStreakEnd = game.game_date;
            }
        }

        lastResult = game.result;
        currentStreak = game.result === 'win' ? tempStreak : -tempStreak;
    });

    // Count total streaks
    let winStreaks = 0, lossStreaks = 0;
    lastResult = null;
    sortedGames.forEach(game => {
        if (game.result !== lastResult) {
            if (game.result === 'win') winStreaks++;
            else lossStreaks++;
        }
        lastResult = game.result;
    });

    let parts = [];

    // Current streak
    const formatDate = (d) => { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };

    if (currentStreak > 0) {
        if (isPt) parts.push(`<strong>Agora:</strong> <span class="analysis-positive">${currentStreak} vitória(s) seguida(s)!</span>`);
        else if (isJa) parts.push(`<strong>現在:</strong> <span class="analysis-positive">${currentStreak}連勝中！</span>`);
        else parts.push(`<strong>Now:</strong> <span class="analysis-positive">${currentStreak} win(s) in a row!</span>`);
    } else if (currentStreak < 0) {
        if (isPt) parts.push(`<strong>Agora:</strong> <span class="analysis-negative">${Math.abs(currentStreak)} derrota(s) seguida(s)</span>`);
        else if (isJa) parts.push(`<strong>現在:</strong> <span class="analysis-negative">${Math.abs(currentStreak)}連敗中</span>`);
        else parts.push(`<strong>Now:</strong> <span class="analysis-negative">${Math.abs(currentStreak)} loss(es) in a row</span>`);
    }

    // Records
    if (isPt) {
        parts.push(`<strong>Recorde:</strong> <span class="analysis-positive">${bestWinStreak}V seguidas</span> (até ${formatDate(bestWinStreakEnd)}) | <strong>Pior:</strong> <span class="analysis-negative">${worstLossStreak}D seguidas</span> (até ${formatDate(worstLossStreakEnd)})`);
    } else if (isJa) {
        parts.push(`<strong>記録:</strong> <span class="analysis-positive">${bestWinStreak}連勝</span> (${formatDate(bestWinStreakEnd)}まで) | <strong>最悪:</strong> <span class="analysis-negative">${worstLossStreak}連敗</span> (${formatDate(worstLossStreakEnd)}まで)`);
    } else {
        parts.push(`<strong>Record:</strong> <span class="analysis-positive">${bestWinStreak}W in a row</span> (until ${formatDate(bestWinStreakEnd)}) | <strong>Worst:</strong> <span class="analysis-negative">${worstLossStreak}L in a row</span> (until ${formatDate(worstLossStreakEnd)})`);
    }

    // Consistency insight
    const avgStreakLength = (filteredGames.length / (winStreaks + lossStreaks)).toFixed(1);
    if (avgStreakLength >= 3) {
        if (isPt) parts.push(`Você tende a ter sequências longas (média de ${avgStreakLength} jogos por sequência)`);
        else if (isJa) parts.push(`長いストリークの傾向 (平均${avgStreakLength}試合/ストリーク)`);
        else parts.push(`You tend to have long streaks (avg ${avgStreakLength} games per streak)`);
    } else {
        if (isPt) parts.push(`Resultados alternados frequentemente (média de ${avgStreakLength} jogos por sequência)`);
        else if (isJa) parts.push(`結果が頻繁に入れ替わる (平均${avgStreakLength}試合/ストリーク)`);
        else parts.push(`Results alternate frequently (avg ${avgStreakLength} games per streak)`);
    }

    el.innerHTML = parts.join('<br>');
}

function generateDayOfWeekChartAnalysis() {
    const el = document.getElementById('dayOfWeekChartAnalysis');
    if (!el) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    if (filteredGames.length < 7) {
        el.innerHTML = '';
        return;
    }

    const dayNamesPt = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayNamesShortPt = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesShortEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesJa = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
    const dayNamesShortJa = ['日', '月', '火', '水', '木', '金', '土'];

    const dayNames = isPt ? dayNamesPt : (isJa ? dayNamesJa : dayNamesEn);
    const dayNamesShort = isPt ? dayNamesShortPt : (isJa ? dayNamesShortJa : dayNamesShortEn);

    // Calculate stats by day
    const dayStats = Array(7).fill(null).map(() => ({ total: 0, wins: 0 }));
    filteredGames.forEach(game => {
        const date = new Date(game.game_date + 'T12:00:00');
        const dayOfWeek = date.getDay();
        dayStats[dayOfWeek].total++;
        if (game.result === 'win') dayStats[dayOfWeek].wins++;
    });

    // Sort days by number of games
    const sortedDays = dayStats.map((stat, day) => ({ day, ...stat, rate: stat.total > 0 ? Math.round((stat.wins / stat.total) * 100) : 0 }))
        .filter(d => d.total > 0)
        .sort((a, b) => b.total - a.total);

    // Find best and worst performing days (min 3 games)
    const qualifiedDays = sortedDays.filter(d => d.total >= 3);
    const bestDay = qualifiedDays.length > 0 ? qualifiedDays.reduce((best, d) => d.rate > best.rate ? d : best) : null;
    const worstDay = qualifiedDays.length > 0 ? qualifiedDays.reduce((worst, d) => d.rate < worst.rate ? d : worst) : null;

    let parts = [];

    // Most played days
    const top3Days = sortedDays.slice(0, 3);
    if (isPt) {
        parts.push(`<strong>Dias mais jogados:</strong> ${top3Days.map(d => `${dayNamesShort[d.day]} (${d.total} jogos, ${d.rate}%)`).join(', ')}`);
    } else if (isJa) {
        parts.push(`<strong>よく対戦する曜日:</strong> ${top3Days.map(d => `${dayNamesShort[d.day]} (${d.total}試合, ${d.rate}%)`).join(', ')}`);
    } else {
        parts.push(`<strong>Most played days:</strong> ${top3Days.map(d => `${dayNamesShort[d.day]} (${d.total} games, ${d.rate}%)`).join(', ')}`);
    }

    // Best and worst performance
    if (bestDay && worstDay && bestDay.day !== worstDay.day) {
        if (isPt) {
            parts.push(`<strong>Melhor dia:</strong> <span class="analysis-positive">${dayNames[bestDay.day]}</span> com ${bestDay.rate}% (${bestDay.wins}V/${bestDay.total - bestDay.wins}D) | <strong>Pior:</strong> <span class="analysis-negative">${dayNames[worstDay.day]}</span> com ${worstDay.rate}% (${worstDay.wins}V/${worstDay.total - worstDay.wins}D)`);
        } else if (isJa) {
            parts.push(`<strong>ベスト:</strong> <span class="analysis-positive">${dayNames[bestDay.day]}</span> ${bestDay.rate}% (${bestDay.wins}勝/${bestDay.total - bestDay.wins}敗) | <strong>ワースト:</strong> <span class="analysis-negative">${dayNames[worstDay.day]}</span> ${worstDay.rate}% (${worstDay.wins}勝/${worstDay.total - worstDay.wins}敗)`);
        } else {
            parts.push(`<strong>Best day:</strong> <span class="analysis-positive">${dayNames[bestDay.day]}</span> at ${bestDay.rate}% (${bestDay.wins}W/${bestDay.total - bestDay.wins}L) | <strong>Worst:</strong> <span class="analysis-negative">${dayNames[worstDay.day]}</span> at ${worstDay.rate}% (${worstDay.wins}W/${worstDay.total - worstDay.wins}L)`);
        }

        // Insight
        const diff = bestDay.rate - worstDay.rate;
        if (diff >= 20) {
            if (isPt) parts.push(`<em>Dica: Você é ${diff}% melhor às ${dayNames[bestDay.day]}s. Considere agendar jogos importantes nesse dia.</em>`);
            else if (isJa) parts.push(`<em>ヒント: ${dayNames[bestDay.day]}は${diff}%高い。重要な試合をこの日に。</em>`);
            else parts.push(`<em>Tip: You're ${diff}% better on ${dayNames[bestDay.day]}s. Consider scheduling important games on this day.</em>`);
        }
    }

    el.innerHTML = parts.join('<br>');
}

function generateSetBalanceChartAnalysis() {
    const el = document.getElementById('setBalanceChartAnalysis');
    if (!el) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    if (filteredGames.length < 5) {
        el.innerHTML = '';
        return;
    }

    // Calculate sets by month
    const monthStats = {};
    filteredGames.forEach(game => {
        const month = game.game_date.substring(0, 7);
        if (!monthStats[month]) monthStats[month] = { setsWon: 0, setsLost: 0, games: 0 };

        const scoreData = parseScore(game.score);
        if (scoreData.setsWon > 0 || scoreData.setsLost > 0) {
            monthStats[month].setsWon += scoreData.setsWon;
            monthStats[month].setsLost += scoreData.setsLost;
        } else {
            // Estimate based on typical badminton scores
            if (game.result === 'win') {
                monthStats[month].setsWon += 2;
                monthStats[month].setsLost += Math.random() < 0.6 ? 0 : 1;
            } else {
                monthStats[month].setsLost += 2;
                monthStats[month].setsWon += Math.random() < 0.6 ? 0 : 1;
            }
        }
        monthStats[month].games++;
    });

    // Total stats
    let totalSetsWon = 0, totalSetsLost = 0;
    Object.values(monthStats).forEach(s => {
        totalSetsWon += s.setsWon;
        totalSetsLost += s.setsLost;
    });

    const totalSets = totalSetsWon + totalSetsLost;
    const setWinRate = totalSets > 0 ? Math.round((totalSetsWon / totalSets) * 100) : 0;
    const balance = totalSetsWon - totalSetsLost;

    // Find best and worst months
    const monthEntries = Object.entries(monthStats).map(([month, stats]) => ({
        month,
        ...stats,
        rate: stats.setsWon + stats.setsLost > 0 ? Math.round((stats.setsWon / (stats.setsWon + stats.setsLost)) * 100) : 0
    })).filter(m => m.games >= 3);

    const bestMonth = monthEntries.length > 0 ? monthEntries.reduce((best, m) => m.rate > best.rate ? m : best) : null;
    const worstMonth = monthEntries.length > 0 ? monthEntries.reduce((worst, m) => m.rate < worst.rate ? m : worst) : null;

    let parts = [];

    // Total stats
    if (isPt) {
        parts.push(`<strong>Total:</strong> <span class="analysis-positive">${totalSetsWon} sets ganhos</span> vs <span class="analysis-negative">${totalSetsLost} perdidos</span> = <span class="analysis-highlight">${setWinRate}%</span> | Saldo: <span class="${balance >= 0 ? 'analysis-positive' : 'analysis-negative'}">${balance >= 0 ? '+' : ''}${balance}</span>`);
    } else if (isJa) {
        parts.push(`<strong>合計:</strong> <span class="analysis-positive">${totalSetsWon}セット勝ち</span> vs <span class="analysis-negative">${totalSetsLost}負け</span> = <span class="analysis-highlight">${setWinRate}%</span> | 差: <span class="${balance >= 0 ? 'analysis-positive' : 'analysis-negative'}">${balance >= 0 ? '+' : ''}${balance}</span>`);
    } else {
        parts.push(`<strong>Total:</strong> <span class="analysis-positive">${totalSetsWon} sets won</span> vs <span class="analysis-negative">${totalSetsLost} lost</span> = <span class="analysis-highlight">${setWinRate}%</span> | Balance: <span class="${balance >= 0 ? 'analysis-positive' : 'analysis-negative'}">${balance >= 0 ? '+' : ''}${balance}</span>`);
    }

    // Best and worst months
    if (bestMonth && worstMonth && bestMonth.month !== worstMonth.month) {
        const formatMonth = (m) => { const [y, mo] = m.split('-'); return `${mo}/${y.slice(-2)}`; };
        if (isPt) {
            parts.push(`<strong>Melhor mês:</strong> ${formatMonth(bestMonth.month)} (${bestMonth.rate}%, ${bestMonth.setsWon}V/${bestMonth.setsLost}D) | <strong>Pior:</strong> ${formatMonth(worstMonth.month)} (${worstMonth.rate}%, ${worstMonth.setsWon}V/${worstMonth.setsLost}D)`);
        } else if (isJa) {
            parts.push(`<strong>ベスト月:</strong> ${formatMonth(bestMonth.month)} (${bestMonth.rate}%, ${bestMonth.setsWon}勝/${bestMonth.setsLost}敗) | <strong>ワースト:</strong> ${formatMonth(worstMonth.month)} (${worstMonth.rate}%, ${worstMonth.setsWon}勝/${worstMonth.setsLost}敗)`);
        } else {
            parts.push(`<strong>Best month:</strong> ${formatMonth(bestMonth.month)} (${bestMonth.rate}%, ${bestMonth.setsWon}W/${bestMonth.setsLost}L) | <strong>Worst:</strong> ${formatMonth(worstMonth.month)} (${worstMonth.rate}%, ${worstMonth.setsWon}W/${worstMonth.setsLost}L)`);
        }
    }

    // Average sets per game
    const avgSetsPerGame = (totalSets / filteredGames.length).toFixed(1);
    if (isPt) parts.push(`Média de ${avgSetsPerGame} sets por jogo`);
    else if (isJa) parts.push(`1試合あたり平均${avgSetsPerGame}セット`);
    else parts.push(`Average ${avgSetsPerGame} sets per game`);

    el.innerHTML = parts.join('<br>');
}

function generateFrequencyChartAnalysis() {
    const el = document.getElementById('frequencyChartAnalysis');
    if (!el) return;

    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    if (filteredGames.length < 5) {
        el.innerHTML = '';
        return;
    }

    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));
    const firstDate = new Date(sortedGames[0].game_date);
    const lastDate = new Date(sortedGames[sortedGames.length - 1].game_date);
    const totalDays = Math.max(1, Math.ceil((lastDate - firstDate) / (24 * 60 * 60 * 1000)));
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const gamesPerWeek = (filteredGames.length / totalWeeks).toFixed(1);
    const gamesPerMonth = (filteredGames.length / (totalDays / 30)).toFixed(1);

    // Calculate by week (consistent with the chart)
    const weekCounts = {};
    filteredGames.forEach(game => {
        const d = new Date(game.game_date);
        // Get Monday of that week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const weekKey = monday.toISOString().substring(0, 10);
        weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
    });

    const weekEntries = Object.entries(weekCounts).sort((a, b) => b[1] - a[1]);
    const mostActiveWeek = weekEntries[0];
    const leastActiveWeek = weekEntries[weekEntries.length - 1];

    // Recent activity
    const last30Days = sortedGames.filter(g => {
        const gameDate = new Date(g.game_date);
        const daysDiff = (lastDate - gameDate) / (24 * 60 * 60 * 1000);
        return daysDiff <= 30;
    }).length;

    // Weeks without games
    const weekMap = {};
    sortedGames.forEach(g => {
        const d = new Date(g.game_date);
        const weekNum = Math.floor((d - firstDate) / (7 * 24 * 60 * 60 * 1000));
        weekMap[weekNum] = true;
    });
    const weeksWithoutGames = totalWeeks - Object.keys(weekMap).length;

    let parts = [];

    // Overall frequency
    if (isPt) {
        parts.push(`<strong>Frequência:</strong> <span class="analysis-highlight">${gamesPerWeek}</span> jogos/semana (${gamesPerMonth}/mês) | <strong>Total:</strong> ${filteredGames.length} jogos em ${totalWeeks} semanas`);
    } else if (isJa) {
        parts.push(`<strong>頻度:</strong> <span class="analysis-highlight">${gamesPerWeek}</span>試合/週 (${gamesPerMonth}/月) | <strong>合計:</strong> ${totalWeeks}週間で${filteredGames.length}試合`);
    } else {
        parts.push(`<strong>Frequency:</strong> <span class="analysis-highlight">${gamesPerWeek}</span> games/week (${gamesPerMonth}/month) | <strong>Total:</strong> ${filteredGames.length} games in ${totalWeeks} weeks`);
    }

    // Most and least active week (consistent with chart which shows weeks)
    if (mostActiveWeek && leastActiveWeek && mostActiveWeek[0] !== leastActiveWeek[0]) {
        const formatWeek = (dateStr) => {
            const d = new Date(dateStr);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = String(d.getFullYear()).slice(-2);
            return `${day}/${month}/${year}`;
        };
        if (isPt) {
            parts.push(`<strong>Mais ativo:</strong> Semana ${formatWeek(mostActiveWeek[0])} (${mostActiveWeek[1]} jogos) | <strong>Menos ativo:</strong> Semana ${formatWeek(leastActiveWeek[0])} (${leastActiveWeek[1]} jogos)`);
        } else if (isJa) {
            parts.push(`<strong>最多:</strong> 週 ${formatWeek(mostActiveWeek[0])} (${mostActiveWeek[1]}試合) | <strong>最少:</strong> 週 ${formatWeek(leastActiveWeek[0])} (${leastActiveWeek[1]}試合)`);
        } else {
            parts.push(`<strong>Most active:</strong> Week ${formatWeek(mostActiveWeek[0])} (${mostActiveWeek[1]} games) | <strong>Least active:</strong> Week ${formatWeek(leastActiveWeek[0])} (${leastActiveWeek[1]} games)`);
        }
    }

    // Recent activity insight
    if (isPt) {
        parts.push(`<strong>Últimos 30 dias:</strong> ${last30Days} jogos | Semanas sem jogar: ${weeksWithoutGames}`);
    } else if (isJa) {
        parts.push(`<strong>過去30日:</strong> ${last30Days}試合 | 試合なし週: ${weeksWithoutGames}`);
    } else {
        parts.push(`<strong>Last 30 days:</strong> ${last30Days} games | Weeks without games: ${weeksWithoutGames}`);
    }

    // Consistency insight
    if (weeksWithoutGames === 0) {
        if (isPt) parts.push(`<em>Excelente consistência! Você jogou toda semana.</em>`);
        else if (isJa) parts.push(`<em>素晴らしい一貫性！毎週プレーしています。</em>`);
        else parts.push(`<em>Excellent consistency! You played every week.</em>`);
    } else if (weeksWithoutGames > totalWeeks / 2) {
        if (isPt) parts.push(`<em>Dica: Tente jogar com mais regularidade para manter o ritmo.</em>`);
        else if (isJa) parts.push(`<em>ヒント: リズムを維持するために定期的にプレーを。</em>`);
        else parts.push(`<em>Tip: Try playing more regularly to maintain rhythm.</em>`);
    }

    el.innerHTML = parts.join('<br>');
}

// =============================================================================
// COMPREHENSIVE ANALYSIS
// =============================================================================

function generateComprehensiveAnalysis() {
    const el = document.getElementById('comprehensiveAnalysis');
    if (!el) return;

    if (filteredGames.length < 10) {
        el.innerHTML = `<p class="no-data">${t('analysis.needMoreGames', 'Registre mais partidas para ver uma análise detalhada.')}</p>`;
        return;
    }

    const analysis = analyzePerformance();
    let html = '';

    // Strengths
    if (analysis.strengths.length > 0) {
        html += `
            <div class="analysis-card strength">
                <h4>💪 ${t('analysis.strengths', 'Pontos Fortes')}</h4>
                <ul>
                    ${analysis.strengths.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Weaknesses
    if (analysis.weaknesses.length > 0) {
        html += `
            <div class="analysis-card weakness">
                <h4>⚠️ ${t('analysis.weaknesses', 'Pontos a Melhorar')}</h4>
                <ul>
                    ${analysis.weaknesses.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Tips
    if (analysis.tips.length > 0) {
        html += `
            <div class="analysis-card tip">
                <h4>💡 ${t('analysis.tips', 'Dicas para Melhorar')}</h4>
                <ul>
                    ${analysis.tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Summary stats
    html += `
        <div class="analysis-card">
            <h4>📊 ${t('analysis.summary', 'Resumo')}</h4>
            <p>${analysis.summary}</p>
        </div>
    `;

    el.innerHTML = html;
}

function analyzePerformance() {
    const strengths = [];
    const weaknesses = [];
    const tips = [];

    const totalGames = filteredGames.length;
    const wins = filteredGames.filter(g => g.result === 'win').length;
    const losses = totalGames - wins;
    const winRate = Math.round((wins / totalGames) * 100);

    // Language detection for text
    const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'pt-BR';
    const isPt = lang.startsWith('pt');
    const isJa = lang.startsWith('ja');

    // Singles vs Doubles analysis
    const singlesGames = filteredGames.filter(g => g.game_type === 'singles');
    const doublesGames = filteredGames.filter(g => g.game_type === 'doubles');
    const singlesWins = singlesGames.filter(g => g.result === 'win').length;
    const doublesWins = doublesGames.filter(g => g.result === 'win').length;
    const singlesWinRate = singlesGames.length > 3 ? Math.round((singlesWins / singlesGames.length) * 100) : null;
    const doublesWinRate = doublesGames.length > 3 ? Math.round((doublesWins / doublesGames.length) * 100) : null;

    if (singlesWinRate !== null && doublesWinRate !== null) {
        const diff = singlesWinRate - doublesWinRate;
        if (diff > 15) {
            if (isPt) {
                strengths.push(`Ótimo desempenho em <strong>simples</strong>: ${singlesWinRate}% (${singlesWins}V/${singlesGames.length - singlesWins}D em ${singlesGames.length} jogos)`);
                weaknesses.push(`Desempenho inferior em <strong>duplas</strong>: ${doublesWinRate}% (${doublesWins}V/${doublesGames.length - doublesWins}D) - ${Math.abs(diff)}% abaixo de simples`);
                tips.push(`Pratique comunicação e posicionamento em duplas - sua taxa de ${doublesWinRate}% pode melhorar com treino específico`);
            } else if (isJa) {
                strengths.push(`<strong>シングルス</strong>で優秀: ${singlesWinRate}% (${singlesWins}勝/${singlesGames.length - singlesWins}敗、${singlesGames.length}試合)`);
                weaknesses.push(`<strong>ダブルス</strong>は弱い: ${doublesWinRate}% (${doublesWins}勝/${doublesGames.length - doublesWins}敗) - シングルスより${Math.abs(diff)}%低い`);
                tips.push(`ダブルスのコミュニケーションとポジショニングを練習 - ${doublesWinRate}%の勝率は改善可能`);
            } else {
                strengths.push(`Great at <strong>singles</strong>: ${singlesWinRate}% (${singlesWins}W/${singlesGames.length - singlesWins}L in ${singlesGames.length} games)`);
                weaknesses.push(`Lower performance in <strong>doubles</strong>: ${doublesWinRate}% (${doublesWins}W/${doublesGames.length - doublesWins}L) - ${Math.abs(diff)}% below singles`);
                tips.push(`Practice communication and positioning in doubles - your ${doublesWinRate}% rate can improve with specific training`);
            }
        } else if (diff < -15) {
            if (isPt) {
                strengths.push(`Ótimo desempenho em <strong>duplas</strong>: ${doublesWinRate}% (${doublesWins}V/${doublesGames.length - doublesWins}D em ${doublesGames.length} jogos)`);
                weaknesses.push(`Desempenho inferior em <strong>simples</strong>: ${singlesWinRate}% (${singlesWins}V/${singlesGames.length - singlesWins}D) - ${Math.abs(diff)}% abaixo de duplas`);
                tips.push(`Trabalhe condicionamento físico e cobertura de quadra - sua taxa de ${singlesWinRate}% em simples pode melhorar`);
            } else if (isJa) {
                strengths.push(`<strong>ダブルス</strong>で優秀: ${doublesWinRate}% (${doublesWins}勝/${doublesGames.length - doublesWins}敗、${doublesGames.length}試合)`);
                weaknesses.push(`<strong>シングルス</strong>は弱い: ${singlesWinRate}% (${singlesWins}勝/${singlesGames.length - singlesWins}敗) - ダブルスより${Math.abs(diff)}%低い`);
                tips.push(`体力とコートカバーを改善 - シングルスの${singlesWinRate}%は改善可能`);
            } else {
                strengths.push(`Great at <strong>doubles</strong>: ${doublesWinRate}% (${doublesWins}W/${doublesGames.length - doublesWins}L in ${doublesGames.length} games)`);
                weaknesses.push(`Lower performance in <strong>singles</strong>: ${singlesWinRate}% (${singlesWins}W/${singlesGames.length - singlesWins}L) - ${Math.abs(diff)}% below doubles`);
                tips.push(`Work on physical conditioning and court coverage - your ${singlesWinRate}% singles rate can improve`);
            }
        }
    }

    // Day of week analysis
    const dayStats = Array(7).fill(null).map(() => ({ total: 0, wins: 0 }));
    filteredGames.forEach(game => {
        const date = new Date(game.game_date + 'T12:00:00');
        const dayOfWeek = date.getDay();
        dayStats[dayOfWeek].total++;
        if (game.result === 'win') dayStats[dayOfWeek].wins++;
    });

    const dayNamesPt = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesJa = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
    const dayNames = isPt ? dayNamesPt : (isJa ? dayNamesJa : dayNamesEn);

    let bestDay = -1, worstDay = -1;
    let bestRate = -1, worstRate = 101;
    let bestDayStats = null, worstDayStats = null;
    dayStats.forEach((stat, day) => {
        if (stat.total >= 5) {
            const rate = (stat.wins / stat.total) * 100;
            if (rate > bestRate) { bestRate = rate; bestDay = day; bestDayStats = stat; }
            if (rate < worstRate) { worstRate = rate; worstDay = day; worstDayStats = stat; }
        }
    });

    if (bestDay >= 0 && bestRate >= 70) {
        if (isPt) {
            strengths.push(`Melhor dia: <strong>${dayNames[bestDay]}</strong> com ${Math.round(bestRate)}% (${bestDayStats.wins}V/${bestDayStats.total - bestDayStats.wins}D em ${bestDayStats.total} jogos)`);
        } else if (isJa) {
            strengths.push(`ベストの日: <strong>${dayNames[bestDay]}</strong> ${Math.round(bestRate)}% (${bestDayStats.wins}勝/${bestDayStats.total - bestDayStats.wins}敗、${bestDayStats.total}試合)`);
        } else {
            strengths.push(`Best day: <strong>${dayNames[bestDay]}</strong> at ${Math.round(bestRate)}% (${bestDayStats.wins}W/${bestDayStats.total - bestDayStats.wins}L in ${bestDayStats.total} games)`);
        }
    }
    if (worstDay >= 0 && worstRate < 50 && bestDay !== worstDay) {
        if (isPt) {
            weaknesses.push(`Pior dia: <strong>${dayNames[worstDay]}</strong> com ${Math.round(worstRate)}% (${worstDayStats.wins}V/${worstDayStats.total - worstDayStats.wins}D em ${worstDayStats.total} jogos)`);
            tips.push(`Considere ajustar preparação para jogos às ${dayNames[worstDay]}s - ${Math.round(bestRate - worstRate)}% abaixo do seu melhor dia`);
        } else if (isJa) {
            weaknesses.push(`最悪の日: <strong>${dayNames[worstDay]}</strong> ${Math.round(worstRate)}% (${worstDayStats.wins}勝/${worstDayStats.total - worstDayStats.wins}敗、${worstDayStats.total}試合)`);
            tips.push(`${dayNames[worstDay]}の試合の準備を調整 - ベストの日より${Math.round(bestRate - worstRate)}%低い`);
        } else {
            weaknesses.push(`Worst day: <strong>${dayNames[worstDay]}</strong> at ${Math.round(worstRate)}% (${worstDayStats.wins}W/${worstDayStats.total - worstDayStats.wins}L in ${worstDayStats.total} games)`);
            tips.push(`Consider adjusting preparation for ${dayNames[worstDay]} games - ${Math.round(bestRate - worstRate)}% below your best day`);
        }
    }

    // Trend analysis
    const sortedGames = [...filteredGames].sort((a, b) => a.game_date.localeCompare(b.game_date));
    const recentGames = sortedGames.slice(-20);
    const olderGames = sortedGames.slice(0, -20);

    if (recentGames.length >= 10 && olderGames.length >= 10) {
        const recentWins = recentGames.filter(g => g.result === 'win').length;
        const olderWins = olderGames.filter(g => g.result === 'win').length;
        const recentWinRate = Math.round((recentWins / recentGames.length) * 100);
        const olderWinRate = Math.round((olderWins / olderGames.length) * 100);
        const diff = recentWinRate - olderWinRate;

        if (diff > 10) {
            if (isPt) {
                strengths.push(`📈 <strong>Em melhora!</strong> Últimos 20 jogos: ${recentWinRate}% (${recentWins}V) vs anteriores: ${olderWinRate}% (+${diff}%)`);
            } else if (isJa) {
                strengths.push(`📈 <strong>上昇中！</strong> 最近20試合: ${recentWinRate}% (${recentWins}勝) vs 以前: ${olderWinRate}% (+${diff}%)`);
            } else {
                strengths.push(`📈 <strong>Improving!</strong> Last 20 games: ${recentWinRate}% (${recentWins}W) vs earlier: ${olderWinRate}% (+${diff}%)`);
            }
        } else if (diff < -10) {
            if (isPt) {
                weaknesses.push(`📉 <strong>Em queda!</strong> Últimos 20 jogos: ${recentWinRate}% (${recentWins}V) vs anteriores: ${olderWinRate}% (${diff}%)`);
                tips.push(`Revise fundamentos e considere descanso - queda de ${Math.abs(diff)}% nos últimos jogos`);
            } else if (isJa) {
                weaknesses.push(`📉 <strong>下降中！</strong> 最近20試合: ${recentWinRate}% (${recentWins}勝) vs 以前: ${olderWinRate}% (${diff}%)`);
                tips.push(`基本を見直して休息も検討 - 最近${Math.abs(diff)}%低下`);
            } else {
                weaknesses.push(`📉 <strong>Declining!</strong> Last 20 games: ${recentWinRate}% (${recentWins}W) vs earlier: ${olderWinRate}% (${diff}%)`);
                tips.push(`Review fundamentals and consider rest - ${Math.abs(diff)}% drop in recent games`);
            }
        }
    }

    // Streak analysis with more detail
    let currentStreak = 0;
    let tempStreak = 0;
    let lastResult = null;
    let maxWinStreak = 0, maxLossStreak = 0;
    let maxWinStreakEndDate = null, maxLossStreakEndDate = null;

    sortedGames.forEach(game => {
        if (game.result === lastResult) {
            tempStreak++;
        } else {
            tempStreak = 1;
        }
        lastResult = game.result;
        currentStreak = game.result === 'win' ? tempStreak : -tempStreak;

        if (game.result === 'win' && tempStreak > maxWinStreak) {
            maxWinStreak = tempStreak;
            maxWinStreakEndDate = game.game_date;
        } else if (game.result === 'loss' && tempStreak > maxLossStreak) {
            maxLossStreak = tempStreak;
            maxLossStreakEndDate = game.game_date;
        }
    });

    const formatStreakDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    };

    if (currentStreak >= 3) {
        if (isPt) {
            strengths.push(`🔥 <strong>Sequência atual: ${currentStreak} vitórias seguidas!</strong> Recorde: ${maxWinStreak}V (até ${formatStreakDate(maxWinStreakEndDate)})`);
        } else if (isJa) {
            strengths.push(`🔥 <strong>現在${currentStreak}連勝中！</strong> 記録: ${maxWinStreak}連勝 (${formatStreakDate(maxWinStreakEndDate)}まで)`);
        } else {
            strengths.push(`🔥 <strong>Current streak: ${currentStreak} wins in a row!</strong> Record: ${maxWinStreak}W (until ${formatStreakDate(maxWinStreakEndDate)})`);
        }
    } else if (currentStreak <= -3) {
        if (isPt) {
            weaknesses.push(`❄️ <strong>Sequência atual: ${Math.abs(currentStreak)} derrotas seguidas</strong> | Pior fase: ${maxLossStreak}D (até ${formatStreakDate(maxLossStreakEndDate)})`);
            tips.push(`Foque em jogos contra adversários mais acessíveis para quebrar a sequência de ${Math.abs(currentStreak)} derrotas`);
        } else if (isJa) {
            weaknesses.push(`❄️ <strong>現在${Math.abs(currentStreak)}連敗中</strong> | 最悪: ${maxLossStreak}連敗 (${formatStreakDate(maxLossStreakEndDate)}まで)`);
            tips.push(`連敗(${Math.abs(currentStreak)}敗)を止めるため、相性の良い相手と対戦を`);
        } else {
            weaknesses.push(`❄️ <strong>Current streak: ${Math.abs(currentStreak)} losses in a row</strong> | Worst: ${maxLossStreak}L (until ${formatStreakDate(maxLossStreakEndDate)})`);
            tips.push(`Focus on games against more accessible opponents to break the ${Math.abs(currentStreak)}-loss streak`);
        }
    }

    // General win rate tips with context
    if (winRate < 40) {
        if (isPt) {
            tips.push(`Com ${winRate}% de vitórias (${wins}V/${losses}D), foque em fundamentos: saque, recepção e posicionamento`);
            tips.push(`Analise seus ${losses} derrotas para identificar padrões de erro recorrentes`);
        } else if (isJa) {
            tips.push(`勝率${winRate}% (${wins}勝/${losses}敗)なので、基本に集中: サーブ、レシーブ、ポジショニング`);
            tips.push(`${losses}敗を分析して繰り返しのミスパターンを特定`);
        } else {
            tips.push(`With ${winRate}% win rate (${wins}W/${losses}L), focus on fundamentals: serve, reception and positioning`);
            tips.push(`Analyze your ${losses} losses to identify recurring error patterns`);
        }
    } else if (winRate >= 70) {
        if (isPt) {
            tips.push(`Excelente ${winRate}% de vitórias! Busque adversários mais desafiadores para continuar evoluindo`);
        } else if (isJa) {
            tips.push(`素晴らしい${winRate}%の勝率！さらに向上するため、より強い相手を探して`);
        } else {
            tips.push(`Excellent ${winRate}% win rate! Seek more challenging opponents to keep improving`);
        }
    }

    // Frequency analysis
    const firstDate = new Date(sortedGames[0].game_date);
    const lastDate = new Date(sortedGames[sortedGames.length - 1].game_date);
    const weeks = Math.max(1, Math.ceil((lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000)));
    const gamesPerWeek = (filteredGames.length / weeks).toFixed(1);

    if (parseFloat(gamesPerWeek) < 1) {
        if (isPt) {
            tips.push(`Frequência baixa: ${gamesPerWeek} jogos/semana. Jogue mais para manter ritmo (${totalGames} jogos em ${weeks} semanas)`);
        } else if (isJa) {
            tips.push(`頻度が低い: ${gamesPerWeek}試合/週。リズムを維持するためにもっとプレー (${weeks}週間で${totalGames}試合)`);
        } else {
            tips.push(`Low frequency: ${gamesPerWeek} games/week. Play more to maintain rhythm (${totalGames} games in ${weeks} weeks)`);
        }
    } else if (parseFloat(gamesPerWeek) > 5) {
        if (isPt) {
            tips.push(`Alta frequência: ${gamesPerWeek} jogos/semana. Atenção ao descanso para evitar fadiga e lesões`);
        } else if (isJa) {
            tips.push(`高頻度: ${gamesPerWeek}試合/週。疲労とケガを避けるため休息に注意`);
        } else {
            tips.push(`High frequency: ${gamesPerWeek} games/week. Pay attention to rest to avoid fatigue and injuries`);
        }
    }

    // Build detailed summary
    let summary = '';
    if (isPt) {
        summary = `<strong>${totalGames}</strong> partidas analisadas | <strong>${winRate}%</strong> de vitórias (${wins}V/${losses}D)`;
        if (singlesGames.length > 0 && doublesGames.length > 0) {
            summary += ` | ${singlesGames.length} simples (${singlesWinRate || '--'}%) e ${doublesGames.length} duplas (${doublesWinRate || '--'}%)`;
        }
    } else if (isJa) {
        summary = `<strong>${totalGames}</strong>試合分析 | 勝率<strong>${winRate}%</strong> (${wins}勝/${losses}敗)`;
        if (singlesGames.length > 0 && doublesGames.length > 0) {
            summary += ` | シングルス${singlesGames.length}試合 (${singlesWinRate || '--'}%)、ダブルス${doublesGames.length}試合 (${doublesWinRate || '--'}%)`;
        }
    } else {
        summary = `<strong>${totalGames}</strong> games analyzed | <strong>${winRate}%</strong> win rate (${wins}W/${losses}L)`;
        if (singlesGames.length > 0 && doublesGames.length > 0) {
            summary += ` | ${singlesGames.length} singles (${singlesWinRate || '--'}%) and ${doublesGames.length} doubles (${doublesWinRate || '--'}%)`;
        }
    }

    return { strengths, weaknesses, tips, summary };
}

// =============================================================================
// CHART EXPAND FUNCTIONALITY
// =============================================================================

let expandedChart = null;
let currentExpandedChartData = null;

// Initialize click handlers for chart expansion
function initChartExpansion() {
    // Overview tab charts
    const chartConfigs = [
        { canvasId: 'typeChart', chartKey: 'type', titleKey: 'analytics.gameTypes', titleFallback: 'Simples vs Duplas' },
        { canvasId: 'evolutionChart', chartKey: 'evolution', titleKey: 'analytics.overallEvolution', titleFallback: 'Evolução Geral' },
        { canvasId: 'streakChart', chartKey: 'streak', titleKey: 'analytics.streakHistory', titleFallback: 'Histórico de Sequências' },
        { canvasId: 'dayOfWeekChart', chartKey: 'dayOfWeek', titleKey: 'analytics.gamesByDayOfWeek', titleFallback: 'Jogos por Dia da Semana' },
        { canvasId: 'setBalanceChart', chartKey: 'setBalance', titleKey: 'analytics.setsPerMonth', titleFallback: 'Sets por Mês' },
        { canvasId: 'frequencyChart', chartKey: 'frequency', titleKey: 'analytics.gamesFrequency', titleFallback: 'Frequência de Jogos' }
    ];

    chartConfigs.forEach(config => {
        const canvas = document.getElementById(config.canvasId);
        if (canvas) {
            const wrapper = canvas.closest('.chart-wrapper');
            if (wrapper) {
                wrapper.addEventListener('click', () => {
                    expandChart(config.chartKey, config.titleKey, config.titleFallback);
                });
            }
        }
    });
}

function expandChart(chartKey, titleKey, titleFallback) {
    const sourceChart = charts[chartKey];
    if (!sourceChart) return;

    const modal = document.getElementById('expandedChartModal');
    const titleEl = document.getElementById('expandedChartTitle');
    const canvas = document.getElementById('expandedChart');

    if (!modal || !canvas) return;

    // Set title
    titleEl.textContent = t(titleKey, titleFallback);

    // Store config for recreation
    currentExpandedChartData = {
        type: sourceChart.config.type,
        data: JSON.parse(JSON.stringify(sourceChart.config.data)),
        options: JSON.parse(JSON.stringify(sourceChart.config.options || {}))
    };

    // Destroy existing expanded chart if any
    if (expandedChart) {
        expandedChart.destroy();
        expandedChart = null;
    }

    // Show modal first
    modal.style.display = 'flex';

    // Create new chart with a slight delay to allow modal to render
    setTimeout(() => {
        const ctx = canvas.getContext('2d');

        // Adjust options for larger display
        const options = currentExpandedChartData.options;
        options.maintainAspectRatio = false;
        options.responsive = true;

        // Increase font sizes for better readability
        if (!options.plugins) options.plugins = {};
        if (!options.plugins.legend) options.plugins.legend = {};
        options.plugins.legend.labels = options.plugins.legend.labels || {};
        options.plugins.legend.labels.font = { size: 14 };

        expandedChart = new Chart(ctx, {
            type: currentExpandedChartData.type,
            data: currentExpandedChartData.data,
            options: options
        });
    }, 100);
}

function closeExpandedChart() {
    const modal = document.getElementById('expandedChartModal');
    if (modal) {
        modal.style.display = 'none';
    }

    if (expandedChart) {
        expandedChart.destroy();
        expandedChart = null;
    }
    currentExpandedChartData = null;
}

// Close expanded chart modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('expandedChartModal');
    if (modal && e.target === modal) {
        closeExpandedChart();
    }
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('expandedChartModal');
        if (modal && modal.style.display === 'flex') {
            closeExpandedChart();
        }
    }
});

// Export function for global access
window.closeExpandedChart = closeExpandedChart;
