/**
 * Racket Pro Analyzer - Internationalization (i18n)
 */

window.i18n = {
    currentLanguage: 'pt-BR',
    translations: {},

    async init() {
        this.currentLanguage = localStorage.getItem('language') || 'pt-BR';
        await this.loadTranslations(this.currentLanguage);
        this.applyTranslations();
        this.updateLanguageFlags();
    },

    async loadTranslations(lang) {
        try {
            const response = await fetch(`/static/locales/${lang}.json`);
            if (response.ok) {
                this.translations = await response.json();
            } else {
                console.warn(`Translation file not found for ${lang}, falling back to pt-BR`);
                if (lang !== 'pt-BR') {
                    await this.loadTranslations('pt-BR');
                }
            }
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    },

    async setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('language', lang);
        await this.loadTranslations(lang);
        this.applyTranslations();
        this.updateLanguageFlags();

        // Dispatch custom event for language change
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    },

    getCurrentLanguage() {
        return this.currentLanguage;
    },

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.get(key);
            if (translation) {
                element.textContent = translation;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.get(key);
            if (translation) {
                element.placeholder = translation;
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.get(key);
            if (translation) {
                element.title = translation;
            }
        });
    },

    get(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return null;
            }
        }

        return value;
    },

    updateLanguageFlags() {
        document.querySelectorAll('.language-flag').forEach(flag => {
            flag.classList.remove('active');
            if (flag.dataset.lang === this.currentLanguage) {
                flag.classList.add('active');
            }
        });
    }
};

// Global function for language change
function changeLanguage(lang) {
    window.i18n.setLanguage(lang);
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.init();
});
