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

const GOOGLE_CLIENT_ID = '123444066656-tffnuqtcqkv0jsocvu5o1up0e0g0r2e4.apps.googleusercontent.com';
const DEV_MODE = !GOOGLE_CLIENT_ID || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function loginWithGoogle() {
    // If in dev mode and no Google Client ID, use dev login
    if (DEV_MODE && !GOOGLE_CLIENT_ID) {
        loginWithDev();
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse
    });
    google.accounts.id.prompt();
}

async function loginWithDev() {
    try {
        const res = await fetch(`${API_URL}/api/auth/dev`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'dev@test.com',
                name: 'Dev User'
            })
        });

        if (!res.ok) {
            throw new Error('Falha na autenticação de desenvolvimento');
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        currentToken = data.token;
        currentUser = data.user;

        showLoggedInState();
        await loadOverallStatistics();
    } catch (error) {
        console.error('Erro no login de dev:', error);
        alert('Erro ao fazer login de desenvolvimento. Verifique se o servidor está rodando.');
    }
}

async function handleGoogleResponse(response) {
    try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        if (!res.ok) {
            throw new Error('Falha na autenticação');
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        currentToken = data.token;
        currentUser = data.user;

        showLoggedInState();
        await loadOverallStatistics();
    } catch (error) {
        console.error('Erro no login:', error);
        alert('Erro ao fazer login. Tente novamente.');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentToken = null;
    currentUser = null;
    window.location.href = '/';
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
