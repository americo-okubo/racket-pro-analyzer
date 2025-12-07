/**
 * Racket Pro Analyzer - Main Application JavaScript
 */

const API_URL = window.location.origin;
let currentToken = null;
let currentUser = null;

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentToken = localStorage.getItem('token');
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');

    if (currentToken && currentUser) {
        showLoggedInState();
        await loadOverallStatistics();
    } else {
        showLoggedOutState();
    }

    // Initialize i18n
    if (window.i18n) {
        window.i18n.init();
    }
});

// =============================================================================
// UI STATE
// =============================================================================

function showLoggedInState() {
    const welcomeSection = document.getElementById('welcomeSection');
    const sportSelection = document.getElementById('sportSelection');
    const overallStats = document.getElementById('overallStats');
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');

    if (welcomeSection) welcomeSection.style.display = 'none';
    if (sportSelection) sportSelection.style.display = 'block';
    if (overallStats) overallStats.style.display = 'block';
    if (userInfo) userInfo.style.display = 'flex';
    if (userEmail && currentUser) userEmail.textContent = currentUser.email;
}

function showLoggedOutState() {
    const welcomeSection = document.getElementById('welcomeSection');
    const sportSelection = document.getElementById('sportSelection');
    const overallStats = document.getElementById('overallStats');
    const userInfo = document.getElementById('userInfo');

    if (welcomeSection) welcomeSection.style.display = 'block';
    if (sportSelection) sportSelection.style.display = 'none';
    if (overallStats) overallStats.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentToken = null;
    currentUser = null;
    window.location.href = '/login.html';
}

function goToLogin() {
    window.location.href = '/login.html';
}

// =============================================================================
// API HELPERS
// =============================================================================

async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error('Sessão expirada');
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro na requisição');
    }

    return response.json();
}

// =============================================================================
// STATISTICS
// =============================================================================

async function loadOverallStatistics() {
    try {
        const stats = await apiRequest('/api/statistics');

        const totalGames = document.getElementById('totalGames');
        const totalWins = document.getElementById('totalWins');
        const winRate = document.getElementById('winRate');
        const sportsCount = document.getElementById('sportsCount');

        if (totalGames) totalGames.textContent = stats.total_games || 0;
        if (totalWins) totalWins.textContent = stats.wins || 0;
        if (winRate) winRate.textContent = `${stats.win_rate || 0}%`;
        if (sportsCount) sportsCount.textContent = stats.sports_played?.length || 0;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// =============================================================================
// LANGUAGE
// =============================================================================

function changeLanguage(lang) {
    localStorage.setItem('language', lang);
    if (window.i18n) {
        window.i18n.setLanguage(lang);
    }

    // Update active flag
    document.querySelectorAll('.language-flag').forEach(flag => {
        flag.classList.remove('active');
        if (flag.dataset.lang === lang) {
            flag.classList.add('active');
        }
    });
}

// Initialize language flags
document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('language') || 'pt-BR';
    document.querySelectorAll('.language-flag').forEach(flag => {
        if (flag.dataset.lang === currentLang) {
            flag.classList.add('active');
        }
    });
});
