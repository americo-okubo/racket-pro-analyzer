"""
Cloud Storage Manager for Racket Pro Analyzer
Handles saving/loading SQLite database to/from Google Cloud Storage
"""

import os
from pathlib import Path
from google.cloud import storage

# Configuration
BUCKET_NAME = "racket-pro-analyzer-data"
DATABASE_FILE = "database/racket_analyzer.db"


class StorageManager:
    def __init__(self):
        """Initialize Cloud Storage client"""
        self.client = storage.Client()
        self.bucket = self.client.bucket(BUCKET_NAME)

    def load_database(self, local_path):
        """
        Load database from Cloud Storage to local file

        Args:
            local_path: Where to save the downloaded database file

        Returns:
            True if database was loaded, False if it doesn't exist yet
        """
        blob = self.bucket.blob(DATABASE_FILE)

        if not blob.exists():
            print(f"[STORAGE] No database found in GCS, will create new database")
            return False

        # Ensure directory exists
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)

        # Download to local file
        blob.download_to_filename(local_path)
        print(f"[STORAGE] Downloaded database from gs://{BUCKET_NAME}/{DATABASE_FILE}")
        return True

    def save_database(self, local_path):
        """
        Save database to Cloud Storage

        Args:
            local_path: Path to the local database file to upload
        """
        if not os.path.exists(local_path):
            print(f"[STORAGE] Database file not found: {local_path}")
            return False

        blob = self.bucket.blob(DATABASE_FILE)

        # Upload the database file
        blob.upload_from_filename(local_path)
        print(f"[STORAGE] Saved database to gs://{BUCKET_NAME}/{DATABASE_FILE}")
        return True


# Singleton instance
_storage_manager = None


def get_storage_manager():
    """Get singleton StorageManager instance"""
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager
