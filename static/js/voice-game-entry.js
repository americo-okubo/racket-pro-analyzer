/**
 * Voice Game Entry Module for Racket Pro Analyzer
 * Guided voice input for registering new games
 * Supports: pt-BR, en-US, ja-JP
 * Supports: Multiple sports, Singles and Doubles
 */

// Voice Game Entry State
const voiceGameEntry = {
    isActive: false,
    currentStep: 0,
    recognition: null,
    listeningTimeout: null,
    gameData: {
        game_date: null,
        game_type: 'singles',
        opponent_id: null,
        opponent_name: null,
        opponent2_id: null,
        opponent2_name: null,
        partner_id: null,
        partner_name: null,
        result: null,
        score: null,
        detailed_score: null,
        location: null,
        notes: null
    },
    detailedScoreSets: [], // Temporary storage for set scores during voice entry
    currentDetailedSet: 0, // Track which set we're recording
    players: [], // Will be loaded from global players array
    pendingMatches: [],
    pendingObservation: null,
    recordingObservations: false
};

// Translations for voice prompts
const voiceGameTranslations = {
    'pt-BR': {
        // Button and modal
        btnStartVoice: '🎤 Registrar por Voz',
        modalTitle: '🎤 Registro por Voz',
        modalSubtitle: 'Fale quando o microfone estiver ativo',
        btnCancel: 'Cancelar',
        btnSkip: 'Pular',
        btnRetry: '🔄 Repetir',
        btnKeyboard: '⌨️ Teclado',
        btnYes: '✓ Sim',
        btnNo: '✗ Não',
        btnWon: '🏆 Ganhei',
        btnLost: '😔 Perdi',
        btnDraw: '🤝 Empate',
        btnSingles: '👤 Simples',
        btnDoubles: '👥 Duplas',
        inputPlaceholder: 'Digite aqui...',
        inputPlayer: 'Nome do jogador...',
        inputScore: 'Placar (ex: 3 a 1)',
        inputLocation: 'Local do jogo...',
        summary: '📋 Resumo',
        btnTryOtherName: '🔄 Dizer outro nome',
        listening: '🎤 Ouvindo...',
        processing: '⏳ Processando...',

        // Steps
        step1_prompt: '<span class="voice-highlight">📆 DATA</span>\n\nHoje ({date})\n\n<span class="voice-hint">Diga "Sim" ou a data correta</span>',
        step1_confirm: '✅ Data confirmada:\n<span class="voice-highlight">{date}</span>',
        step1_updated: '✅ Data alterada para:\n<span class="voice-highlight">{date}</span>',

        step2_prompt: '<span class="voice-highlight">🎮 TIPO DE JOGO</span>\n\n<span class="voice-hint">Diga "Simples" ou "Duplas"</span>',
        step2_singles: '✅ <span class="voice-highlight">Simples</span> selecionado',
        step2_doubles: '✅ <span class="voice-highlight">Duplas</span> selecionado',

        step3_prompt: '<span class="voice-highlight">👤 ADVERSÁRIO</span>\n\n<span class="voice-hint">Diga o nome</span>',
        step3_found: '✅ Encontrei:\n\n<span class="voice-highlight">{name}</span>\n\nEstá correto?',
        step3_notFound: '❌ Não encontrei:\n\n<span class="voice-highlight">"{name}"</span>\n\n<span class="voice-hint">Cadastre primeiro pelo teclado.</span>',
        step3_multiple: '🔍 Encontrei <span class="voice-highlight">{count}</span> jogadores.\n\nQual deles?',
        step3_confirmed: '✅ Adversário:\n<span class="voice-highlight">{name}</span>',

        step3b_prompt: '<span class="voice-highlight">👤 SEGUNDO ADVERSÁRIO</span>\n\n<span class="voice-hint">Diga o nome do segundo adversário</span>',
        step3b_confirmed: '✅ Segundo adversário:\n<span class="voice-highlight">{name}</span>',

        step3c_prompt: '<span class="voice-highlight">🤝 PARCEIRO</span>\n\n<span class="voice-hint">Diga o nome do seu parceiro</span>',
        step3c_confirmed: '✅ Parceiro:\n<span class="voice-highlight">{name}</span>',

        step4_prompt: '<span class="voice-highlight">🏆 RESULTADO</span>\n\n<span class="voice-hint">Diga "Ganhei", "Perdi" ou "Empate"</span>',
        step4_won: '✅ <span class="voice-highlight">Vitória</span> registrada!',
        step4_lost: '✅ <span class="voice-highlight">Derrota</span> registrada.',
        step4_draw: '✅ <span class="voice-highlight">Empate</span> registrado.',

        step5_prompt: '<span class="voice-highlight">📊 PLACAR</span>\n\n<span class="voice-hint">Diga o placar em sets (ex: "2 a 1" ou "3 a 0")</span>',
        step5_confirmed: '✅ Placar:\n<span class="voice-highlight">{score}</span>',
        step5_skipped: '⏭️ Placar pulado.',

        step5b_prompt: '<span class="voice-highlight">📊 PLACAR DETALHADO</span>\n\n<span class="voice-hint">Quer informar os pontos de cada set?\n\nDiga "Sim" ou "Pular"</span>',
        step5b_setPrompt: '<span class="voice-highlight">📊 SET {setNumber}</span>\n\n<span class="voice-hint">Diga os pontos (ex: "11 a 5")</span>',
        step5b_setConfirmed: '✅ Set {setNumber}: <span class="voice-highlight">{setScore}</span>',
        step5b_allSetsConfirmed: '✅ Placar detalhado:\n<span class="voice-highlight">{detailedScore}</span>',
        step5b_inconsistent: '⚠️ <span class="voice-highlight">Placar inconsistente!</span>\n\nPlacar em sets: {setsScore}\nSets ganhos no detalhe: {detailedWins}\nSets perdidos no detalhe: {detailedLosses}\n\n<span class="voice-hint">Diga "Sim" para salvar assim mesmo ou "Não" para refazer</span>',
        step5b_skipped: '⏭️ Placar detalhado pulado.',

        step6_prompt: '<span class="voice-highlight">📍 LOCAL</span>\n\n<span class="voice-hint">Diga o local ou "Pular"</span>',
        step6_saved: '✅ Local:\n<span class="voice-highlight">{location}</span>',
        step6_skipped: '⏭️ Local pulado.',

        step7_prompt: '<span class="voice-highlight">📝 OBSERVAÇÕES</span>\n\n<span class="voice-hint">Diga "Sim" para gravar ou "Pular"</span>',
        step7_recording: '<span class="voice-highlight">🎤 GRAVANDO</span>\n\n<span class="voice-recording-hint">Fale suas observações agora!</span>',
        step7_confirm: '📝 Você disse:\n\n<span class="voice-highlight">"{text}"</span>\n\n<span class="voice-hint">Está correto?</span>',
        step7_saved: '✅ Observações salvas!',
        step7_skipped: '⏭️ Observações puladas.',
        btnRetryObservation: '🔄 Gravar novamente',

        step8_prompt: '<span class="voice-highlight">✅ CONFIRMAR?</span>\n\n📅 {date}\n🎮 {gameType}\n👤 {players}\n🏆 {result}{score}{location}\n\n<span class="voice-hint">Diga "Sim" para salvar</span>',
        step8_saved: '🎉 <span class="voice-highlight">Jogo salvo!</span>',
        step8_cancelled: '❌ Registro cancelado.',

        // Responses recognition
        yes: ['sim', 'correto', 'isso', 'confirmo', 'ok', 'certo', 'exato'],
        no: ['não', 'nao', 'errado', 'cancela', 'cancelar'],
        won: ['ganhei', 'venci', 'vitória', 'vitoria', 'win', 'ganhamos', 'vencemos'],
        lost: ['perdi', 'derrota', 'perdeu', 'perdemos'],
        draw: ['empate', 'empatei', 'empatamos'],
        skip: ['pular', 'pula', 'próximo', 'proximo', 'não quero'],
        singles: ['simples', 'single', 'sozinho', 'individual'],
        doubles: ['duplas', 'dupla', 'double', 'doubles', 'parceiro'],

        // Errors
        errorNotUnderstood: '❓ Não entendi. Por favor, repita.',
        errorNoSpeech: '🔇 Não detectei sua voz. Tente novamente.',
        errorMicrophone: '🎤 Erro no microfone. Verifique as permissões.',
        errorMicStuck: '🎤 Microfone parou. Toque no 🎤 para tentar novamente.',

        // Date words
        today: 'hoje',
        yesterday: 'ontem',
        dayBeforeYesterday: 'anteontem',

        // Labels
        labelSingles: 'Simples',
        labelDoubles: 'Duplas',
        labelVictory: 'Vitória',
        labelDefeat: 'Derrota',
        labelDraw: 'Empate'
    },
    'en-US': {
        btnStartVoice: '🎤 Register by Voice',
        modalTitle: '🎤 Voice Registration',
        modalSubtitle: 'Speak when the microphone is active',
        btnCancel: 'Cancel',
        btnSkip: 'Skip',
        btnRetry: '🔄 Repeat',
        btnKeyboard: '⌨️ Keyboard',
        btnYes: '✓ Yes',
        btnNo: '✗ No',
        btnWon: '🏆 I won',
        btnLost: '😔 I lost',
        btnDraw: '🤝 Draw',
        btnSingles: '👤 Singles',
        btnDoubles: '👥 Doubles',
        inputPlaceholder: 'Type here...',
        inputPlayer: 'Player name...',
        inputScore: 'Score (e.g., 3 to 1)',
        inputLocation: 'Game location...',
        summary: '📋 Summary',
        btnTryOtherName: '🔄 Try another name',
        listening: '🎤 Listening...',
        processing: '⏳ Processing...',

        step1_prompt: '<span class="voice-highlight">📆 DATE</span>\n\nToday ({date})\n\n<span class="voice-hint">Say "Yes" or the correct date</span>',
        step1_confirm: '✅ Date confirmed:\n<span class="voice-highlight">{date}</span>',
        step1_updated: '✅ Date changed to:\n<span class="voice-highlight">{date}</span>',

        step2_prompt: '<span class="voice-highlight">🎮 GAME TYPE</span>\n\n<span class="voice-hint">Say "Singles" or "Doubles"</span>',
        step2_singles: '✅ <span class="voice-highlight">Singles</span> selected',
        step2_doubles: '✅ <span class="voice-highlight">Doubles</span> selected',

        step3_prompt: '<span class="voice-highlight">👤 OPPONENT</span>\n\n<span class="voice-hint">Say the name</span>',
        step3_found: '✅ Found:\n\n<span class="voice-highlight">{name}</span>\n\nIs that correct?',
        step3_notFound: '❌ Not found:\n\n<span class="voice-highlight">"{name}"</span>\n\n<span class="voice-hint">Please register first.</span>',
        step3_multiple: '🔍 Found <span class="voice-highlight">{count}</span> players.\n\nWhich one?',
        step3_confirmed: '✅ Opponent:\n<span class="voice-highlight">{name}</span>',

        step3b_prompt: '<span class="voice-highlight">👤 SECOND OPPONENT</span>\n\n<span class="voice-hint">Say the second opponent\'s name</span>',
        step3b_confirmed: '✅ Second opponent:\n<span class="voice-highlight">{name}</span>',

        step3c_prompt: '<span class="voice-highlight">🤝 PARTNER</span>\n\n<span class="voice-hint">Say your partner\'s name</span>',
        step3c_confirmed: '✅ Partner:\n<span class="voice-highlight">{name}</span>',

        step4_prompt: '<span class="voice-highlight">🏆 RESULT</span>\n\n<span class="voice-hint">Say "I won", "I lost" or "Draw"</span>',
        step4_won: '✅ <span class="voice-highlight">Victory</span> registered!',
        step4_lost: '✅ <span class="voice-highlight">Defeat</span> registered.',
        step4_draw: '✅ <span class="voice-highlight">Draw</span> registered.',

        step5_prompt: '<span class="voice-highlight">📊 SCORE</span>\n\n<span class="voice-hint">Say the score in sets (e.g., "two one" or "three zero")</span>',
        step5_confirmed: '✅ Score:\n<span class="voice-highlight">{score}</span>',
        step5_skipped: '⏭️ Score skipped.',

        step5b_prompt: '<span class="voice-highlight">📊 DETAILED SCORE</span>\n\n<span class="voice-hint">Want to add points for each set?\n\nSay "Yes" or "Skip"</span>',
        step5b_setPrompt: '<span class="voice-highlight">📊 SET {setNumber}</span>\n\n<span class="voice-hint">Say the points (e.g., "11 to 5")</span>',
        step5b_setConfirmed: '✅ Set {setNumber}: <span class="voice-highlight">{setScore}</span>',
        step5b_allSetsConfirmed: '✅ Detailed score:\n<span class="voice-highlight">{detailedScore}</span>',
        step5b_inconsistent: '⚠️ <span class="voice-highlight">Score inconsistent!</span>\n\nSets score: {setsScore}\nSets won in detail: {detailedWins}\nSets lost in detail: {detailedLosses}\n\n<span class="voice-hint">Say "Yes" to save anyway or "No" to redo</span>',
        step5b_skipped: '⏭️ Detailed score skipped.',

        step6_prompt: '<span class="voice-highlight">📍 LOCATION</span>\n\n<span class="voice-hint">Say the location or "Skip"</span>',
        step6_saved: '✅ Location:\n<span class="voice-highlight">{location}</span>',
        step6_skipped: '⏭️ Location skipped.',

        step7_prompt: '<span class="voice-highlight">📝 NOTES</span>\n\n<span class="voice-hint">Say "Yes" to record or "Skip"</span>',
        step7_recording: '<span class="voice-highlight">🎤 RECORDING</span>\n\n<span class="voice-recording-hint">Speak your notes now!</span>',
        step7_confirm: '📝 You said:\n\n<span class="voice-highlight">"{text}"</span>\n\n<span class="voice-hint">Is that correct?</span>',
        step7_saved: '✅ Notes saved!',
        step7_skipped: '⏭️ Notes skipped.',
        btnRetryObservation: '🔄 Record again',

        step8_prompt: '<span class="voice-highlight">✅ CONFIRM?</span>\n\n📅 {date}\n🎮 {gameType}\n👤 {players}\n🏆 {result}{score}{location}\n\n<span class="voice-hint">Say "Yes" to save</span>',
        step8_saved: '🎉 <span class="voice-highlight">Game saved!</span>',
        step8_cancelled: '❌ Registration cancelled.',

        yes: ['yes', 'correct', 'right', 'confirm', 'ok', 'yeah', 'yep', 'sure'],
        no: ['no', 'wrong', 'cancel', 'nope'],
        won: ['won', 'win', 'victory', 'beat', 'i won', 'we won'],
        lost: ['lost', 'lose', 'defeat', 'i lost', 'we lost'],
        draw: ['draw', 'tie', 'tied'],
        skip: ['skip', 'next', 'pass'],
        singles: ['singles', 'single', 'alone', 'individual', 'one on one'],
        doubles: ['doubles', 'double', 'partner', 'team', 'pairs'],

        errorNotUnderstood: '❓ Didn\'t understand. Please repeat.',
        errorNoSpeech: '🔇 No voice detected. Try again.',
        errorMicrophone: '🎤 Microphone error. Check permissions.',
        errorMicStuck: '🎤 Microphone stopped. Tap 🎤 to try again.',

        today: 'today',
        yesterday: 'yesterday',
        dayBeforeYesterday: 'day before yesterday',

        labelSingles: 'Singles',
        labelDoubles: 'Doubles',
        labelVictory: 'Victory',
        labelDefeat: 'Defeat',
        labelDraw: 'Draw'
    },
    'ja-JP': {
        btnStartVoice: '🎤 音声で登録',
        modalTitle: '🎤 音声登録',
        modalSubtitle: 'マイクがアクティブになったら話してください',
        btnCancel: 'キャンセル',
        btnSkip: 'スキップ',
        btnRetry: '🔄 再試行',
        btnKeyboard: '⌨️ キーボード',
        btnYes: '✓ はい',
        btnNo: '✗ いいえ',
        btnWon: '🏆 勝った',
        btnLost: '😔 負けた',
        btnDraw: '🤝 引き分け',
        btnSingles: '👤 シングルス',
        btnDoubles: '👥 ダブルス',
        inputPlaceholder: 'ここに入力...',
        inputPlayer: '選手名...',
        inputScore: 'スコア (例: 3対1)',
        inputLocation: '場所...',
        summary: '📋 まとめ',
        btnTryOtherName: '🔄 別の名前を試す',
        listening: '🎤 聞いています...',
        processing: '⏳ 処理中...',

        step1_prompt: '<span class="voice-highlight">📆 日付</span>\n\n今日 ({date})\n\n<span class="voice-hint">「はい」または正しい日付</span>',
        step1_confirm: '✅ 日付確認:\n<span class="voice-highlight">{date}</span>',
        step1_updated: '✅ 日付変更:\n<span class="voice-highlight">{date}</span>',

        step2_prompt: '<span class="voice-highlight">🎮 試合タイプ</span>\n\n<span class="voice-hint">「シングルス」または「ダブルス」</span>',
        step2_singles: '✅ <span class="voice-highlight">シングルス</span>選択',
        step2_doubles: '✅ <span class="voice-highlight">ダブルス</span>選択',

        step3_prompt: '<span class="voice-highlight">👤 対戦相手</span>\n\n<span class="voice-hint">名前を言って</span>',
        step3_found: '✅ 見つかりました:\n\n<span class="voice-highlight">{name}</span>\n\n正しいですか？',
        step3_notFound: '❌ 見つかりません:\n\n<span class="voice-highlight">「{name}」</span>\n\n<span class="voice-hint">先に登録してください</span>',
        step3_multiple: '🔍 <span class="voice-highlight">{count}人</span>見つかりました\n\nどの人？',
        step3_confirmed: '✅ 対戦相手:\n<span class="voice-highlight">{name}</span>',

        step3b_prompt: '<span class="voice-highlight">👤 2人目の対戦相手</span>\n\n<span class="voice-hint">2人目の名前を言って</span>',
        step3b_confirmed: '✅ 2人目:\n<span class="voice-highlight">{name}</span>',

        step3c_prompt: '<span class="voice-highlight">🤝 パートナー</span>\n\n<span class="voice-hint">パートナーの名前を言って</span>',
        step3c_confirmed: '✅ パートナー:\n<span class="voice-highlight">{name}</span>',

        step4_prompt: '<span class="voice-highlight">🏆 結果</span>\n\n<span class="voice-hint">「勝った」「負けた」「引き分け」</span>',
        step4_won: '✅ <span class="voice-highlight">勝利</span>を記録！',
        step4_lost: '✅ <span class="voice-highlight">敗北</span>を記録',
        step4_draw: '✅ <span class="voice-highlight">引き分け</span>を記録',

        step5_prompt: '<span class="voice-highlight">📊 スコア</span>\n\n<span class="voice-hint">セット数を言って (例:「2対1」)</span>',
        step5_confirmed: '✅ スコア:\n<span class="voice-highlight">{score}</span>',
        step5_skipped: '⏭️ スキップ',

        step5b_prompt: '<span class="voice-highlight">📊 詳細スコア</span>\n\n<span class="voice-hint">各セットのポイントを入力しますか？\n\n「はい」か「スキップ」</span>',
        step5b_setPrompt: '<span class="voice-highlight">📊 セット{setNumber}</span>\n\n<span class="voice-hint">ポイントを言って (例:「11対5」)</span>',
        step5b_setConfirmed: '✅ セット{setNumber}: <span class="voice-highlight">{setScore}</span>',
        step5b_allSetsConfirmed: '✅ 詳細スコア:\n<span class="voice-highlight">{detailedScore}</span>',
        step5b_inconsistent: '⚠️ <span class="voice-highlight">スコアが一致しません！</span>\n\nセットスコア: {setsScore}\n詳細の勝利セット: {detailedWins}\n詳細の敗北セット: {detailedLosses}\n\n<span class="voice-hint">「はい」で保存、「いいえ」でやり直し</span>',
        step5b_skipped: '⏭️ 詳細スコアをスキップ',

        step6_prompt: '<span class="voice-highlight">📍 場所</span>\n\n<span class="voice-hint">場所を言うか「スキップ」</span>',
        step6_saved: '✅ 場所:\n<span class="voice-highlight">{location}</span>',
        step6_skipped: '⏭️ スキップ',

        step7_prompt: '<span class="voice-highlight">📝 メモ</span>\n\n<span class="voice-hint">「はい」で録音、「スキップ」</span>',
        step7_recording: '<span class="voice-highlight">🎤 録音中</span>\n\n<span class="voice-recording-hint">メモを話してください！</span>',
        step7_confirm: '📝 認識結果:\n\n<span class="voice-highlight">「{text}」</span>\n\n<span class="voice-hint">正しいですか？</span>',
        step7_saved: '✅ 保存しました！',
        step7_skipped: '⏭️ スキップ',
        btnRetryObservation: '🔄 もう一度録音',

        step8_prompt: '<span class="voice-highlight">✅ 確認</span>\n\n📅 {date}\n🎮 {gameType}\n👤 {players}\n🏆 {result}{score}{location}\n\n<span class="voice-hint">「はい」で保存</span>',
        step8_saved: '🎉 <span class="voice-highlight">保存しました！</span>',
        step8_cancelled: '❌ キャンセル',

        yes: ['はい', 'うん', 'そう', 'ok', 'オッケー'],
        no: ['いいえ', 'ううん', 'ちがう', 'キャンセル'],
        won: ['勝った', '勝ち', '勝利', 'かった'],
        lost: ['負けた', '負け', '敗北', 'まけた'],
        draw: ['引き分け', 'ひきわけ', 'ドロー'],
        skip: ['スキップ', '次', 'パス'],
        singles: ['シングルス', 'シングル', '単'],
        doubles: ['ダブルス', 'ダブル', '複'],

        errorNotUnderstood: '❓ 理解できませんでした。もう一度。',
        errorNoSpeech: '🔇 音声が検出されませんでした。',
        errorMicrophone: '🎤 マイクエラー。',
        errorMicStuck: '🎤 マイクが停止。🎤をタップ。',

        today: '今日',
        yesterday: '昨日',
        dayBeforeYesterday: '一昨日',

        labelSingles: 'シングルス',
        labelDoubles: 'ダブルス',
        labelVictory: '勝利',
        labelDefeat: '敗北',
        labelDraw: '引き分け'
    }
};

