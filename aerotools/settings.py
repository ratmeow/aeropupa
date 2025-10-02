from pydantic_settings import BaseSettings
from pydantic import BaseModel, Field

BASE_PATH = "./models/"

class AppSettings(BaseSettings):
    models: dict[str, str] = Field(
        default={
            "main": BASE_PATH + "small.pt",
            "light": BASE_PATH + "nano.pt",
        }
    )
    device: str | None = None
    lru_capacity: int = 3
    warmup_models: list[str] = Field(default=["main"])

    batch_max_files: int = 500
    batch_max_archive_mb: int = 512
    batch_allow_exts: tuple[str, ...] = (".jpg", ".jpeg", ".png")

    class Config:
        env_prefix = "APP_"
        env_file = ".env"

settings = AppSettings()

