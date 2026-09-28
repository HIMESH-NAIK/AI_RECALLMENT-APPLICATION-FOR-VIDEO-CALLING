from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables and .env file.
    Follows Requirement 14: Never hard-code API keys, URLs, model names, or passwords.
    """
    # Hindsight Configuration
    HINDSIGHT_URL: str = "http://localhost:8888"
    HINDSIGHT_API_KEY: Optional[str] = None
    HINDSIGHT_DEFAULT_BANK: str = "hackathon_agent"
    HINDSIGHT_TIMEOUT_SECONDS: int = 300

    # LLM Provider Configuration ('ollama', 'openai_compatible', 'mock_dev')
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "llama3.2"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    OPENAI_API_KEY: Optional[str] = None
    LLM_TIMEOUT_SECONDS: int = 180

    # Application Server Settings
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    PORT: Optional[int] = None
    FRONTEND_URL: str = "http://localhost:5173,http://localhost:5174"
    DEBUG: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [item.strip().rstrip("/") for item in self.FRONTEND_URL.split(",") if item.strip()]
        for default in ("http://localhost:5173", "http://localhost:5174"):
            if default not in origins:
                origins.append(default)
        return origins

    @property
    def server_port(self) -> int:
        return self.PORT if self.PORT is not None else self.APP_PORT


# Global settings singleton
settings = Settings()