/**
 * Get current language
 */
function getVoiceGameLang() {
    if (window.i18n && window.i18n.currentLang) {
        return window.i18n.currentLang;
    }
    return localStorage.getItem('language') || localStorage.getItem('preferredLanguage') || 'pt-BR';
}

/**
 * Get translation text
 */
function getVoiceGameText(key) {
    const lang = getVoiceGameLang();
    const translations = voiceGameTranslations[lang] || voiceGameTranslations['pt-BR'];
    return translations[key] || voiceGameTranslations['pt-BR'][key] || key;
}

/**
 * Format date for display
 */
function formatDateForVoice(date) {
    const lang = getVoiceGameLang();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return date.toLocaleDateString(lang, options);
}

/**
 * Parse date from voice input
 */
function parseDateFromVoice(text) {
    const lang = getVoiceGameLang();
    const t = voiceGameTranslations[lang];
    const lowerText = text.toLowerCase();
    const today = new Date();

    if (lowerText.includes(t.today)) return today;
    if (lowerText.includes(t.yesterday)) {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return d;
    }
    if (lowerText.includes(t.dayBeforeYesterday)) {
        const d = new Date(today);
        d.setDate(d.getDate() - 2);
        return d;
    }

    const dayMatch = text.match(/(\d{1,2})/);
    if (dayMatch) {
        const day = parseInt(dayMatch[1]);
        if (day >= 1 && day <= 31) {
            const newDate = new Date(today);
            newDate.setDate(day);
            if (newDate > today) newDate.setMonth(newDate.getMonth() - 1);
            return newDate;
        }
    }
    return null;
}

