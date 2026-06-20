from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore"
    )

    ANTHROPIC_API_KEY: str = ""
    REPORT_MODEL: str = "claude-haiku-4-5-20251001"

    ORTHANC_URL: str = "http://localhost:8042"
    ORTHANC_USER: str = ""
    ORTHANC_PASSWORD: str = ""

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    DATABASE_URL: str = "sqlite:///storage/radguard.db"
    HIGH_RISK_THRESHOLD: int = 70
    FRONTEND_ORIGIN: str = "http://localhost:5173"


settings = Settings()
