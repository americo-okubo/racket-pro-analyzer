/**
 * Racket Pro Analyzer - Main Application JavaScript
 */

const API_URL = window.location.origin;
let currentToken = null;
let currentUser = null;

// PWA Install prompt
let deferredPrompt = null;

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

    // Register Service Worker
    registerServiceWorker();

    // Setup PWA install prompt
    setupInstallPrompt();
});

// =============================================================================
// PWA / SERVICE WORKER
// =============================================================================

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/js/service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }
}

function setupInstallPrompt() {
    // Check if already in standalone mode
    if (isInStandaloneMode()) {
        console.log('App is running in standalone mode');
        return;
    }

    // Check if banner was dismissed recently (7 days)
    const dismissed = localStorage.getItem('installBannerDismissed');
    if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < sevenDays) {
            return;
        }
    }

    // iOS: Show banner with Safari instructions
    if (isIOS()) {
        showInstallBanner(true);
        return;
    }

    // Android/Desktop: Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Store the event for later use
        deferredPrompt = e;
        // Show the install banner
        showInstallBanner(false);
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        hideInstallBanner();
        deferredPrompt = null;
    });
}

function showInstallBanner(forIOS = false) {
    const banner = document.getElementById('installBanner');
    const iosBanner = document.getElementById('installBannerIOS');

    if (forIOS && iosBanner) {
        iosBanner.style.display = 'flex';
    } else if (banner) {
        banner.style.display = 'flex';
    }

    // Apply translations if i18n is available
    if (window.i18n && window.i18n.applyTranslations) {
        window.i18n.applyTranslations();
    }
}

function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    const iosBanner = document.getElementById('installBannerIOS');
    if (banner) {
        banner.style.display = 'none';
    }
    if (iosBanner) {
        iosBanner.style.display = 'none';
    }
}

function dismissInstallBanner() {
    hideInstallBanner();
    // Store dismissal in localStorage to not show again for 7 days
    localStorage.setItem('installBannerDismissed', Date.now().toString());
}

async function installApp() {
    if (!deferredPrompt) {
        console.log('Install prompt not available');
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('User install choice:', outcome);

    // Clear the deferred prompt
    deferredPrompt = null;
    hideInstallBanner();
}

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