/**
 * Check if text matches keywords
 */
function matchesKeywords(text, keywordType) {
    const lang = getVoiceGameLang();
    const keywords = voiceGameTranslations[lang][keywordType] || [];
    const lowerText = text.toLowerCase().trim();
    return keywords.some(k => lowerText.includes(k.toLowerCase()));
}

/**
 * Search player by name (fuzzy matching)
 */
function searchPlayerByVoice(spokenName) {
    const lowerSpoken = spokenName.toLowerCase().trim();
    console.log('Searching for:', lowerSpoken, 'in', voiceGameEntry.players.length, 'players');

    // Exact match
    let exact = voiceGameEntry.players.find(p => p.name.toLowerCase() === lowerSpoken);
    if (exact) return [exact];

    // Partial match
    let partial = voiceGameEntry.players.filter(p => {
        const nameLower = p.name.toLowerCase();
        const firstName = nameLower.split(/\s+/)[0];
        return nameLower.includes(lowerSpoken) ||
               lowerSpoken.includes(nameLower) ||
               firstName === lowerSpoken ||
               firstName.startsWith(lowerSpoken);
    });
    if (partial.length > 0) return partial;

    // Fuzzy match
    return voiceGameEntry.players.filter(p => {
        const firstName = p.name.toLowerCase().split(/\s+/)[0];
        return calculateSimilarity(firstName, lowerSpoken) > 0.5;
    });
}

