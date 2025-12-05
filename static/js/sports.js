/**
 * Sports Configuration for Racket Pro Analyzer
 */

const SPORTS_CONFIG = {
    table_tennis: {
        key: "table_tennis",
        name: "Tênis de Mesa",
        nameEn: "Table Tennis",
        nameJa: "卓球",
        icon: "/static/images/sports/table_tennis.png",
        scoreType: "sets",
        maxSets: 7,
        pointsToWin: 11,
        gameTypes: ["singles", "doubles"],
        color: "#D35400"
    },
    badminton: {
        key: "badminton",
        name: "Badminton",
        nameEn: "Badminton",
        nameJa: "バドミントン",
        icon: "/static/images/sports/badminton.png",
        scoreType: "sets",
        maxSets: 3,
        pointsToWin: 21,
        gameTypes: ["singles", "doubles"],
        color: "#27AE60"
    },
    tennis: {
        key: "tennis",
        name: "Tênis",
        nameEn: "Tennis",
        nameJa: "テニス",
        icon: "/static/images/sports/tennis.png",
        scoreType: "tennis",
        maxSets: 5,
        gameTypes: ["singles", "doubles"],
        color: "#E74C3C"
    },
    squash: {
        key: "squash",
        name: "Squash",
        nameEn: "Squash",
        nameJa: "スカッシュ",
        icon: "/static/images/sports/squash.png",
        scoreType: "sets",
        maxSets: 5,
        pointsToWin: 11,
        gameTypes: ["singles"],
        color: "#2C3E50"
    },
    padel: {
        key: "padel",
        name: "Padel",
        nameEn: "Padel",
        nameJa: "パデル",
        icon: "/static/images/sports/padel.png",
        scoreType: "tennis",
        maxSets: 3,
        gameTypes: ["doubles"],
        color: "#F39C12"
    },
    beach_tennis: {
        key: "beach_tennis",
        name: "Beach Tennis",
        nameEn: "Beach Tennis",
        nameJa: "ビーチテニス",
        icon: "/static/images/sports/beach_tennis.png",
        scoreType: "tennis",
        maxSets: 3,
        gameTypes: ["doubles"],
        color: "#E67E22"
    },
    pickleball: {
        key: "pickleball",
        name: "Pickleball",
        nameEn: "Pickleball",
        nameJa: "ピックルボール",
        icon: "/static/images/sports/pickleball.png",
        scoreType: "sets",
        maxSets: 3,
        pointsToWin: 11,
        gameTypes: ["singles", "doubles"],
        color: "#1ABC9C"
    }
};

/**
 * Get sport configuration by key
 */
function getSportConfig(sportKey) {
    return SPORTS_CONFIG[sportKey] || null;
}

/**
 * Get sport name based on current language
 */
function getSportName(sportKey) {
    const sport = SPORTS_CONFIG[sportKey];
    if (!sport) return sportKey;

    const lang = localStorage.getItem('language') || 'pt-BR';
    if (lang === 'en-US') return sport.nameEn;
    if (lang === 'ja-JP') return sport.nameJa;
    return sport.name;
}

/**
 * Check if sport supports singles
 */
function supportsSingles(sportKey) {
    const sport = SPORTS_CONFIG[sportKey];
    return sport ? sport.gameTypes.includes('singles') : false;
}

/**
 * Check if sport supports doubles
 */
function supportsDoubles(sportKey) {
    const sport = SPORTS_CONFIG[sportKey];
    return sport ? sport.gameTypes.includes('doubles') : false;
}

/**
 * Get all sports as array
 */
function getAllSports() {
    return Object.values(SPORTS_CONFIG);
}

/**
 * Get sport from URL parameter
 */
function getSportFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sport') || 'table_tennis';
}
