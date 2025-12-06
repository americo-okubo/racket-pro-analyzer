# Dockerfile para Racket Pro Analyzer - Google Cloud Run
FROM python:3.10-slim

WORKDIR /app

# Copiar e instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY api/__init__.py ./api/
COPY api/models.py ./api/
COPY api/database.py ./api/
COPY api/storage_manager.py ./api/
COPY api/main.py ./api/

# Copiar arquivos estáticos e HTML
COPY static/ ./static/
COPY index.html .
COPY login.html .
COPY games.html .
COPY donate.html .
COPY manifest.json .

# Configurar variáveis de ambiente
ENV PYTHONPATH=/app
ENV PORT=8080
ENV ENVIRONMENT=production
ENV GOOGLE_CLIENT_ID=123444066656-tffnuqtcqkv0jsocvu5o1up0e0g0r2e4.apps.googleusercontent.com

EXPOSE 8080

# Usar uvicorn diretamente
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