/**
 * Convert spoken numbers to digits
 * Handles Portuguese, English and Japanese number words
 *
 * Supported formats:
 * - Portuguese: "três a um" → "3-1", "vinte e um a dezenove" → "21-19"
 * - English: "three one" → "3-1", "six four" → "6-4" (WITHOUT "to")
 * - Japanese: "三対一" or "さん たい いち" → "3-1"
 */
function convertSpokenNumbersToDigits(text) {
    const numberWords = {
        // Portuguese
        'zero': '0', 'um': '1', 'uma': '1', 'dois': '2', 'duas': '2', 'três': '3', 'tres': '3',
        'quatro': '4', 'cinco': '5', 'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9',
        'dez': '10', 'onze': '11', 'doze': '12', 'treze': '13', 'quatorze': '14', 'catorze': '14',
        'quinze': '15', 'dezesseis': '16', 'dezessete': '17', 'dezoito': '18', 'dezenove': '19',
        'vinte': '20', 'vinte e um': '21', 'vinte e uma': '21',
        // English
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
        'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
        'twenty one': '21', 'twenty-one': '21',
        // Japanese (kanji)
        'ゼロ': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
        '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
        // Japanese (hiragana)
        'いち': '1', 'に': '2', 'さん': '3', 'し': '4', 'よん': '4', 'ご': '5',
        'ろく': '6', 'しち': '7', 'なな': '7', 'はち': '8', 'きゅう': '9', 'く': '9', 'じゅう': '10'
    };

    let result = text.toLowerCase();

    // Pre-process: Handle Japanese separator "たい" (tai) before number conversion
    result = result.replace(/\s*たい\s*/g, ' TAI_SEPARATOR ');

    // Sort by length descending to match longer phrases first (e.g., "vinte e um" before "um")
    const sortedWords = Object.keys(numberWords).sort((a, b) => b.length - a.length);

    for (const word of sortedWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, numberWords[word]);
    }

    // Now convert separators to "-"
    result = result.replace(/\s*TAI_SEPARATOR\s*/g, '-');

    // Clean up common separators: "a" -> "-", "対" -> "-", "x" -> "-"
    result = result.replace(/\s+a\s+/gi, '-');
    result = result.replace(/\s*対\s*/g, '-');
    result = result.replace(/\s+x\s+/gi, '-');

    // Handle consecutive digits with space: "3 1" -> "3-1"
    result = result.replace(/(\d+)\s+(\d+)/g, '$1-$2');

    // Handle 2-digit scores without separator (e.g., "31" from "three one")
    if (/^\d{2}$/.test(result) && !result.includes('-')) {
        result = result.charAt(0) + '-' + result.charAt(1);
    }

    // Handle 3-digit scores (e.g., "621" -> "6-21" for tiebreak)
    if (/^\d{3}$/.test(result) && !result.includes('-')) {
        result = result.charAt(0) + '-' + result.substring(1);
    }

    // Clean up any remaining whitespace
    result = result.trim();

    return result;
}

/**
 * Simple string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;

    const costs = [];
    for (let i = 0; i <= str1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= str2.length; j++) {
            if (i === 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[str2.length] = lastValue;
    }
    return (longer.length - costs[str2.length]) / longer.length;
}

/**
 * Get unique locations from existing games
 */
function getExistingLocations() {
    if (!window.games || !Array.isArray(window.games)) {
        return [];
    }
    const locations = new Set();
    window.games.forEach(game => {
        if (game.location && game.location.trim()) {
            locations.add(game.location.trim());
        }
    });
    return Array.from(locations);
}

/**
 * Normalize text for comparison (remove accents, lowercase)
 */
function normalizeForComparison(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars
        .trim();
}

/**
 * Find best matching location from existing locations
 * Returns { location: string, similarity: number } or null if no good match
 */
function findMatchingLocation(spokenText) {
    const existingLocations = getExistingLocations();
    if (existingLocations.length === 0) {
        return null;
    }

    const normalizedSpoken = normalizeForComparison(spokenText);
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const location of existingLocations) {
        const normalizedLocation = normalizeForComparison(location);

        // Calculate similarity
        const similarity = calculateSimilarity(normalizedSpoken, normalizedLocation);

        // Also check if one contains the other (partial match)
        const containsMatch = normalizedLocation.includes(normalizedSpoken) ||
                             normalizedSpoken.includes(normalizedLocation);

        // Boost similarity if there's a partial match
        const effectiveSimilarity = containsMatch ? Math.max(similarity, 0.7) : similarity;

        if (effectiveSimilarity > bestSimilarity) {
            bestSimilarity = effectiveSimilarity;
            bestMatch = location;
        }
    }

    // Return match only if similarity is above threshold (0.6 = 60%)
    if (bestSimilarity >= 0.6) {
        return { location: bestMatch, similarity: bestSimilarity };
    }

    return null;
}

/**
 * Initialize speech recognition
 */
function initVoiceGameRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = getVoiceGameLang();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    return recognition;
}

/**
 * Load players from global array
 */
function loadPlayersForVoice() {
    if (window.players && Array.isArray(window.players)) {
        voiceGameEntry.players = window.players;
        console.log('Loaded players for voice:', voiceGameEntry.players.length);
    }
}

/**
 * Check if current sport supports doubles
 */
function sportSupportsDoubles() {
    const sportConfig = window.getSportConfig ? window.getSportConfig(window.currentSport) : null;
    return sportConfig && sportConfig.gameTypes && sportConfig.gameTypes.includes('doubles');
}

/**
 * Check if current sport supports singles
 */
function sportSupportsSingles() {
    const sportConfig = window.getSportConfig ? window.getSportConfig(window.currentSport) : null;
    return sportConfig && sportConfig.gameTypes && sportConfig.gameTypes.includes('singles');
}

/**
 * Open voice game modal
 */
function openVoiceGameModal() {
    loadPlayersForVoice();

    // Reset state
    voiceGameEntry.currentStep = 1;
    voiceGameEntry.isActive = true;
    voiceGameEntry.detailedScoreSets = [];
    voiceGameEntry.currentDetailedSet = 0;
    voiceGameEntry.gameData = {
        game_date: new Date(),
        game_type: 'singles',
        opponent_id: null,
        opponent_name: null,
        opponent2_id: null,
        opponent2_name: null,
        partner_id: null,
        partner_name: null,
        result: null,
        score: null,
        detailed_score: null,
        location: null,
        notes: null
    };

    // Check sport capabilities
    const supportsDoubles = sportSupportsDoubles();
    const supportsSingles = sportSupportsSingles();

    // Auto-select game type if only one is available
    if (supportsDoubles && !supportsSingles) {
        voiceGameEntry.gameData.game_type = 'doubles';
    } else if (supportsSingles && !supportsDoubles) {
        voiceGameEntry.gameData.game_type = 'singles';
    }

    // Create modal
    let modal = document.getElementById('voiceGameModal');
    if (modal) modal.remove();
    modal = createVoiceGameModal();
    document.body.appendChild(modal);
    modal.style.display = 'flex';

    attachVoiceGameEventListeners();

    // Start first step
    setTimeout(() => runVoiceGameStep(1), 500);
}

/**
 * Create modal HTML
 */
