from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore"
    )

    ANTHROPIC_API_KEY: str = ""
    REPORT_MODEL: str = "claude-haiku-4-5-20251001"
    # Vision model for analyzing ANY medical image (modality/region/findings).
    # Empty -> falls back to REPORT_MODEL. Set to e.g. claude-opus-4-8 for higher quality.
    VISION_MODEL: str = ""

    # MedGemma (Google) for the imaging analysis step. Open-weights, reached via
    # an OpenAI-compatible endpoint (HF Inference Endpoint / Vertex AI / vLLM).
    # When BASE_URL + MODEL are set, MedGemma extracts the findings and Claude
    # writes the bilingual report. Empty -> falls back to the built-in analyzers.
    MEDGEMMA_BASE_URL: str = ""  # e.g. https://<endpoint>/v1
    MEDGEMMA_API_KEY: str = ""  # HF token / GCP access token / server key
    MEDGEMMA_MODEL: str = "google/medgemma-4b-it"

    ORTHANC_URL: str = "http://localhost:8042"
    ORTHANC_USER: str = ""
    ORTHANC_PASSWORD: str = ""

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    DATABASE_URL: str = "sqlite:///storage/radguard.db"
    HIGH_RISK_THRESHOLD: int = 70
    FRONTEND_ORIGIN: str = "http://localhost:5173"


settings = Settings()
