"""
Racket Pro Analyzer - Database Setup
Uses Google Cloud Storage for persistence across container restarts
"""

import sqlite3
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict

from api.auth import get_password_hash, verify_password

# Check if running in production (Cloud Run)
IS_PRODUCTION = os.environ.get("K_SERVICE") is not None or os.environ.get("ENVIRONMENT") == "production"

# Database file path
if IS_PRODUCTION:
    # Use /tmp for Cloud Run (writable directory)
    DB_DIR = Path("/tmp")
else:
    # Use local path for development
    DB_DIR = Path(__file__).parent

DB_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = str(DB_DIR / "racket_analyzer.db")


def get_db_connection():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table - with password auth support
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            name TEXT,
            picture TEXT,
            email_verified INTEGER DEFAULT 0,
            verification_code TEXT,
            verification_code_expires TIMESTAMP,
            plan TEXT DEFAULT 'free',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migration: Add new columns for password auth if they don't exist
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN verification_code TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN verification_code_expires TIMESTAMP")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'")
    except sqlite3.OperationalError:
        pass

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


def save_to_cloud():
    """Save database to Cloud Storage (production only)."""
    print(f"[DB] save_to_cloud called. IS_PRODUCTION={IS_PRODUCTION}, DATABASE_PATH={DATABASE_PATH}")
    if IS_PRODUCTION:
        try:
            from .storage_manager import get_storage_manager
            storage = get_storage_manager()
            result = storage.save_database(DATABASE_PATH)
            print(f"[DB] save_database result: {result}")
        except Exception as e:
            print(f"[DB] Error saving to Cloud Storage: {e}")
            import traceback
            traceback.print_exc()


def ensure_db_initialized():
    """Ensure database is initialized (called on app startup)."""
    print(f"[DB] ensure_db_initialized called. IS_PRODUCTION={IS_PRODUCTION}, DATABASE_PATH={DATABASE_PATH}")

    # In production, try to load existing database from Cloud Storage
    if IS_PRODUCTION:
        try:
            from .storage_manager import get_storage_manager
            storage = get_storage_manager()
            result = storage.load_database(DATABASE_PATH)
            print(f"[DB] load_database result: {result}")
        except Exception as e:
            print(f"[DB] Could not load database from GCS (will create new): {e}")
            import traceback
            traceback.print_exc()

    # Initialize tables (creates them if they don't exist)
    init_db()
    print(f"[DB] Database initialized at {DATABASE_PATH}")


# =============================================================================
# AUTHENTICATION FUNCTIONS
# =============================================================================

def create_user(
    email: str,
    password: str,
    name: str = None,
    plan: str = "free"
) -> Optional[Dict]:
    """
    Create a new user with email/password authentication.
    Returns user dict if successful, None if email already exists.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        password_hash = get_password_hash(password)

        cursor.execute("""
            INSERT INTO users (email, password_hash, name, plan)
            VALUES (?, ?, ?, ?)
        """, (email, password_hash, name, plan))

        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        print(f"[DB] User created: {email} (ID: {user_id})")

        # Sync to Cloud Storage
        save_to_cloud()

        return {
            "id": user_id,
            "email": email,
            "name": name,
            "plan": plan,
            "email_verified": False
        }
    except sqlite3.IntegrityError:
        # Email already exists
        return None


def authenticate_user(email: str, password: str) -> Optional[Dict]:
    """
    Authenticate a user by email and password.
    Returns user dict if successful, None if invalid credentials.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return None

    # Check if user has password (not Google-only account)
    if not user["password_hash"]:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "plan": user["plan"] or "free",
        "email_verified": bool(user["email_verified"]),
        "created_at": user["created_at"]
    }


def get_user_by_email(email: str) -> Optional[Dict]:
    """Get user by email address."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return None

    return dict_from_row(user)


def set_verification_code(user_id: int, code: str, expires_at: datetime) -> bool:
    """Set verification code for a user."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE users
            SET verification_code = ?, verification_code_expires = ?
            WHERE id = ?
        """, (code, expires_at, user_id))

        conn.commit()
        conn.close()

        save_to_cloud()
        return True
    except Exception as e:
        print(f"[DB] Error setting verification code: {e}")
        return False


def verify_email(user_id: int, code: str) -> bool:
    """
    Verify email with code.
    Returns True if verification successful, False otherwise.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT verification_code, verification_code_expires
        FROM users WHERE id = ?
    """, (user_id,))

    user = cursor.fetchone()

    if not user:
        conn.close()
        return False

    stored_code = user["verification_code"]
    expires = user["verification_code_expires"]

    print(f"[DB] Verifying code for user {user_id}: stored={stored_code}, provided={code}")

    # Check if code matches
    if stored_code != code:
        conn.close()
        print(f"[DB] Code mismatch")
        return False

    # Check if code is expired
    if expires:
        try:
            from datetime import datetime
            if isinstance(expires, str):
                expires_dt = datetime.fromisoformat(expires.replace('Z', '+00:00'))
            else:
                expires_dt = expires

            if expires_dt < datetime.utcnow():
                conn.close()
                print(f"[DB] Code expired")
                return False
        except Exception as e:
            print(f"[DB] Error parsing expiration: {e}")

    # Mark email as verified and clear code
    cursor.execute("""
        UPDATE users
        SET email_verified = 1, verification_code = NULL, verification_code_expires = NULL
        WHERE id = ?
    """, (user_id,))

    conn.commit()
    conn.close()

    save_to_cloud()
    print(f"[DB] Email verified for user {user_id}")
    return True


def is_email_verified(user_id: int) -> bool:
    """Check if user's email is verified."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT email_verified FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return False

    return bool(user["email_verified"])


def update_user_password(user_id: int, hashed_password: str) -> bool:
    """Update user's password."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE users
            SET password_hash = ?, updated_at = ?
            WHERE id = ?
        """, (hashed_password, datetime.utcnow(), user_id))

        conn.commit()
        conn.close()

        save_to_cloud()
        return True
    except Exception as e:
        print(f"[DB] Error updating password: {e}")
        return False