function createVoiceGameModal() {
    const modal = document.createElement('div');
    modal.id = 'voiceGameModal';
    modal.className = 'modal voice-game-modal';

    modal.innerHTML = `
        <div class="modal-content voice-game-content">
            <div class="modal-header">
                <h2>${getVoiceGameText('modalTitle')}</h2>
                <span class="close" id="voiceGameCloseX">&times;</span>
            </div>
            <div class="voice-game-body">
                <div class="voice-game-status">
                    <div class="voice-game-step" id="voiceGameStep">1/8</div>
                    <div class="voice-game-prompt" id="voiceGamePrompt"></div>
                    <div class="voice-game-indicator" id="voiceGameIndicator" onclick="restartVoiceListening()" title="${getVoiceGameText('btnRetry')}">
                        <div class="voice-wave"></div>
                    </div>
                    <div class="voice-game-response" id="voiceGameResponse"></div>
                    <div class="voice-game-manual-input" id="voiceGameManualInput" style="display: none;">
                        <div class="manual-buttons" id="voiceGameYesNoButtons" style="display: none;">
                            <button type="button" class="btn-yes" id="voiceGameYesBtn">${getVoiceGameText('btnYes')}</button>
                            <button type="button" class="btn-no" id="voiceGameNoBtn">${getVoiceGameText('btnNo')}</button>
                        </div>
                        <div class="manual-buttons" id="voiceGameTypeButtons" style="display: none;">
                            <button type="button" class="btn-primary" id="voiceGameSinglesBtn">${getVoiceGameText('btnSingles')}</button>
                            <button type="button" class="btn-primary" id="voiceGameDoublesBtn">${getVoiceGameText('btnDoubles')}</button>
                        </div>
                        <div class="manual-buttons" id="voiceGameResultButtons" style="display: none;">
                            <button type="button" class="btn-win" id="voiceGameWinBtn">${getVoiceGameText('btnWon')}</button>
                            <button type="button" class="btn-lose" id="voiceGameLoseBtn">${getVoiceGameText('btnLost')}</button>
                            <button type="button" class="btn-draw" id="voiceGameDrawBtn">${getVoiceGameText('btnDraw')}</button>
                        </div>
                        <div class="manual-text-input" id="voiceGameTextInput" style="display: none;">
                            <input type="text" id="voiceGameTextInputField" placeholder="${getVoiceGameText('inputPlaceholder')}">
                            <button type="button" class="btn-primary" id="voiceGameTextInputBtn">OK</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="voiceGameCancelBtn">${getVoiceGameText('btnCancel')}</button>
                <button type="button" class="btn-secondary" id="voiceGameSkipBtn" style="display: none;">${getVoiceGameText('btnSkip')}</button>
                <button type="button" class="btn-primary" id="voiceGameRetryBtn" style="display: none;">${getVoiceGameText('btnRetry')}</button>
                <button type="button" class="btn-secondary" id="voiceGameKeyboardBtn">${getVoiceGameText('btnKeyboard')}</button>
            </div>
        </div>
    `;
    return modal;
}

/**
 * Attach event listeners
 */
function attachVoiceGameEventListeners() {
    document.getElementById('voiceGameCancelBtn').onclick = () => closeVoiceGameModal();
    document.getElementById('voiceGameCloseX').onclick = () => closeVoiceGameModal();
    document.getElementById('voiceGameSkipBtn').onclick = () => skipVoiceGameStep();
    document.getElementById('voiceGameRetryBtn').onclick = () => retryVoiceGameStep();
    document.getElementById('voiceGameKeyboardBtn').onclick = () => toggleManualInput();

    document.getElementById('voiceGameYesBtn').onclick = () => handleManualInput(getVoiceGameText('yes')[0]);
    document.getElementById('voiceGameNoBtn').onclick = () => handleManualInput(getVoiceGameText('no')[0]);
    document.getElementById('voiceGameWinBtn').onclick = () => handleManualInput(getVoiceGameText('won')[0]);
    document.getElementById('voiceGameLoseBtn').onclick = () => handleManualInput(getVoiceGameText('lost')[0]);
    document.getElementById('voiceGameDrawBtn').onclick = () => handleManualInput(getVoiceGameText('draw')[0]);
    document.getElementById('voiceGameSinglesBtn').onclick = () => handleManualInput('singles');
    document.getElementById('voiceGameDoublesBtn').onclick = () => handleManualInput('doubles');

    document.getElementById('voiceGameTextInputBtn').onclick = () => {
        const input = document.getElementById('voiceGameTextInputField');
        if (input.value.trim()) {
            handleManualInput(input.value.trim());
            input.value = '';
        }
    };

    document.getElementById('voiceGameTextInputField').onkeypress = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            handleManualInput(e.target.value.trim());
            e.target.value = '';
        }
    };
}

/**
 * Toggle manual input
 */
function toggleManualInput() {
    const manualInput = document.getElementById('voiceGameManualInput');
    const step = voiceGameEntry.currentStep;

    if (manualInput.style.display === 'none') {
        manualInput.style.display = 'block';
        document.getElementById('voiceGameYesNoButtons').style.display = 'none';
        document.getElementById('voiceGameTypeButtons').style.display = 'none';
        document.getElementById('voiceGameResultButtons').style.display = 'none';
        document.getElementById('voiceGameTextInput').style.display = 'none';

        if (step === 1 || step === 7 || step === 8) {
            document.getElementById('voiceGameYesNoButtons').style.display = 'flex';
        } else if (step === 2) {
            document.getElementById('voiceGameTypeButtons').style.display = 'flex';
        } else if (step === 4) {
            document.getElementById('voiceGameResultButtons').style.display = 'flex';
        } else {
            document.getElementById('voiceGameTextInput').style.display = 'flex';
        }
    } else {
        manualInput.style.display = 'none';
    }
}

/**
 * Handle manual input
 */
function handleManualInput(value) {
    if (voiceGameEntry.recognition) {
        try { voiceGameEntry.recognition.abort(); } catch(e) {}
    }
    document.getElementById('voiceGameManualInput').style.display = 'none';
    processVoiceGameInput(voiceGameEntry.currentStep, value);
}

/**
 * Close modal
 */
