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
            detailed_score TEXT,
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

    # Migration: Add detailed_score column to games if it doesn't exist
    try:
        cursor.execute("ALTER TABLE games ADD COLUMN detailed_score TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Create indexes for better performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_players_user_sport ON players (user_id, sport)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_user_sport ON games (user_id, sport)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_opponent ON games (opponent_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_partner ON games (partner_id)")

    # =============================================================================
    # GAMIFICATION TABLES (Achievements System)
    # =============================================================================

    # Achievements table - defines all possible achievements
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            icon TEXT,
            rarity TEXT DEFAULT 'common',
            condition_type TEXT NOT NULL,
            condition_value INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # User achievements table - tracks which achievements each user has unlocked
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            achievement_id INTEGER NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notified BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (achievement_id) REFERENCES achievements(id),
            UNIQUE(user_id, achievement_id)
        )
    """)

    # User streaks table - tracks consecutive days playing
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_streaks (
            user_id INTEGER PRIMARY KEY,
            current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            last_game_date DATE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Create indexes for gamification
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_achievements_condition ON achievements (condition_type)")

    # Initialize default achievements
    _init_default_achievements(cursor)

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


# =============================================================================
# GAMIFICATION FUNCTIONS (Achievements System)
# =============================================================================

def _init_default_achievements(cursor):
    """Initialize default achievements in database."""
    achievements = [
        # Games count achievements
        ('first_step', 'first_step', '👶', 'common', 'games_count', 1),
        ('getting_started', 'getting_started', '🎯', 'common', 'games_count', 10),
        ('quarter_century', 'quarter_century', '🎖️', 'uncommon', 'games_count', 25),
        ('half_century', 'half_century', '💪', 'uncommon', 'games_count', 50),
        ('century', 'century', '💯', 'rare', 'games_count', 100),
        ('veteran', 'veteran', '🎖️', 'epic', 'games_count', 250),
        ('master', 'master', '👑', 'legendary', 'games_count', 500),
        ('legend', 'legend', '🏆', 'mythic', 'games_count', 1000),

        # Streak achievements
        ('on_fire_3', 'on_fire_3', '🔥', 'common', 'streak_days', 3),
        ('on_fire_7', 'on_fire_7', '🔥', 'uncommon', 'streak_days', 7),
        ('eternal_flame', 'eternal_flame', '🔥🔥', 'rare', 'streak_days', 30),
        ('immortal', 'immortal', '🔥🔥🔥', 'legendary', 'streak_days', 90),

        # Opponents count achievements
        ('networking', 'networking', '👥', 'common', 'opponents_count', 5),
        ('socializer', 'socializer', '🤝', 'uncommon', 'opponents_count', 10),
        ('popular', 'popular', '🌟', 'rare', 'opponents_count', 25),

        # Wins count achievements
        ('first_victory', 'first_victory', '🥇', 'common', 'wins_count', 1),
        ('champion', 'champion', '🏆', 'uncommon', 'wins_count', 50),
        ('dominator', 'dominator', '👑', 'rare', 'wins_count', 100),

        # Win rate achievements (requires minimum games)
        ('rising_star', 'rising_star', '⭐', 'uncommon', 'win_rate_60', 20),
        ('unstoppable', 'unstoppable', '💎', 'epic', 'win_rate_70', 50),
    ]

    for name, description, icon, rarity, condition_type, condition_value in achievements:
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO achievements (name, description, icon, rarity, condition_type, condition_value)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (name, description, icon, rarity, condition_type, condition_value))
        except Exception as e:
            print(f"[DB] Error inserting achievement {name}: {e}")


def get_user_stats(user_id: int) -> Dict:
    """Get user statistics for achievement checking."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Total games
    cursor.execute("SELECT COUNT(*) as count FROM games WHERE user_id = ?", (user_id,))
    total_games = cursor.fetchone()['count']

    # Total wins
    cursor.execute("SELECT COUNT(*) as count FROM games WHERE user_id = ? AND result = 'win'", (user_id,))
    total_wins = cursor.fetchone()['count']

    # Unique opponents
    cursor.execute("""
        SELECT COUNT(DISTINCT opponent_id) as count FROM games WHERE user_id = ?
    """, (user_id,))
    total_opponents = cursor.fetchone()['count']

    # Win rate
    win_rate = (total_wins / total_games * 100) if total_games > 0 else 0

    # Streak info
    cursor.execute("SELECT current_streak, best_streak FROM user_streaks WHERE user_id = ?", (user_id,))
    streak_row = cursor.fetchone()
    current_streak = streak_row['current_streak'] if streak_row else 0
    best_streak = streak_row['best_streak'] if streak_row else 0

    conn.close()

    return {
        'total_games': total_games,
        'total_wins': total_wins,
        'total_opponents': total_opponents,
        'win_rate': win_rate,
        'current_streak': current_streak,
        'best_streak': best_streak
    }


