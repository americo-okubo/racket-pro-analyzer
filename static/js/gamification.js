/**
 * Racket Pro Analyzer - Gamification System
 * Handles achievements, streaks, and unlock notifications
 */

// =============================================================================
// TRANSLATION HELPERS
// =============================================================================

function getAchievementName(key) {
    if (window.i18n && window.i18n.get) {
        const translated = window.i18n.get(`achievements.names.${key}`);
        if (translated && translated !== `achievements.names.${key}`) {
            return translated;
        }
    }
    // Fallback to formatted key
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getAchievementDescription(key) {
    if (window.i18n && window.i18n.get) {
        const translated = window.i18n.get(`achievements.descriptions.${key}`);
        if (translated && translated !== `achievements.descriptions.${key}`) {
            return translated;
        }
    }
    return '';
}

function getRarityLabel(rarity) {
    if (window.i18n && window.i18n.get) {
        const translated = window.i18n.get(`achievements.rarity.${rarity}`);
        if (translated && translated !== `achievements.rarity.${rarity}`) {
            return translated;
        }
    }
    const labels = {
        'common': '⚪ Comum',
        'uncommon': '🟢 Incomum',
        'rare': '🔵 Raro',
        'epic': '🟣 Épico',
        'legendary': '🟠 Lendário',
        'mythic': '🔴 Mítico'
    };
    return labels[rarity] || rarity;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchAchievements() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/gamification/achievements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch achievements');

        const data = await response.json();
        return data.achievements || [];
    } catch (error) {
        console.error('Error fetching achievements:', error);
        return [];
    }
}

async function fetchStreak() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/gamification/streak', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch streak');

        const data = await response.json();
        return data.streak || { current_streak: 0, best_streak: 0 };
    } catch (error) {
        console.error('Error fetching streak:', error);
        return { current_streak: 0, best_streak: 0 };
    }
}

async function checkAchievements() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/gamification/check-achievements', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to check achievements');

        const data = await response.json();
        return {
            newlyUnlocked: data.newly_unlocked || [],
            streak: data.streak || { current_streak: 0, best_streak: 0 }
        };
    } catch (error) {
        console.error('Error checking achievements:', error);
        return { newlyUnlocked: [], streak: { current_streak: 0, best_streak: 0 } };
    }
}

// =============================================================================
// STREAK BADGE
// =============================================================================

function updateStreakBadge(streak) {
    const badge = document.getElementById('streakBadge');
    if (!badge) return;

    if (streak.current_streak > 0) {
        badge.innerHTML = `<span class="fire">🔥</span> ${streak.current_streak}`;
        badge.classList.remove('hidden');
        badge.classList.add('pulse');
        setTimeout(() => badge.classList.remove('pulse'), 600);
    } else {
        badge.classList.add('hidden');
    }
}

async function loadStreakBadge() {
    const streak = await fetchStreak();
    updateStreakBadge(streak);
}

// =============================================================================
// ACHIEVEMENT UNLOCK MODAL
// =============================================================================

function createConfetti(container) {
    const colors = ['#f5af19', '#f12711', '#667eea', '#4CAF50', '#ff6b6b', '#feca57'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(confetti);
    }
}