function closeVoiceGameModal() {
    voiceGameEntry.isActive = false;
    clearListeningTimeout();
    if (voiceGameEntry.recognition) {
        try { voiceGameEntry.recognition.abort(); } catch(e) {}
        voiceGameEntry.recognition = null;
    }
    const modal = document.getElementById('voiceGameModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Clear listening timeout
 */
function clearListeningTimeout() {
    if (voiceGameEntry.listeningTimeout) {
        clearTimeout(voiceGameEntry.listeningTimeout);
        voiceGameEntry.listeningTimeout = null;
    }
}

/**
 * Run step
 */
function runVoiceGameStep(step) {
    voiceGameEntry.currentStep = step;
    const stepEl = document.getElementById('voiceGameStep');
    const promptEl = document.getElementById('voiceGamePrompt');
    const responseEl = document.getElementById('voiceGameResponse');
    const skipBtn = document.getElementById('voiceGameSkipBtn');

    // Calculate total steps based on game type
    const isDoubles = voiceGameEntry.gameData.game_type === 'doubles';
    const totalSteps = isDoubles ? 8 : 8; // Both have 8 steps (doubles has 3b and 3c)

    stepEl.textContent = `${step}/8`;
    responseEl.textContent = '';
    skipBtn.style.display = 'none';

    let prompt = '';
    const supportsDoubles = sportSupportsDoubles();
    const supportsSingles = sportSupportsSingles();

    switch(step) {
        case 1: // Date
            prompt = getVoiceGameText('step1_prompt')
                .replace('{date}', formatDateForVoice(voiceGameEntry.gameData.game_date));
            break;

        case 2: // Game type (skip if sport only supports one type)
            if (!supportsDoubles || !supportsSingles) {
                // Auto-skip to step 3
                setTimeout(() => runVoiceGameStep(3), 100);
                return;
            }
            prompt = getVoiceGameText('step2_prompt');
            break;

        case 3: // Opponent
            prompt = getVoiceGameText('step3_prompt');
            break;

        case '3b': // Second opponent (doubles only)
            prompt = getVoiceGameText('step3b_prompt');
            break;

        case '3c': // Partner (doubles only)
            prompt = getVoiceGameText('step3c_prompt');
            break;

        case 4: // Result
            prompt = getVoiceGameText('step4_prompt');
            break;

        case 5: // Score (optional)
            prompt = getVoiceGameText('step5_prompt');
            skipBtn.style.display = 'inline-block';
            break;

        case '5b': // Detailed score prompt (ask if user wants to add)
            // Only show if we have a score (X-Y format)
            if (!voiceGameEntry.gameData.score) {
                setTimeout(() => runVoiceGameStep(6), 100);
                return;
            }
            prompt = getVoiceGameText('step5b_prompt');
            skipBtn.style.display = 'inline-block';
            break;

        case '5b_set': // Individual set score entry
            const setNum = voiceGameEntry.currentDetailedSet;
            prompt = getVoiceGameText('step5b_setPrompt').replace('{setNumber}', setNum);
            skipBtn.style.display = 'inline-block';
            break;

        case '5b_confirm': // Confirm inconsistent detailed score
            prompt = getVoiceGameText('step5b_inconsistent')
                .replace('{setsScore}', voiceGameEntry.gameData.score)
                .replace('{detailedWins}', voiceGameEntry.detailedWins || 0)
                .replace('{detailedLosses}', voiceGameEntry.detailedLosses || 0);
            break;

        case 6: // Location (optional)
            prompt = getVoiceGameText('step6_prompt');
            skipBtn.style.display = 'inline-block';
            break;

        case 7: // Notes (optional)
            prompt = getVoiceGameText('step7_prompt');
            skipBtn.style.display = 'inline-block';
            break;

        case 8: // Confirmation
            const result = voiceGameEntry.gameData.result === 'win' ? getVoiceGameText('labelVictory') :
                          voiceGameEntry.gameData.result === 'loss' ? getVoiceGameText('labelDefeat') :
                          getVoiceGameText('labelDraw');

            const gameTypeLabel = voiceGameEntry.gameData.game_type === 'doubles' ?
                getVoiceGameText('labelDoubles') : getVoiceGameText('labelSingles');

            let playersText = voiceGameEntry.gameData.opponent_name;
            if (voiceGameEntry.gameData.game_type === 'doubles') {
                playersText = `vs ${voiceGameEntry.gameData.opponent_name} & ${voiceGameEntry.gameData.opponent2_name}`;
                playersText += `\n🤝 ${voiceGameEntry.gameData.partner_name}`;
            }

            const scoreText = voiceGameEntry.gameData.score ? `\n📊 ${voiceGameEntry.gameData.score}` : '';
            const locationText = voiceGameEntry.gameData.location ? `\n📍 ${voiceGameEntry.gameData.location}` : '';

            prompt = getVoiceGameText('step8_prompt')
                .replace('{date}', formatDateForVoice(voiceGameEntry.gameData.game_date))
                .replace('{gameType}', gameTypeLabel)
                .replace('{players}', playersText)
                .replace('{result}', result)
                .replace('{score}', scoreText)
                .replace('{location}', locationText);
            break;
    }

    promptEl.innerHTML = prompt.replace(/\n/g, '<br>');
    setTimeout(() => startVoiceGameListening(step), 500);
}

/**
 * Start listening
 */
function startVoiceGameListening(step) {
    clearListeningTimeout();
    if (!voiceGameEntry.recognition) {
        voiceGameEntry.recognition = initVoiceGameRecognition();
    }
    if (!voiceGameEntry.recognition) {
        showVoiceGameError(getVoiceGameText('errorMicrophone'));
        return;
    }

    const indicatorEl = document.getElementById('voiceGameIndicator');
    const responseEl = document.getElementById('voiceGameResponse');
    const retryBtn = document.getElementById('voiceGameRetryBtn');

    indicatorEl.classList.add('listening');
    responseEl.textContent = getVoiceGameText('listening');
    retryBtn.style.display = 'none';
    document.getElementById('voiceGameManualInput').style.display = 'none';

    voiceGameEntry.recognition.lang = getVoiceGameLang();
    let gotResponse = false;

    voiceGameEntry.recognition.onresult = (event) => {
        gotResponse = true;
        clearListeningTimeout();
        const transcript = event.results[0][0].transcript;
        indicatorEl.classList.remove('listening');
        responseEl.textContent = `"${transcript}"`;
        processVoiceGameInput(step, transcript);
    };

    voiceGameEntry.recognition.onerror = (event) => {
        gotResponse = true;
        clearListeningTimeout();
        indicatorEl.classList.remove('listening');
        if (event.error === 'aborted') return;
        responseEl.textContent = event.error === 'no-speech' ?
            getVoiceGameText('errorNoSpeech') : getVoiceGameText('errorMicrophone');
        retryBtn.style.display = 'inline-block';
        setTimeout(() => toggleManualInput(), 500);
    };

    voiceGameEntry.recognition.onend = () => {
        indicatorEl.classList.remove('listening');
        if (!gotResponse) {
            clearListeningTimeout();
            responseEl.textContent = getVoiceGameText('errorMicStuck');
            retryBtn.style.display = 'inline-block';
            setTimeout(() => toggleManualInput(), 300);
        }
    };

    try {
        voiceGameEntry.recognition.start();
        voiceGameEntry.listeningTimeout = setTimeout(() => {
            if (!gotResponse) {
                indicatorEl.classList.remove('listening');
                responseEl.textContent = getVoiceGameText('errorMicStuck');
                retryBtn.style.display = 'inline-block';
                setTimeout(() => toggleManualInput(), 300);
            }
        }, 8000);
    } catch (e) {
        clearListeningTimeout();
        indicatorEl.classList.remove('listening');
        retryBtn.style.display = 'inline-block';
        setTimeout(() => toggleManualInput(), 500);
    }
}

/**
 * Restart voice listening
 */
function restartVoiceListening() {
    clearListeningTimeout();
    if (voiceGameEntry.recognition) {
        try { voiceGameEntry.recognition.abort(); } catch(e) {}
        voiceGameEntry.recognition = null;
    }
    document.getElementById('voiceGameManualInput').style.display = 'none';
    document.getElementById('voiceGameRetryBtn').style.display = 'none';
    setTimeout(() => startVoiceGameListening(voiceGameEntry.currentStep), 200);
}

/**
 * Retry step
 */
function retryVoiceGameStep() {
    runVoiceGameStep(voiceGameEntry.currentStep);
}

/**
 * Skip step
 */
function skipVoiceGameStep() {
    const step = voiceGameEntry.currentStep;
    const responseEl = document.getElementById('voiceGameResponse');

    if (step === 5) {
        responseEl.textContent = getVoiceGameText('step5_skipped');
        setTimeout(() => runVoiceGameStep(6), 1000);
    } else if (step === '5b' || step === '5b_set' || step === '5b_confirm') {
        responseEl.textContent = getVoiceGameText('step5b_skipped');
        voiceGameEntry.detailedScoreSets = [];
        voiceGameEntry.gameData.detailed_score = null;
        setTimeout(() => runVoiceGameStep(6), 1000);
    } else if (step === 6) {
        responseEl.textContent = getVoiceGameText('step6_skipped');
        setTimeout(() => runVoiceGameStep(7), 1000);
    } else if (step === 7) {
        responseEl.textContent = getVoiceGameText('step7_skipped');
        setTimeout(() => runVoiceGameStep(8), 1000);
    }
}

/**
 * Process voice input
 */
function processVoiceGameInput(step, transcript) {
    const responseEl = document.getElementById('voiceGameResponse');
    const setResponse = (text) => { responseEl.innerHTML = text.replace(/\n/g, '<br>'); };

    switch(step) {
        case 1: // Date
            if (matchesKeywords(transcript, 'yes')) {
                setResponse(getVoiceGameText('step1_confirm')
                    .replace('{date}', formatDateForVoice(voiceGameEntry.gameData.game_date)));
                setTimeout(() => runVoiceGameStep(2), 1500);
            } else {
                const newDate = parseDateFromVoice(transcript);
                if (newDate) {
                    voiceGameEntry.gameData.game_date = newDate;
                    setResponse(getVoiceGameText('step1_updated')
                        .replace('{date}', formatDateForVoice(newDate)));
                    setTimeout(() => runVoiceGameStep(2), 1500);
                } else {
                    setResponse(getVoiceGameText('errorNotUnderstood'));
                    document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
                }
            }
            break;

        case 2: // Game type
            if (matchesKeywords(transcript, 'singles') || transcript.toLowerCase() === 'singles') {
                voiceGameEntry.gameData.game_type = 'singles';
                setResponse(getVoiceGameText('step2_singles'));
                setTimeout(() => runVoiceGameStep(3), 1500);
            } else if (matchesKeywords(transcript, 'doubles') || transcript.toLowerCase() === 'doubles') {
                voiceGameEntry.gameData.game_type = 'doubles';
                setResponse(getVoiceGameText('step2_doubles'));
                setTimeout(() => runVoiceGameStep(3), 1500);
            } else {
                setResponse(getVoiceGameText('errorNotUnderstood'));
                document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
            }
            break;

        case 3: // Opponent
            handlePlayerSearch(transcript, 'opponent', (player) => {
                voiceGameEntry.gameData.opponent_id = player.id;
                voiceGameEntry.gameData.opponent_name = player.name;
                setResponse(getVoiceGameText('step3_confirmed').replace('{name}', player.name));

                if (voiceGameEntry.gameData.game_type === 'doubles') {
                    setTimeout(() => runVoiceGameStep('3b'), 1500);
                } else {
                    setTimeout(() => runVoiceGameStep(4), 1500);
                }
            });
            break;

        case '3b': // Second opponent (doubles)
            handlePlayerSearch(transcript, 'opponent2', (player) => {
                voiceGameEntry.gameData.opponent2_id = player.id;
                voiceGameEntry.gameData.opponent2_name = player.name;
                setResponse(getVoiceGameText('step3b_confirmed').replace('{name}', player.name));
                setTimeout(() => runVoiceGameStep('3c'), 1500);
            });
            break;

        case '3c': // Partner (doubles)
            handlePlayerSearch(transcript, 'partner', (player) => {
                voiceGameEntry.gameData.partner_id = player.id;
                voiceGameEntry.gameData.partner_name = player.name;
                setResponse(getVoiceGameText('step3c_confirmed').replace('{name}', player.name));
                setTimeout(() => runVoiceGameStep(4), 1500);
            });
            break;

        case 4: // Result
            if (matchesKeywords(transcript, 'won')) {
                voiceGameEntry.gameData.result = 'win';
                setResponse(getVoiceGameText('step4_won'));
                setTimeout(() => runVoiceGameStep(5), 1500);
            } else if (matchesKeywords(transcript, 'lost')) {
                voiceGameEntry.gameData.result = 'loss';
                setResponse(getVoiceGameText('step4_lost'));
                setTimeout(() => runVoiceGameStep(5), 1500);
            } else if (matchesKeywords(transcript, 'draw')) {
                voiceGameEntry.gameData.result = 'draw';
                setResponse(getVoiceGameText('step4_draw'));
                setTimeout(() => runVoiceGameStep(5), 1500);
            } else {
                setResponse(getVoiceGameText('errorNotUnderstood'));
                document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
            }
            break;

        case 5: // Score
            if (matchesKeywords(transcript, 'skip') || matchesKeywords(transcript, 'no')) {
                setResponse(getVoiceGameText('step5_skipped'));
                setTimeout(() => runVoiceGameStep(6), 1500);
            } else {
                // Convert spoken numbers to digits (e.g., "dois a quatro" -> "2-4")
                const convertedScore = convertSpokenNumbersToDigits(transcript);
                voiceGameEntry.gameData.score = convertedScore;
                setResponse(getVoiceGameText('step5_confirmed').replace('{score}', convertedScore));
                // Go to detailed score step instead of location
                setTimeout(() => runVoiceGameStep('5b'), 1500);
            }
            break;

        case '5b': // Ask if user wants detailed score
            if (matchesKeywords(transcript, 'yes')) {
                // Parse score to get number of sets
                const scoreParts = voiceGameEntry.gameData.score.split('-');
                if (scoreParts.length === 2) {
                    const setsWon = parseInt(scoreParts[0]) || 0;
                    const setsLost = parseInt(scoreParts[1]) || 0;
                    const totalSets = setsWon + setsLost;

                    if (totalSets > 0) {
                        voiceGameEntry.detailedScoreSets = [];
                        voiceGameEntry.currentDetailedSet = 1;
                        setResponse(getVoiceGameText('step5b_setPrompt').replace('{setNumber}', '1'));
                        setTimeout(() => runVoiceGameStep('5b_set'), 1500);
                    } else {
                        setResponse(getVoiceGameText('step5b_skipped'));
                        setTimeout(() => runVoiceGameStep(6), 1500);
                    }
                } else {
                    setResponse(getVoiceGameText('step5b_skipped'));
                    setTimeout(() => runVoiceGameStep(6), 1500);
                }
            } else if (matchesKeywords(transcript, 'skip') || matchesKeywords(transcript, 'no')) {
                setResponse(getVoiceGameText('step5b_skipped'));
                setTimeout(() => runVoiceGameStep(6), 1500);
            } else {
                setResponse(getVoiceGameText('errorNotUnderstood'));
                document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
            }
            break;

        case '5b_set': // Individual set score
            if (matchesKeywords(transcript, 'skip') || matchesKeywords(transcript, 'no')) {
                // Skip remaining sets
                setResponse(getVoiceGameText('step5b_skipped'));
                voiceGameEntry.detailedScoreSets = [];
                setTimeout(() => runVoiceGameStep(6), 1500);
            } else {
                // Parse set score
                const setScore = convertSpokenNumbersToDigits(transcript);
                const setNum = voiceGameEntry.currentDetailedSet;

                // Store the set score
                voiceGameEntry.detailedScoreSets.push(setScore);
                setResponse(getVoiceGameText('step5b_setConfirmed')
                    .replace('{setNumber}', setNum)
                    .replace('{setScore}', setScore));

                // Check if we have more sets to record
                const scoreParts = voiceGameEntry.gameData.score.split('-');
                const totalSets = (parseInt(scoreParts[0]) || 0) + (parseInt(scoreParts[1]) || 0);

                if (setNum < totalSets) {
                    // More sets to record
                    voiceGameEntry.currentDetailedSet++;
                    setTimeout(() => runVoiceGameStep('5b_set'), 1500);
                } else {
                    // All sets recorded - validate consistency
                    const detailedScore = voiceGameEntry.detailedScoreSets.join(',');
                    voiceGameEntry.gameData.detailed_score = detailedScore;

                    // Count wins and losses from detailed scores
                    let detailedWins = 0;
                    let detailedLosses = 0;
                    voiceGameEntry.detailedScoreSets.forEach(setScore => {
                        const parts = setScore.split('-');
                        if (parts.length === 2) {
                            const myScore = parseInt(parts[0]) || 0;
                            const oppScore = parseInt(parts[1]) || 0;
                            if (myScore > oppScore) detailedWins++;
                            else if (oppScore > myScore) detailedLosses++;
                        }
                    });

                    // Check if consistent with sets score
                    const expectedWins = parseInt(scoreParts[0]) || 0;
                    const expectedLosses = parseInt(scoreParts[1]) || 0;

                    if (detailedWins === expectedWins && detailedLosses === expectedLosses) {
                        // Consistent - proceed normally
                        setResponse(getVoiceGameText('step5b_allSetsConfirmed')
                            .replace('{detailedScore}', detailedScore));
                        setTimeout(() => runVoiceGameStep(6), 1500);
                    } else {
                        // Inconsistent - show warning and ask for confirmation
                        voiceGameEntry.detailedWins = detailedWins;
                        voiceGameEntry.detailedLosses = detailedLosses;
                        setResponse(getVoiceGameText('step5b_inconsistent')
                            .replace('{setsScore}', voiceGameEntry.gameData.score)
                            .replace('{detailedWins}', detailedWins)
                            .replace('{detailedLosses}', detailedLosses));
                        setTimeout(() => runVoiceGameStep('5b_confirm'), 1500);
                    }
                }
            }
            break;

        case '5b_confirm': // Confirm inconsistent detailed score
            if (matchesKeywords(transcript, 'yes')) {
                // User wants to save anyway
                setResponse(getVoiceGameText('step5b_allSetsConfirmed')
                    .replace('{detailedScore}', voiceGameEntry.gameData.detailed_score));
                setTimeout(() => runVoiceGameStep(6), 1500);
            } else if (matchesKeywords(transcript, 'no')) {
                // User wants to redo - clear detailed scores and go back to 5b
                voiceGameEntry.detailedScoreSets = [];
                voiceGameEntry.currentDetailedSet = 0;
                voiceGameEntry.gameData.detailed_score = null;
                setResponse(getVoiceGameText('step5b_skipped'));
                setTimeout(() => runVoiceGameStep('5b'), 1500);
            } else {
                setResponse(getVoiceGameText('errorNotUnderstood'));
                document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
            }
            break;

        case 6: // Location
            if (matchesKeywords(transcript, 'skip') || matchesKeywords(transcript, 'no')) {
                setResponse(getVoiceGameText('step6_skipped'));
                setTimeout(() => runVoiceGameStep(7), 1500);
            } else {
                // Try to find matching existing location
                const match = findMatchingLocation(transcript);
                if (match) {
                    // Found a similar existing location - use it
                    voiceGameEntry.gameData.location = match.location;
                    console.log(`Location fuzzy match: "${transcript}" -> "${match.location}" (${Math.round(match.similarity * 100)}%)`);
                    setResponse(getVoiceGameText('step6_saved').replace('{location}', match.location));
                } else {
                    // No match found - use transcript as-is
                    voiceGameEntry.gameData.location = transcript;
                    setResponse(getVoiceGameText('step6_saved').replace('{location}', transcript));
                }
                setTimeout(() => runVoiceGameStep(7), 1500);
            }
            break;

        case 7: // Notes
            if (matchesKeywords(transcript, 'yes')) {
                voiceGameEntry.recordingObservations = true;
                startRecordingObservations();
            } else if (matchesKeywords(transcript, 'no') || matchesKeywords(transcript, 'skip')) {
                setResponse(getVoiceGameText('step7_skipped'));
                setTimeout(() => runVoiceGameStep(8), 1500);
            } else {
                voiceGameEntry.pendingObservation = transcript;
                showObservationConfirmation(transcript);
            }
            break;

        case 8: // Confirmation
            if (matchesKeywords(transcript, 'yes')) {
                saveVoiceGame();
            } else if (matchesKeywords(transcript, 'no')) {
                setResponse(getVoiceGameText('step8_cancelled'));
                setTimeout(() => closeVoiceGameModal(), 1500);
            } else {
                setResponse(getVoiceGameText('errorNotUnderstood'));
                document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
            }
            break;
    }
}

/**
 * Handle player search
 */
function handlePlayerSearch(transcript, playerType, onSelect) {
    const responseEl = document.getElementById('voiceGameResponse');
    const matches = searchPlayerByVoice(transcript);

    if (matches.length === 1) {
        responseEl.innerHTML = getVoiceGameText('step3_found')
            .replace('{name}', matches[0].name).replace(/\n/g, '<br>');
        showPlayerOptions(matches, onSelect);
    } else if (matches.length > 1) {
        responseEl.innerHTML = getVoiceGameText('step3_multiple')
            .replace('{count}', matches.length).replace(/\n/g, '<br>');
        showPlayerOptions(matches, onSelect);
    } else {
        responseEl.innerHTML = getVoiceGameText('step3_notFound')
            .replace('{name}', transcript).replace(/\n/g, '<br>');
        document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
        toggleManualInput();
    }
}

/**
 * Show player options as buttons
 */
function showPlayerOptions(players, onSelect) {
    const responseEl = document.getElementById('voiceGameResponse');
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 15px;';

    players.forEach(player => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-opponent-option';
        btn.textContent = player.name;
        btn.onclick = () => onSelect(player);
        container.appendChild(btn);
    });

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn-secondary';
    retryBtn.style.marginTop = '10px';
    retryBtn.textContent = getVoiceGameText('btnTryOtherName');
    retryBtn.onclick = () => runVoiceGameStep(voiceGameEntry.currentStep);
    container.appendChild(retryBtn);

    responseEl.appendChild(container);
}

/**
 * Start recording observations
 */
function startRecordingObservations() {
    clearListeningTimeout();
    const responseEl = document.getElementById('voiceGameResponse');
    const indicatorEl = document.getElementById('voiceGameIndicator');

    responseEl.innerHTML = getVoiceGameText('step7_recording');

    if (voiceGameEntry.recognition) {
        try { voiceGameEntry.recognition.abort(); } catch(e) {}
        voiceGameEntry.recognition = null;
    }

    setTimeout(() => {
        voiceGameEntry.recognition = initVoiceGameRecognition();
        if (!voiceGameEntry.recognition) {
            voiceGameEntry.recordingObservations = false;
            responseEl.textContent = getVoiceGameText('errorMicrophone');
            return;
        }

        indicatorEl.classList.add('listening');

        voiceGameEntry.recognition.onresult = (event) => {
            voiceGameEntry.recordingObservations = false;
            clearListeningTimeout();
            indicatorEl.classList.remove('listening');
            voiceGameEntry.pendingObservation = event.results[0][0].transcript;
            showObservationConfirmation(voiceGameEntry.pendingObservation);
        };

        voiceGameEntry.recognition.onerror = (event) => {
            voiceGameEntry.recordingObservations = false;
            clearListeningTimeout();
            indicatorEl.classList.remove('listening');
            if (event.error !== 'aborted') {
                responseEl.textContent = getVoiceGameText('errorMicrophone');
            }
        };

        voiceGameEntry.recognition.onend = () => {
            indicatorEl.classList.remove('listening');
        };

        try {
            voiceGameEntry.recognition.start();
            voiceGameEntry.listeningTimeout = setTimeout(() => {
                voiceGameEntry.recordingObservations = false;
                indicatorEl.classList.remove('listening');
                responseEl.textContent = getVoiceGameText('errorMicStuck');
            }, 8000);
        } catch(e) {
            voiceGameEntry.recordingObservations = false;
            responseEl.textContent = getVoiceGameText('errorMicrophone');
        }
    }, 500);
}

/**
 * Show observation confirmation
 */
function showObservationConfirmation(transcript) {
    const responseEl = document.getElementById('voiceGameResponse');
    responseEl.innerHTML = getVoiceGameText('step7_confirm').replace('{text}', transcript);

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; justify-content: center;';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'btn-primary';
    yesBtn.innerHTML = getVoiceGameText('btnYes');
    yesBtn.onclick = () => {
        voiceGameEntry.gameData.notes = voiceGameEntry.pendingObservation;
        responseEl.innerHTML = getVoiceGameText('step7_saved');
        setTimeout(() => runVoiceGameStep(8), 1500);
    };
    container.appendChild(yesBtn);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn-secondary';
    retryBtn.innerHTML = getVoiceGameText('btnRetryObservation');
    retryBtn.onclick = () => startRecordingObservations();
    container.appendChild(retryBtn);

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'btn-secondary';
    skipBtn.innerHTML = getVoiceGameText('btnSkip');
    skipBtn.onclick = () => {
        voiceGameEntry.gameData.notes = null;
        responseEl.innerHTML = getVoiceGameText('step7_skipped');
        setTimeout(() => runVoiceGameStep(8), 1500);
    };
    container.appendChild(skipBtn);

    responseEl.appendChild(container);
}

/**
 * Save game via API
 */
async function saveVoiceGame() {
    const responseEl = document.getElementById('voiceGameResponse');
    responseEl.innerHTML = getVoiceGameText('processing');

    try {
        const token = window.currentToken || localStorage.getItem('token');
        const sport = window.currentSport;

        const gameDate = voiceGameEntry.gameData.game_date;
        const formattedDate = `${gameDate.getFullYear()}-${String(gameDate.getMonth() + 1).padStart(2, '0')}-${String(gameDate.getDate()).padStart(2, '0')}`;

        const gameData = {
            sport: sport,
            game_type: voiceGameEntry.gameData.game_type,
            opponent_id: voiceGameEntry.gameData.opponent_id,
            opponent2_id: voiceGameEntry.gameData.opponent2_id,
            partner_id: voiceGameEntry.gameData.partner_id,
            game_date: formattedDate,
            result: voiceGameEntry.gameData.result,
            score: voiceGameEntry.gameData.score,
            detailed_score: voiceGameEntry.gameData.detailed_score,
            location: voiceGameEntry.gameData.location,
            notes: voiceGameEntry.gameData.notes
        };

        const response = await fetch(`${API_URL}/api/games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(gameData)
        });

        if (response.ok) {
            responseEl.innerHTML = getVoiceGameText('step8_saved');
            if (typeof loadGames === 'function') loadGames();
            if (typeof loadStatistics === 'function') loadStatistics();
            setTimeout(() => closeVoiceGameModal(), 2000);
        } else {
            const error = await response.json();
            responseEl.textContent = `❌ Erro: ${error.detail || 'Falha ao salvar'}`;
            document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Error saving game:', error);
        responseEl.textContent = `❌ Erro: ${error.message}`;
        document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
    }
}

/**
 * Show error
 */
function showVoiceGameError(message) {
    const responseEl = document.getElementById('voiceGameResponse');
    if (responseEl) responseEl.textContent = message;
    document.getElementById('voiceGameRetryBtn').style.display = 'inline-block';
}

// Export to global scope
window.openVoiceGameModal = openVoiceGameModal;
window.closeVoiceGameModal = closeVoiceGameModal;
window.restartVoiceListening = restartVoiceListening;
