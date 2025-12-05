# Racket Pro Analyzer (RPA) - Documento de Projeto

## Visão Geral

O Racket Pro Analyzer é um aplicativo para registro e análise de partidas de esportes de raquete, com suporte a jogos de simples e duplas.

---

## Diferença entre TTPA e RPA

| Funcionalidade | TTPA | RPA |
|----------------|------|-----|
| Histórico de Jogos | ✅ | ✅ |
| Cadastro de Adversários | ✅ (detalhado: borracha, estilo, empunhadura) | ✅ (simplificado) |
| Estatísticas e Gráficos | ✅ | ✅ |
| Jogos de Simples | ✅ | ✅ |
| Jogos de Duplas | ❌ | ✅ |
| Análise de Parceiros | ❌ | ✅ |
| GameScope AI | ✅ | ❌ |
| Análise de Movimentos | ✅ | ❌ |
| Multi-esporte | ❌ | ✅ |

**Posicionamento:**
- **TTPA** = App especializado em tênis de mesa (análise profunda + IA)
- **RPA** = App genérico para todos os esportes de raquete (foco em histórico + duplas)

---

## Esportes Suportados

| Esporte | Simples | Duplas | Pontuação |
|---------|---------|--------|-----------|
| 🏓 Tênis de Mesa | ✅ | ✅ | Sets até 11 pontos, melhor de 5 ou 7 |
| 🏸 Badminton | ✅ | ✅ | Sets até 21 pontos, melhor de 3 |
| 🎾 Tênis | ✅ | ✅ | Games/Sets (15-30-40, 6 games = 1 set) |
| 🟠 Squash | ✅ | ❌ | Sets até 11 pontos, melhor de 5 |
| 🏓 Padel | ❌ | ✅ | Games/Sets como tênis, melhor de 3 |
| 🏖️ Beach Tennis | ❌ | ✅ | Games/Sets como tênis |
| 🥒 Pickleball | ✅ | ✅ | Sets até 11 pontos, melhor de 3 |

---

## Lógica de Análise para Duplas

### Conceito Principal

Em jogos de duplas, a análise continua sendo **1 para 1**:
- Análise do usuário vs cada adversário individualmente
- Análise do usuário com cada parceiro

```
DUPLAS: Você + Parceiro vs Adversário1 + Adversário2
                │              │            │
                │              ▼            ▼
                │         Análise 1:1   Análise 1:1
                │         (vs Adv1)     (vs Adv2)
                ▼
          Análise de parceria
          (com Parceiro)
```

### Registro de Partida de Duplas

| Campo | Valor Exemplo |
|-------|---------------|
| Tipo | Duplas |
| Parceiro | Maria |
| Adversário 1 | João |
| Adversário 2 | Pedro |
| Resultado | Vitória 6-4, 6-3 |

### Análises Possíveis

**1. Contra cada adversário (individual):**
- "Contra João: 5 vitórias, 2 derrotas (71%)"
- "Contra Pedro: 3 vitórias, 4 derrotas (43%)"

**2. Com cada parceiro:**
- "Com Maria: 8 vitórias, 3 derrotas (73%)"
- "Com Carlos: 2 vitórias, 5 derrotas (29%)"

**3. Estatísticas gerais:**
- Total de jogos em duplas vs simples
- Taxa de vitória por tipo de jogo

---

## Modelo de Dados

### Tabela: opponents

```
- id
- user_id
- sport (table_tennis, badminton, tennis, squash, padel, beach_tennis, pickleball)
- name
- dominant_hand (right, left)
- level (beginner, intermediate, advanced, professional)
- play_style (offensive, defensive, all_around)
- notes
- created_at
- updated_at
```

### Tabela: games

```
- id
- user_id
- sport
- game_type (singles, doubles)
- opponent_id (adversário principal ou adversário 1 em duplas)
- opponent2_id (adversário 2 em duplas, NULL para simples)
- partner_id (parceiro em duplas, NULL para simples)
- game_date
- result (win, loss, draw)
- score (JSON ou texto - flexível por esporte)
- location
- notes
- created_at
- updated_at
```

---

## Configuração de Pontuação por Esporte

