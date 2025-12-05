"""
Racket Pro Analyzer - FastAPI Backend
"""

import os
import json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests

from api.database import get_db_connection, dict_from_row, ensure_db_initialized
from api.models import (
    UserCreate, UserResponse,
    PlayerCreate, PlayerUpdate, PlayerResponse,
    GameCreate, GameUpdate, GameResponse,
    SportStatistics, OverallStatistics,
    SPORTS, LEVELS, PLAY_STYLES, HANDS, GAME_TYPES, RESULTS
)

# =============================================================================
# APP CONFIGURATION
# =============================================================================

app = FastAPI(
    title="Racket Pro Analyzer API",
    description="API for tracking racket sports games",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database on application startup."""
    ensure_db_initialized()

# Configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# =============================================================================
# AUTHENTICATION
# =============================================================================

def create_access_token(data: dict):
    """Create JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token and return user_id."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token não fornecido")

    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def get_or_create_user(email: str, name: str = None, picture: str = None):
    """Get existing user or create new one."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if user:
        user_id = user["id"]
        # Update name and picture if provided
        if name or picture:
            cursor.execute(
                "UPDATE users SET name = COALESCE(?, name), picture = COALESCE(?, picture), updated_at = ? WHERE id = ?",
                (name, picture, datetime.utcnow(), user_id)
            )
            conn.commit()
    else:
        cursor.execute(
            "INSERT INTO users (email, name, picture) VALUES (?, ?, ?)",
            (email, name, picture)
        )
        conn.commit()
        user_id = cursor.lastrowid

    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict_from_row(cursor.fetchone())
    conn.close()

    return user


# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

@app.post("/api/auth/google")
async def google_auth(data: dict):
    """Authenticate with Google OAuth."""
    try:
        token = data.get("token") or data.get("credential")
        if not token:
            raise HTTPException(status_code=400, detail="Token não fornecido")

        # Verify Google token
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        name = idinfo.get("name")
        picture = idinfo.get("picture")

        if not email:
            raise HTTPException(status_code=400, detail="Email não encontrado no token")

        # Get or create user
        user = get_or_create_user(email, name, picture)

        # Create JWT token
        access_token = create_access_token({"user_id": user["id"], "email": email})

        return {
            "token": access_token,
            "user": user
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Token Google inválido: {str(e)}")


@app.post("/api/auth/dev")
async def dev_auth(data: dict):
    """Development login - ONLY for local testing without Google OAuth."""
    # Only allow in development mode
    if os.environ.get("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="Login de desenvolvimento desabilitado em produção")

    email = data.get("email", "dev@test.com")
    name = data.get("name", "Dev User")

    # Get or create user
    user = get_or_create_user(email, name, None)

    # Create JWT token
    access_token = create_access_token({"user_id": user["id"], "email": email})

    return {
        "token": access_token,
        "user": user
    }


@app.get("/api/auth/me")
async def get_current_user(user_id: int = Depends(verify_token)):
    """Get current authenticated user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict_from_row(cursor.fetchone())
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    return user


# =============================================================================
# PLAYERS ENDPOINTS (Opponents/Partners)
# =============================================================================

