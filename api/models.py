"""
Racket Pro Analyzer - Database Models
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel

# =============================================================================
# ENUMS / CONSTANTS
# =============================================================================

SPORTS = {
    "table_tennis": {"name": "Tênis de Mesa", "icon": "🏓", "game_types": ["singles", "doubles"]},
    "badminton": {"name": "Badminton", "icon": "🏸", "game_types": ["singles", "doubles"]},
    "tennis": {"name": "Tênis", "icon": "🎾", "game_types": ["singles", "doubles"]},
    "squash": {"name": "Squash", "icon": "🟠", "game_types": ["singles"]},
    "padel": {"name": "Padel", "icon": "🏓", "game_types": ["doubles"]},
    "beach_tennis": {"name": "Beach Tennis", "icon": "🏖️", "game_types": ["doubles"]},
    "pickleball": {"name": "Pickleball", "icon": "🥒", "game_types": ["singles", "doubles"]},
}

LEVELS = ["beginner", "intermediate", "advanced", "professional"]
PLAY_STYLES = ["offensive", "defensive", "all_around"]
HANDS = ["right", "left"]
GAME_TYPES = ["singles", "doubles"]
RESULTS = ["win", "loss", "draw"]
AGE_GROUPS = ["under_20", "20_39", "40_59", "60_plus"]

# =============================================================================
# PYDANTIC MODELS - Request/Response
# =============================================================================

# ----- User -----
class UserCreate(BaseModel):
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime

# ----- Player (Opponent/Partner) -----
class PlayerCreate(BaseModel):
    sport: str
    name: str
    dominant_hand: Optional[str] = "right"
    level: Optional[str] = "intermediate"
    play_style: Optional[str] = "all_around"
    age_group: Optional[str] = "20_39"
    notes: Optional[str] = None

class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    dominant_hand: Optional[str] = None
    level: Optional[str] = None
    play_style: Optional[str] = None
    age_group: Optional[str] = None
    notes: Optional[str] = None

class PlayerResponse(BaseModel):
    id: int
    user_id: int
    sport: str
    name: str
    dominant_hand: Optional[str]
    level: Optional[str]
    play_style: Optional[str]
    age_group: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Statistics (computed)
    total_games: Optional[int] = 0
    wins_against: Optional[int] = 0
    losses_against: Optional[int] = 0
    wins_with: Optional[int] = 0  # As partner
    losses_with: Optional[int] = 0  # As partner

# ----- Game -----
class GameCreate(BaseModel):
    sport: str
    game_type: str  # singles or doubles
    opponent_id: int
    opponent2_id: Optional[int] = None  # For doubles
    partner_id: Optional[int] = None  # For doubles
    game_date: str
    result: str  # win, loss, draw
    score: Optional[str] = None  # e.g. "2-1" (sets)
    detailed_score: Optional[str] = None  # e.g. "11-5,8-11,12-10" (points per set)
    location: Optional[str] = None
    notes: Optional[str] = None

class GameUpdate(BaseModel):
    opponent_id: Optional[int] = None
    opponent2_id: Optional[int] = None
    partner_id: Optional[int] = None
    game_date: Optional[str] = None
    result: Optional[str] = None
    score: Optional[str] = None
    detailed_score: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

class GameResponse(BaseModel):
    id: int
    user_id: int
    sport: str
    game_type: str
    opponent_id: int
    opponent2_id: Optional[int]
    partner_id: Optional[int]
    game_date: str
    result: str
    score: Optional[str]
    detailed_score: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Joined data
    opponent_name: Optional[str] = None
    opponent2_name: Optional[str] = None
    partner_name: Optional[str] = None

# ----- Statistics -----
class SportStatistics(BaseModel):
    sport: str
    total_games: int
    singles_games: int
    doubles_games: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    total_players: int

class OverallStatistics(BaseModel):
    total_games: int
    total_wins: int
    total_losses: int
    total_draws: int
    win_rate: float
    sports_played: list[str]
    by_sport: list[SportStatistics]
