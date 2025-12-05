"""
Racket Pro Analyzer - Database Setup
"""

import sqlite3
import os
from datetime import datetime

# Use /tmp for Cloud Run (writable) or local path for development
if os.environ.get("ENVIRONMENT") == "production":
    DATABASE_PATH = "/tmp/racket_analyzer.db"
else:
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "racket_analyzer.db")


def get_db_connection():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            picture TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Players table (opponents and partners)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sport TEXT NOT NULL,
            name TEXT NOT NULL,
            dominant_hand TEXT DEFAULT 'right',
            level TEXT DEFAULT 'intermediate',
            play_style TEXT DEFAULT 'all_around',
            age_group TEXT DEFAULT 'adult',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    # Migration: Add age_group column if it doesn't exist
    try:
        cursor.execute("ALTER TABLE players ADD COLUMN age_group TEXT DEFAULT 'adult'")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Games table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sport TEXT NOT NULL,
            game_type TEXT NOT NULL DEFAULT 'singles',
            opponent_id INTEGER NOT NULL,
            opponent2_id INTEGER,
            partner_id INTEGER,
            game_date TEXT NOT NULL,
            result TEXT NOT NULL,
            score TEXT,
            location TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (opponent_id) REFERENCES players (id),
            FOREIGN KEY (opponent2_id) REFERENCES players (id),
            FOREIGN KEY (partner_id) REFERENCES players (id)
        )
    """)

    # Create indexes for better performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_players_user_sport ON players (user_id, sport)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_user_sport ON games (user_id, sport)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_opponent ON games (opponent_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_partner ON games (partner_id)")

    conn.commit()
    conn.close()


def dict_from_row(row):
    """Convert sqlite3.Row to dictionary."""
    if row is None:
        return None
    return dict(row)


# Initialize database on first connection
def ensure_db_initialized():
    """Ensure database is initialized (called on app startup)."""
    init_db()