@app.get("/api/players")
async def get_players(sport: Optional[str] = None, user_id: int = Depends(verify_token)):
    """Get all players for user, optionally filtered by sport."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if sport:
        cursor.execute(
            "SELECT * FROM players WHERE user_id = ? AND sport = ? ORDER BY name",
            (user_id, sport)
        )
    else:
        cursor.execute(
            "SELECT * FROM players WHERE user_id = ? ORDER BY sport, name",
            (user_id,)
        )

    players = [dict_from_row(row) for row in cursor.fetchall()]

    # Add statistics for each player
    for player in players:
        # Games as opponent
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses
            FROM games
            WHERE user_id = ? AND (opponent_id = ? OR opponent2_id = ?)
        """, (user_id, player["id"], player["id"]))
        opponent_stats = dict_from_row(cursor.fetchone())

        # Games as partner
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses
            FROM games
            WHERE user_id = ? AND partner_id = ?
        """, (user_id, player["id"]))
        partner_stats = dict_from_row(cursor.fetchone())

        player["games_against"] = opponent_stats["total"] or 0
        player["wins_against"] = opponent_stats["wins"] or 0
        player["losses_against"] = opponent_stats["losses"] or 0
        player["games_with"] = partner_stats["total"] or 0
        player["wins_with"] = partner_stats["wins"] or 0
        player["losses_with"] = partner_stats["losses"] or 0

    conn.close()
    return players


@app.post("/api/players")
async def create_player(player: PlayerCreate, user_id: int = Depends(verify_token)):
    """Create a new player."""
    if player.sport not in SPORTS:
        raise HTTPException(status_code=400, detail=f"Esporte inválido: {player.sport}")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO players (user_id, sport, name, dominant_hand, level, play_style, age_group, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, player.sport, player.name, player.dominant_hand,
          player.level, player.play_style, player.age_group, player.notes))

    conn.commit()
    player_id = cursor.lastrowid

    cursor.execute("SELECT * FROM players WHERE id = ?", (player_id,))
    new_player = dict_from_row(cursor.fetchone())
    conn.close()

    return new_player


@app.put("/api/players/{player_id}")
async def update_player(player_id: int, player: PlayerUpdate, user_id: int = Depends(verify_token)):
    """Update a player."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute("SELECT * FROM players WHERE id = ? AND user_id = ?", (player_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    # Build update query
    updates = []
    values = []
    for field, value in player.dict(exclude_unset=True).items():
        if value is not None:
            updates.append(f"{field} = ?")
            values.append(value)

    if updates:
        updates.append("updated_at = ?")
        values.append(datetime.utcnow())
        values.append(player_id)

        cursor.execute(f"UPDATE players SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()

    cursor.execute("SELECT * FROM players WHERE id = ?", (player_id,))
    updated_player = dict_from_row(cursor.fetchone())
    conn.close()

    return updated_player


@app.delete("/api/players/{player_id}")
async def delete_player(player_id: int, user_id: int = Depends(verify_token)):
    """Delete a player."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute("SELECT * FROM players WHERE id = ? AND user_id = ?", (player_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    # Check if player has games
    cursor.execute("""
        SELECT COUNT(*) as count FROM games
        WHERE opponent_id = ? OR opponent2_id = ? OR partner_id = ?
    """, (player_id, player_id, player_id))

    if cursor.fetchone()["count"] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Não é possível excluir jogador com jogos registrados")

    cursor.execute("DELETE FROM players WHERE id = ?", (player_id,))
    conn.commit()
    conn.close()

    return {"message": "Jogador excluído com sucesso"}


# =============================================================================
# GAMES ENDPOINTS
# =============================================================================

@app.get("/api/games")
async def get_games(sport: Optional[str] = None, user_id: int = Depends(verify_token)):
    """Get all games for user, optionally filtered by sport."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if sport:
        cursor.execute("""
            SELECT g.*,
                   p1.name as opponent_name,
                   p2.name as opponent2_name,
                   p3.name as partner_name
            FROM games g
            LEFT JOIN players p1 ON g.opponent_id = p1.id
            LEFT JOIN players p2 ON g.opponent2_id = p2.id
            LEFT JOIN players p3 ON g.partner_id = p3.id
            WHERE g.user_id = ? AND g.sport = ?
            ORDER BY g.game_date DESC, g.created_at DESC
        """, (user_id, sport))
    else:
        cursor.execute("""
            SELECT g.*,
                   p1.name as opponent_name,
                   p2.name as opponent2_name,
                   p3.name as partner_name
            FROM games g
            LEFT JOIN players p1 ON g.opponent_id = p1.id
            LEFT JOIN players p2 ON g.opponent2_id = p2.id
            LEFT JOIN players p3 ON g.partner_id = p3.id
            WHERE g.user_id = ?
            ORDER BY g.game_date DESC, g.created_at DESC
        """, (user_id,))

    games = [dict_from_row(row) for row in cursor.fetchall()]
    conn.close()

    return games


@app.post("/api/games")
async def create_game(game: GameCreate, user_id: int = Depends(verify_token)):
    """Create a new game."""
    if game.sport not in SPORTS:
        raise HTTPException(status_code=400, detail=f"Esporte inválido: {game.sport}")

    if game.game_type not in GAME_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de jogo inválido: {game.game_type}")

    if game.result not in RESULTS:
        raise HTTPException(status_code=400, detail=f"Resultado inválido: {game.result}")

    # Validate game type for sport
    sport_config = SPORTS[game.sport]
    if game.game_type not in sport_config["game_types"]:
        raise HTTPException(
            status_code=400,
            detail=f"{sport_config['name']} não suporta jogos de {game.game_type}"
        )

    # Validate doubles requirements
    if game.game_type == "doubles":
        if not game.partner_id:
            raise HTTPException(status_code=400, detail="Parceiro é obrigatório para jogos de duplas")
        if not game.opponent2_id:
            raise HTTPException(status_code=400, detail="Segundo adversário é obrigatório para jogos de duplas")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO games (user_id, sport, game_type, opponent_id, opponent2_id, partner_id,
                          game_date, result, score, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, game.sport, game.game_type, game.opponent_id, game.opponent2_id,
          game.partner_id, game.game_date, game.result, game.score, game.location, game.notes))

    conn.commit()
    game_id = cursor.lastrowid

    cursor.execute("""
        SELECT g.*,
               p1.name as opponent_name,
               p2.name as opponent2_name,
               p3.name as partner_name
        FROM games g
        LEFT JOIN players p1 ON g.opponent_id = p1.id
        LEFT JOIN players p2 ON g.opponent2_id = p2.id
        LEFT JOIN players p3 ON g.partner_id = p3.id
        WHERE g.id = ?
    """, (game_id,))

    new_game = dict_from_row(cursor.fetchone())
    conn.close()

    return new_game