```javascript
const SPORTS_CONFIG = {
    table_tennis: {
        name: "Tênis de Mesa",
        icon: "🏓",
        scoreType: "sets",
        maxSets: 7,
        pointsToWin: 11,
        gameTypes: ["singles", "doubles"]
    },
    badminton: {
        name: "Badminton",
        icon: "🏸",
        scoreType: "sets",
        maxSets: 3,
        pointsToWin: 21,
        gameTypes: ["singles", "doubles"]
    },
    tennis: {
        name: "Tênis",
        icon: "🎾",
        scoreType: "tennis",
        maxSets: 5,
        gameTypes: ["singles", "doubles"]
    },
    squash: {
        name: "Squash",
        icon: "🟠",
        scoreType: "sets",
        maxSets: 5,
        pointsToWin: 11,
        gameTypes: ["singles"]
    },
    padel: {
        name: "Padel",
        icon: "🏓",
        scoreType: "tennis",
        maxSets: 3,
        gameTypes: ["doubles"]
    },
    beach_tennis: {
        name: "Beach Tennis",
        icon: "🏖️",
        scoreType: "tennis",
        maxSets: 3,
        gameTypes: ["doubles"]
    },
    pickleball: {
        name: "Pickleball",
        icon: "🥒",
        scoreType: "sets",
        maxSets: 3,
        pointsToWin: 11,
        gameTypes: ["singles", "doubles"]
    }
};
```

---

## Campos do Adversário (Simplificado)

Diferente do TTPA que tem campos específicos de tênis de mesa (borracha, empunhadura), o RPA usa campos genéricos:

| Campo | Opções |
|-------|--------|
| Nome | Texto livre |
| Mão dominante | Destro / Canhoto |
| Nível | Iniciante / Intermediário / Avançado / Profissional |
| Estilo de jogo | Ofensivo / Defensivo / Equilibrado |
| Notas | Texto livre |

---

## Interface - Telas Principais

### 1. Tela de Seleção de Esporte (Home)

```
┌─────────────────────────────────────────┐
│  🏸 Racket Pro Analyzer                 │
├─────────────────────────────────────────┤
│  Escolha seu esporte:                   │
│                                         │
│  🏓 Tênis de Mesa  🏸 Badminton         │
│  🎾 Tênis          🟠 Squash            │
│  🏓 Padel          🏖️ Beach Tennis      │
│  🥒 Pickleball                          │
└─────────────────────────────────────────┘
```

### 2. Tela Principal do Esporte

