# Racket Pro Analyzer (RPA)

Aplicativo para registro e análise de partidas de esportes de raquete, com suporte a jogos de simples e duplas.

## Esportes Suportados

- 🏓 Tênis de Mesa (Simples e Duplas)
- 🏸 Badminton (Simples e Duplas)
- 🎾 Tênis (Simples e Duplas)
- 🟠 Squash (Simples)
- 🏓 Padel (Duplas)
- 🏖️ Beach Tennis (Duplas)
- 🥒 Pickleball (Simples e Duplas)

## Funcionalidades

- ✅ Registro de jogos (simples e duplas)
- ✅ Cadastro de jogadores (adversários e parceiros)
- ✅ Estatísticas detalhadas
- ✅ Análise por adversário
- ✅ Análise por parceiro (duplas)
- ✅ Gráficos de evolução
- ✅ Suporte a 3 idiomas (PT, EN, JP)

## Desenvolvimento Local

```bash
# Instalar dependências
pip install -r requirements.txt

# Rodar servidor
uvicorn api.main:app --reload --port 8000
```

## Deploy

```bash
# Build e deploy no Cloud Run
gcloud run deploy racket-pro-analyzer --source .
```

## Estrutura do Projeto

```
racket-pro-analyzer/
├── api/
│   ├── main.py           # FastAPI backend
│   ├── models.py         # Modelos de dados
│   └── database.py       # Conexão com banco
├── static/
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── games.js
│   │   ├── sports.js
│   │   └── i18n.js
│   ├── images/
│   └── locales/
│       ├── pt-BR.json
│       ├── en-US.json
│       └── ja-JP.json
├── index.html
├── login.html
├── games.html
├── Dockerfile
├── requirements.txt
└── PROJETO_RPA.md        # Documentação do projeto
```

## Licença

MIT
