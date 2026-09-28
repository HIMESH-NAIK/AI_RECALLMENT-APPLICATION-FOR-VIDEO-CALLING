"""
Application Database / Session Store
===================================
Requirement 10: Keep normal application data separate from Hindsight memory.
Hindsight is for AI-agent memory (facts, mental models, semantic retrieval),
NOT for replacing the application's normal transactional database.

This store tracks:
- User accounts and metadata
- Active chat sessions
- Raw conversation interaction logs (for audit and UI display)
- Interaction metrics (e.g. Interaction #1, #5, #20 for demonstration mode)
"""

import sqlite3
import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any


DB_FILE = "app_data.db"


class ApplicationStore:
    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initialize standard application relational tables."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                created_at TIMESTAMP,
                last_seen TIMESTAMP,
                interaction_count INTEGER DEFAULT 0
            )
            """)

            # Sessions table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TIMESTAMP,
                last_active TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
            """)

            # Raw conversation logs for the frontend UI audit
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_logs (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                user_id TEXT,
                role TEXT,
                content TEXT,
                created_at TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id),
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
            """)

            conn.commit()

    def get_or_create_user(self, user_id: str) -> Dict[str, Any]:
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            
            cursor.execute(
                "INSERT INTO users (user_id, created_at, last_seen, interaction_count) VALUES (?, ?, ?, 0)",
                (user_id, now, now)
            )
            conn.commit()
            return {
                "user_id": user_id,
                "created_at": now,
                "last_seen": now,
                "interaction_count": 0
            }

    def increment_user_interactions(self, user_id: str) -> int:
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET interaction_count = interaction_count + 1, last_seen = ? WHERE user_id = ?",
                (now, user_id)
            )
            conn.commit()
            cursor.execute("SELECT interaction_count FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            return row["interaction_count"] if row else 1

    def get_or_create_session(self, user_id: str, session_id: Optional[str] = None) -> str:
        self.get_or_create_user(user_id)
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if session_id:
                cursor.execute("SELECT session_id FROM sessions WHERE session_id = ?", (session_id,))
                row = cursor.fetchone()
                if row:
                    cursor.execute("UPDATE sessions SET last_active = ? WHERE session_id = ?", (now, session_id))
                    conn.commit()
                    return session_id

            new_session_id = session_id or f"sess_{uuid.uuid4().hex[:12]}"
            cursor.execute(
                "INSERT OR REPLACE INTO sessions (session_id, user_id, created_at, last_active) VALUES (?, ?, ?, ?)",
                (new_session_id, user_id, now, now)
            )
            conn.commit()
            return new_session_id

    def log_message(self, session_id: str, user_id: str, role: str, content: str, metadata: Optional[dict] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            now = datetime.utcnow().isoformat()
            cursor.execute(
                "INSERT INTO message_logs (id, session_id, user_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (msg_id, session_id, user_id, role, content, now, json.dumps(metadata or {}))
            )
            conn.commit()

    def get_user_interaction_count(self, user_id: str) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT interaction_count FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            return row["interaction_count"] if row else 0

    def reset_user_data(self, user_id: str):
        """Helper for demo mode resetting."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM message_logs WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
            conn.commit()


# Application store singleton instance
app_store = ApplicationStore()
