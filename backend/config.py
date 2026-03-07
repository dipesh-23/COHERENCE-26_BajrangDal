"""
config.py — Centralised settings for the Clinical Trial Matching Engine.
Loaded once at startup via python-dotenv.  All modules import from here.
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Supabase ───────────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""          # e.g. https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY: str = ""  # service-role key (server-side only, never expose to frontend)
    SUPABASE_JWT_SECRET: str = ""   # JWT secret — Supabase Dashboard → Settings → API → JWT Secret

    # ── App ────────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"    # "development" | "production"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"

    # ── ML Model ───────────────────────────────────────────────────────────────
    MODEL_NAME: str = "pritamdeka/S-BiomedBERT"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY)


@lru_cache
def get_settings() -> Settings:
    return Settings()
