from pydantic_settings import BaseSettings
from pydantic import BaseModel, Field

BASE_GITHUB_URL = "https://github.com/ratmeow/aerofeatures/releases/download/submission/"
BASE_PATH = "./models/"

class ModelSpec(BaseModel):
    path: str
    url: str | None = None
    sha256: str | None = None


default_model = ModelSpec(path=BASE_PATH + "best.pt",
                          url=BASE_GITHUB_URL + "best.pt",
                          sha256="d4690ae05bf4f1dd1a7f958acc83bf418fbe6c2db66965bfff2b82147d3d5548")

small_model = ModelSpec(path=BASE_PATH + "small.pt",
                          url=BASE_GITHUB_URL + "small.pt",
                          sha256="ee0b292d34e4a611b2b4cf9ec0afe5c38a816b633c2fb47e6b3be9e83cf562b4")

nano_model = ModelSpec(path=BASE_PATH + "nano.pt",
                          url=BASE_GITHUB_URL + "nano.pt",
                          sha256="600f532fd085d3445ee4dcbf5650c07994fad1feec36898957376be9c686521a")



class AppSettings(BaseSettings):
    models: dict[str, ModelSpec] = Field(
        default={
            "default": default_model,
            "small": small_model,
            "nano": nano_model,
        }
    )
    device: str | None = None
    lru_capacity: int = 3
    warmup_models: list[str] = Field(default=["default"])

    batch_max_files: int = 500
    batch_max_archive_mb: int = 512
    batch_allow_exts: tuple[str, ...] = (".jpg", ".jpeg", ".png")

    class Config:
        env_prefix = "APP_"
        env_file = ".env"

settings = AppSettings()