@app.put("/api/games/{game_id}")
async def update_game(game_id: int, game: GameUpdate, user_id: int = Depends(verify_token)):
    """Update a game."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute("SELECT * FROM games WHERE id = ? AND user_id = ?", (game_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Jogo não encontrado")

    # Build update query
    updates = []
    values = []
    for field, value in game.dict(exclude_unset=True).items():
        if value is not None:
            updates.append(f"{field} = ?")
            values.append(value)

    if updates:
        updates.append("updated_at = ?")
        values.append(datetime.utcnow())
        values.append(game_id)

        cursor.execute(f"UPDATE games SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()

    cursor.execute("""
        SELECT g.*,
               p1.name as opponent_name,
               p2.name as opponent2_name,
               p3.name as partner_name
        FROM games g
        LEFT JOIN players p1 ON g.opponent_id = p1.id
        LEFT JOIN players p2 ON g.opponent2_id = p2.id
        LEFT JOIN players p3 ON g.partner_id = p3.id
        WHERE g.id = ?
    """, (game_id,))

    updated_game = dict_from_row(cursor.fetchone())
    conn.close()

    return updated_game


@app.delete("/api/games/{game_id}")
async def delete_game(game_id: int, user_id: int = Depends(verify_token)):
    """Delete a game."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute("SELECT * FROM games WHERE id = ? AND user_id = ?", (game_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Jogo não encontrado")

    cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
    conn.commit()
    conn.close()

    return {"message": "Jogo excluído com sucesso"}


# =============================================================================
# STATISTICS ENDPOINTS
# =============================================================================

@app.get("/api/statistics")
async def get_statistics(sport: Optional[str] = None, user_id: int = Depends(verify_token)):
    """Get statistics for user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if sport:
        # Statistics for specific sport
        cursor.execute("""
            SELECT
                COUNT(*) as total_games,
                SUM(CASE WHEN game_type = 'singles' THEN 1 ELSE 0 END) as singles_games,
                SUM(CASE WHEN game_type = 'doubles' THEN 1 ELSE 0 END) as doubles_games,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws
            FROM games
            WHERE user_id = ? AND sport = ?
        """, (user_id, sport))
        stats = dict_from_row(cursor.fetchone())

        cursor.execute(
            "SELECT COUNT(DISTINCT id) as count FROM players WHERE user_id = ? AND sport = ?",
            (user_id, sport)
        )
        stats["total_players"] = cursor.fetchone()["count"]
        stats["sport"] = sport
        stats["win_rate"] = round(stats["wins"] / stats["total_games"] * 100, 1) if stats["total_games"] > 0 else 0

        conn.close()
        return stats
    else:
        # Overall statistics
        cursor.execute("""
            SELECT
                COUNT(*) as total_games,
                SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws
            FROM games
            WHERE user_id = ?
        """, (user_id,))
        overall = dict_from_row(cursor.fetchone())
        overall["win_rate"] = round(overall["wins"] / overall["total_games"] * 100, 1) if overall["total_games"] > 0 else 0

        # Get sports played
        cursor.execute("SELECT DISTINCT sport FROM games WHERE user_id = ?", (user_id,))
        sports_played = [row["sport"] for row in cursor.fetchall()]
        overall["sports_played"] = sports_played

        # Stats by sport
        by_sport = []
        for sport_key in sports_played:
            cursor.execute("""
                SELECT
                    COUNT(*) as total_games,
                    SUM(CASE WHEN game_type = 'singles' THEN 1 ELSE 0 END) as singles_games,
                    SUM(CASE WHEN game_type = 'doubles' THEN 1 ELSE 0 END) as doubles_games,
                    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
                    SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws
                FROM games
                WHERE user_id = ? AND sport = ?
            """, (user_id, sport_key))
            sport_stats = dict_from_row(cursor.fetchone())
            sport_stats["sport"] = sport_key
            sport_stats["win_rate"] = round(sport_stats["wins"] / sport_stats["total_games"] * 100, 1) if sport_stats["total_games"] > 0 else 0
            by_sport.append(sport_stats)

        overall["by_sport"] = by_sport
        conn.close()

        return overall


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@app.get("/api/sports")
async def get_sports():
    """Get list of supported sports."""
    return SPORTS


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": "Racket Pro Analyzer"}


# =============================================================================
# STATIC FILES & PAGES
# =============================================================================

# Mount static files
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# Serve HTML pages
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return HTMLResponse("<h1>Racket Pro Analyzer</h1>")


@app.get("/{filename}.html", response_class=HTMLResponse)
async def serve_html(filename: str):
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), f"{filename}.html")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    raise HTTPException(status_code=404, detail="Página não encontrada")


@app.get("/manifest.json")
async def serve_manifest():
    manifest_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "manifest.json")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path)
    raise HTTPException(status_code=404, detail="Manifest não encontrado")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
