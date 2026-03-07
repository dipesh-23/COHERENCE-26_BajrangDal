"""Quick import verification for pydantic_settings + supabase in the uvicorn Python env."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from pydantic_settings import BaseSettings
    print("[OK] pydantic_settings")
except ImportError as e:
    print(f"[FAIL] pydantic_settings: {e}")

try:
    from supabase import create_client
    print("[OK] supabase")
except ImportError as e:
    print(f"[FAIL] supabase: {e}")

try:
    from database import get_db
    db = get_db()
    print(f"[OK] database.get_db() -> {type(db).__name__}")
except Exception as e:
    print(f"[FAIL] database: {e}")

try:
    from config import get_settings
    s = get_settings()
    print(f"[OK] config: APP_ENV={s.APP_ENV} supabase_configured={s.supabase_configured}")
except Exception as e:
    print(f"[FAIL] config: {e}")
