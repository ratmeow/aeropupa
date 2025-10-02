import logging
import time
import sys
from logging import FileHandler, StreamHandler


class OverWritingFileHandler(FileHandler):
    def __init__(self, filename, max_bytes):
        super().__init__(filename=filename, mode="w")
        self.max_bytes = max_bytes

    def emit(self, record):
        if self.stream.tell() >= self.max_bytes:
            self.stream.seek(0)
            self.stream.truncate()
        super().emit(record=record)


def setup_package_logger():
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s - %(asctime)s - [%(name)s] - %(message)s",
        datefmt="%Y-%m-%d %H:%M",
        handlers=[
            OverWritingFileHandler(
                filename="aerotools.log",
                max_bytes=5 * 1024 * 1024,
            ),
            StreamHandler(sys.stdout)
        ],
    )


class PerformanceLogger:
    def __init__(self, logger, message=None):
        self.logger = logger
        self.message = message
        self.start = None

    def __enter__(self):
        self.start = time.monotonic()
        return self

    def __exit__(self, *args):
        elapsed = time.monotonic() - self.start
        self.logger.info(f"{self.message} took {elapsed:.2f} seconds")