function showAchievementModal(achievement) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'achievement-modal-overlay';
    overlay.id = 'achievementModalOverlay';

    const congratsText = window.i18n?.get('achievements.congratulations') || '🎉 PARABÉNS! 🎉';
    const continueText = window.i18n?.get('achievements.continue') || 'Continuar';

    overlay.innerHTML = `
        <div class="achievement-modal">
            <div class="congrats">${congratsText}</div>
            <span class="icon">${achievement.icon}</span>
            <div class="name">${getAchievementName(achievement.name)}</div>
            <div class="description">${getAchievementDescription(achievement.name)}</div>
            <div class="rarity rarity-${achievement.rarity}">${getRarityLabel(achievement.rarity)}</div>
            <button class="btn-continue" onclick="closeAchievementModal()">${continueText}</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add confetti
    createConfetti(overlay.querySelector('.achievement-modal'));

    // Auto-close after 10 seconds
    setTimeout(() => {
        if (document.getElementById('achievementModalOverlay')) {
            closeAchievementModal();
        }
    }, 10000);
}

function closeAchievementModal() {
    const overlay = document.getElementById('achievementModalOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => overlay.remove(), 300);
    }
}

// Show multiple achievements sequentially
async function showAchievementModals(achievements) {
    for (const achievement of achievements) {
        showAchievementModal(achievement);
        await new Promise(resolve => {
            const checkClosed = setInterval(() => {
                if (!document.getElementById('achievementModalOverlay')) {
                    clearInterval(checkClosed);
                    resolve();
                }
            }, 100);
        });
        // Small delay between modals
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

// =============================================================================
// ACHIEVEMENTS MODAL / SECTION
// =============================================================================

function renderAchievements(container, achievements) {
    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);

    const unlockedTitle = window.i18n?.get('achievements.title') || '🏆 Conquistas Desbloqueadas';
    const lockedTitle = window.i18n?.get('achievements.nextTitle') || '🔒 Próximas Conquistas';
    const keepPlayingText = window.i18n?.get('achievements.keepPlaying') || 'Continue jogando para desbloquear!';

    let html = '';

    // Unlocked achievements
    if (unlocked.length > 0) {
        html += `
            <div class="achievements-section-header">
                <div class="achievements-section-title">${unlockedTitle}</div>
                <div class="achievements-progress">${unlocked.length}/${achievements.length}</div>
            </div>
            <div class="achievements-grid">
        `;

        for (const achievement of unlocked) {
            const unlockedDate = achievement.unlocked_at
                ? new Date(achievement.unlocked_at).toLocaleDateString()
                : '';

            html += `
                <div class="achievement-card unlocked">
                    <span class="icon">${achievement.icon}</span>
                    <div class="name">${getAchievementName(achievement.name)}</div>
                    <div class="description">${getAchievementDescription(achievement.name)}</div>
                    <div class="rarity rarity-${achievement.rarity}">${getRarityLabel(achievement.rarity)}</div>
                    ${unlockedDate ? `<div class="unlocked-date">✓ ${unlockedDate}</div>` : ''}
                </div>
            `;
        }

        html += '</div>';
    }

    // Locked achievements
    if (locked.length > 0) {
        html += `
            <div class="locked-achievements-banner">
                <span class="count">+${locked.length}</span> ${keepPlayingText}
            </div>
            <div class="achievements-section-header" style="margin-top: 24px;">
                <div class="achievements-section-title">${lockedTitle}</div>
            </div>
            <div class="achievements-grid">
        `;

        for (const achievement of locked) {
            html += `
                <div class="achievement-card locked">
                    <span class="icon">${achievement.icon}</span>
                    <div class="name">${getAchievementName(achievement.name)}</div>
                    <div class="description">${getAchievementDescription(achievement.name)}</div>
                    <div class="rarity rarity-${achievement.rarity}">${getRarityLabel(achievement.rarity)}</div>
                </div>
            `;
        }

        html += '</div>';
    }

    if (achievements.length === 0) {
        html = `<p style="text-align: center; color: #666;">Nenhuma conquista disponível.</p>`;
    }

    container.innerHTML = html;

    // Update button count
    updateAchievementsButtonCount(unlocked.length);
}

function updateAchievementsButtonCount(count) {
    const countEl = document.getElementById('achievementsCount');
    if (countEl) {
        countEl.textContent = `(${count})`;
    }
}

async function loadAchievementsSection() {
    const container = document.getElementById('achievementsContainer');
    if (!container) return;

    // Wait for i18n to be ready
    let attempts = 0;
    while ((!window.i18n || !window.i18n.ready) && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    const achievements = await fetchAchievements();
    renderAchievements(container, achievements);
}

function openAchievementsModal() {
    const modal = document.getElementById('achievementsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadAchievementsSection();
    }
}

function closeAchievementsModal() {
    const modal = document.getElementById('achievementsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// =============================================================================
// CHECK ACHIEVEMENTS AFTER GAME
// =============================================================================

async function checkAchievementsAfterGame() {
    const result = await checkAchievements();

    // Update streak badge
    updateStreakBadge(result.streak);

    // Show unlock modals for new achievements
    if (result.newlyUnlocked.length > 0) {
        await showAchievementModals(result.newlyUnlocked);
        // Reload achievements section if modal is open
        loadAchievementsSection();
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initGamification() {
    // Load streak badge
    await loadStreakBadge();

    // Check for any unlocked achievements (for historical games)
    const result = await checkAchievements();
    updateStreakBadge(result.streak);

    // Show any newly unlocked achievements
    if (result.newlyUnlocked.length > 0) {
        await showAchievementModals(result.newlyUnlocked);
    }

    // Load achievements count for button
    const achievements = await fetchAchievements();
    const unlockedCount = achievements.filter(a => a.unlocked).length;
    updateAchievementsButtonCount(unlockedCount);
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if user is logged in
    if (localStorage.getItem('token')) {
        // Delay init slightly to ensure other scripts are loaded
        setTimeout(initGamification, 500);
    }
});

// Export functions for external use
window.gamification = {
    checkAchievementsAfterGame,
    loadAchievementsSection,
    openAchievementsModal,
    closeAchievementsModal,
    loadStreakBadge
};