def update_user_streak(user_id: int, game_date: str) -> Dict:
    """Update user's streak based on game date."""
    from datetime import date, timedelta

    conn = get_db_connection()
    cursor = conn.cursor()

    # Parse game date
    try:
        game_date_obj = date.fromisoformat(game_date)
    except:
        game_date_obj = date.today()

    # Get current streak info
    cursor.execute("SELECT current_streak, best_streak, last_game_date FROM user_streaks WHERE user_id = ?", (user_id,))
    streak_row = cursor.fetchone()

    if not streak_row:
        # First game ever
        cursor.execute("""
            INSERT INTO user_streaks (user_id, current_streak, best_streak, last_game_date)
            VALUES (?, 1, 1, ?)
        """, (user_id, game_date))
        conn.commit()
        conn.close()
        save_to_cloud()
        return {'current_streak': 1, 'best_streak': 1, 'last_game_date': game_date}

    current_streak = streak_row['current_streak']
    best_streak = streak_row['best_streak']
    last_game_date = streak_row['last_game_date']

    if last_game_date:
        try:
            last_date_obj = date.fromisoformat(last_game_date)
        except:
            last_date_obj = None

        if last_date_obj:
            days_diff = (game_date_obj - last_date_obj).days

            if days_diff == 0:
                # Same day, no change
                pass
            elif days_diff == 1:
                # Consecutive day, increment streak
                current_streak += 1
                if current_streak > best_streak:
                    best_streak = current_streak
            elif days_diff > 1:
                # Streak broken, reset to 1
                current_streak = 1
            # If days_diff < 0 (game in the past), don't change streak

    cursor.execute("""
        UPDATE user_streaks
        SET current_streak = ?, best_streak = ?, last_game_date = ?
        WHERE user_id = ?
    """, (current_streak, best_streak, game_date, user_id))

    conn.commit()
    conn.close()
    save_to_cloud()

    return {
        'current_streak': current_streak,
        'best_streak': best_streak,
        'last_game_date': game_date
    }


def get_user_streak(user_id: int) -> Dict:
    """Get user's streak information."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT current_streak, best_streak, last_game_date FROM user_streaks WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {'current_streak': 0, 'best_streak': 0, 'last_game_date': None}

    return {
        'current_streak': row['current_streak'],
        'best_streak': row['best_streak'],
        'last_game_date': row['last_game_date']
    }


def get_all_achievements() -> list:
    """Get all achievements."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM achievements ORDER BY condition_value ASC")
    achievements = [dict_from_row(row) for row in cursor.fetchall()]
    conn.close()

    return achievements


def get_user_achievements(user_id: int) -> list:
    """Get all achievements with user's unlock status."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.*, ua.unlocked_at
        FROM achievements a
        LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
        ORDER BY
            CASE a.rarity
                WHEN 'common' THEN 1
                WHEN 'uncommon' THEN 2
                WHEN 'rare' THEN 3
                WHEN 'epic' THEN 4
                WHEN 'legendary' THEN 5
                WHEN 'mythic' THEN 6
            END,
            a.condition_value ASC
    """, (user_id,))

    achievements = []
    for row in cursor.fetchall():
        achievement = dict_from_row(row)
        achievement['unlocked'] = achievement['unlocked_at'] is not None
        achievements.append(achievement)

    conn.close()
    return achievements


def check_and_unlock_achievements(user_id: int) -> list:
    """Check and unlock any new achievements for user."""
    stats = get_user_stats(user_id)
    newly_unlocked = []

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get all achievements
    cursor.execute("SELECT * FROM achievements")
    all_achievements = cursor.fetchall()

    for achievement in all_achievements:
        achievement_id = achievement['id']
        condition_type = achievement['condition_type']
        condition_value = achievement['condition_value']

        # Check if already unlocked
        cursor.execute("""
            SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?
        """, (user_id, achievement_id))

        if cursor.fetchone():
            continue  # Already unlocked

        # Check condition
        unlocked = False

        if condition_type == 'games_count':
            unlocked = stats['total_games'] >= condition_value
        elif condition_type == 'wins_count':
            unlocked = stats['total_wins'] >= condition_value
        elif condition_type == 'opponents_count':
            unlocked = stats['total_opponents'] >= condition_value
        elif condition_type == 'streak_days':
            unlocked = stats['current_streak'] >= condition_value or stats['best_streak'] >= condition_value
        elif condition_type == 'win_rate_60':
            unlocked = stats['win_rate'] >= 60 and stats['total_games'] >= condition_value
        elif condition_type == 'win_rate_70':
            unlocked = stats['win_rate'] >= 70 and stats['total_games'] >= condition_value

        if unlocked:
            try:
                cursor.execute("""
                    INSERT INTO user_achievements (user_id, achievement_id)
                    VALUES (?, ?)
                """, (user_id, achievement_id))

                newly_unlocked.append({
                    'id': achievement['id'],
                    'name': achievement['name'],
                    'description': achievement['description'],
                    'icon': achievement['icon'],
                    'rarity': achievement['rarity']
                })
                print(f"[DB] Achievement unlocked for user {user_id}: {achievement['name']}")
            except sqlite3.IntegrityError:
                pass  # Already unlocked (race condition)

    if newly_unlocked:
        conn.commit()
        save_to_cloud()

    conn.close()
    return newly_unlocked