```
┌─────────────────────────────────────────┐
│ 🏸 Badminton               [PT|EN|JP]   │
├─────────────────────────────────────────┤
│ 📈 Estatísticas                         │
│ ┌─────┬─────┬─────┬─────┐              │
│ │ 🏆  │ ❌  │ 📊  │ 👥  │              │
│ │ 15  │  8  │ 65% │ 12  │              │
│ │Wins │Loss │Rate │Opp. │              │
│ └─────┴─────┴─────┴─────┘              │
├─────────────────────────────────────────┤
│ [➕ Novo Jogo] [👥 Adversários]         │
│ [📊 Gráficos] [🤝 Parceiros]            │
├─────────────────────────────────────────┤
│ 📋 Histórico                            │
│ ┌─────────────────────────────────────┐ │
│ │ 25/11 🏆 Simples vs João    2-0    │ │
│ │ 23/11 ❌ Duplas c/ Maria    1-2    │ │
│ │       vs Pedro + Ana               │ │
│ │ 20/11 🏆 Simples vs Carlos  2-1    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3. Modal: Registrar Jogo de Simples

```
┌─────────────────────────────────────────┐
│ ➕ Registrar Jogo - Badminton           │
├─────────────────────────────────────────┤
│ Data: [25/11/2025]                      │
│                                         │
│ Tipo: ● Simples  ○ Duplas               │
│                                         │
│ Adversário: [João Silva ▼] [+ Novo]     │
│                                         │
│ Resultado:                              │
│ ┌─────────────────────────────────────┐ │
│ │ Set 1: Você [21] x [15] Adversário  │ │
│ │ Set 2: Você [21] x [18] Adversário  │ │
│ │ Set 3: Você [  ] x [  ] Adversário  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Local: [Clube ABC           ]           │
│ Notas: [                    ]           │
│                                         │
│      [Cancelar]  [💾 Salvar]            │
└─────────────────────────────────────────┘
```

### 4. Modal: Registrar Jogo de Duplas

```
┌─────────────────────────────────────────┐
│ ➕ Registrar Jogo - Badminton           │
├─────────────────────────────────────────┤
│ Data: [25/11/2025]                      │
│                                         │
│ Tipo: ○ Simples  ● Duplas               │
│                                         │
│ 🤝 SEU TIME                             │
│ Parceiro: [Maria Santos ▼] [+ Novo]     │
│                                         │
│ 👥 TIME ADVERSÁRIO                      │
│ Adversário 1: [João Silva ▼] [+ Novo]   │
│ Adversário 2: [Pedro Lima ▼] [+ Novo]   │
│                                         │
│ Resultado:                              │
│ ┌─────────────────────────────────────┐ │
│ │ Set 1: Vocês [21] x [18] Eles       │ │
│ │ Set 2: Vocês [19] x [21] Eles       │ │
│ │ Set 3: Vocês [21] x [15] Eles       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Local: [Clube ABC           ]           │
│ Notas: [                    ]           │
│                                         │
│      [Cancelar]  [💾 Salvar]            │
└─────────────────────────────────────────┘
```

### 5. Modal: Cadastrar Adversário/Parceiro

```
┌─────────────────────────────────────────┐
│ 👥 Novo Jogador                         │
├─────────────────────────────────────────┤
│ Nome: [                    ]            │
│                                         │
│ Mão dominante:                          │
│ ○ Destro  ○ Canhoto                     │
│                                         │
│ Nível:                                  │
│ ○ Iniciante  ○ Intermediário            │
│ ○ Avançado   ○ Profissional             │
│                                         │
│ Estilo de jogo:                         │
│ ○ Ofensivo  ○ Defensivo  ○ Equilibrado  │
│                                         │
│ Notas: [                    ]           │
│                                         │
│      [Cancelar]  [💾 Salvar]            │
└─────────────────────────────────────────┘
```

---

## Análises e Gráficos

### Gráficos Disponíveis

1. **Evolução de Vitórias** - Linha do tempo
2. **Taxa de Vitória por Adversário** - Barras
3. **Taxa de Vitória por Parceiro** - Barras (duplas)
4. **Simples vs Duplas** - Pizza
5. **Vitórias por Nível de Adversário** - Barras
6. **Desempenho contra Canhotos vs Destros** - Barras

### Filtros

- Por período (últimos 30 dias, 3 meses, 1 ano, todos)
- Por tipo de jogo (simples, duplas, todos)
- Por adversário específico
- Por parceiro específico

---

## Idiomas Suportados

- 🇧🇷 Português (Brasil) - pt-BR
- 🇺🇸 English (US) - en-US
- 🇯🇵 日本語 (Japanese) - ja-JP

---

## Infraestrutura

### Estrutura de Pastas

```
racket-pro-analyzer/
├── api/
│   ├── main.py           # FastAPI backend
│   ├── models.py         # Modelos de dados
│   └── database.py       # Conexão com banco
├── static/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js        # Lógica principal
│   │   ├── i18n.js       # Internacionalização
│   │   └── sports.js     # Configuração de esportes
│   ├── images/
│   │   └── (ícones e bandeiras)
│   └── locales/
│       ├── pt-BR.json
│       ├── en-US.json
│       └── ja-JP.json
├── templates/
│   └── (páginas HTML se necessário)
├── index.html            # Página principal
├── games.html            # Histórico de jogos
├── login.html            # Login
├── Dockerfile
├── requirements.txt
└── README.md
```

### Deploy

- **Backend:** Google Cloud Run
- **App Android:** TWA com Bubblewrap (Play Store)
- **Domínio:** racket-pro-analyzer-xxx.run.app

---

## Roadmap de Desenvolvimento

### Fase 1 - MVP
- [ ] Estrutura básica do projeto
- [ ] Autenticação (Google OAuth)
- [ ] Seleção de esporte
- [ ] Cadastro de jogadores (adversários/parceiros)
- [ ] Registro de jogos (simples)
- [ ] Estatísticas básicas

### Fase 2 - Duplas
- [ ] Registro de jogos de duplas
- [ ] Análise com parceiros
- [ ] Gráficos de parceria

### Fase 3 - Polimento
- [ ] Traduções completas (PT, EN, JP)
- [ ] Gráficos avançados
- [ ] PWA / TWA para Play Store

### Fase 4 - Expansão
- [ ] Mais idiomas
- [ ] Funcionalidades sociais (desafios, ranking)
- [ ] Integração com TTPA (importar dados de tênis de mesa)

---

## Notas Adicionais

- O código será baseado no TTPA, reutilizando ~50-70% da estrutura
- Projetos separados para evitar conflitos (pastas diferentes)
- Mesmo estilo visual e UX do TTPA para consistência

---

*Documento criado em: 26/11/2025*
*Última atualização: 26/11/2025*
