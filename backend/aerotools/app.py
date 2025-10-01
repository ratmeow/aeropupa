from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .detection.api import router
from .logger import setup_package_logger


def start_app() -> FastAPI:
    setup_package_logger()
    app = FastAPI()
    app.include_router(router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app
