from collections import OrderedDict
from typing import Dict
import asyncio
import torch
from ultralytics import YOLO
from .settings import settings
import logging

logger = logging.getLogger(__name__)

class ModelManager:
    def __init__(self, registry: dict[str, str], capacity: int, device: str | None):
        self.registry = registry
        self.capacity = capacity
        self.device = device or ("cuda:0" if torch.cuda.is_available() else "cpu")

        self._cache: "OrderedDict[str, YOLO]" = OrderedDict()
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_lock(self, name: str) -> asyncio.Lock:
        if name not in self._locks:
            self._locks[name] = asyncio.Lock()
        return self._locks[name]

    async def get(self, name: str) -> YOLO:
        if name not in self.registry:
            raise ValueError(f"Unknown model '{name}'. Available: {list(self.registry)}")

        if name in self._cache:
            self._cache.move_to_end(name)
            return self._cache[name]

        lock = self._get_lock(name)
        async with lock:
            if name in self._cache:
                self._cache.move_to_end(name)
                return self._cache[name]

            model = self.registry[name]
            logger.info(f"Loading model '{name}'on device:{self.device}")

            model: YOLO = await asyncio.to_thread(YOLO, str(model))
            model.to(self.device)

            self._cache[name] = model
            self._cache.move_to_end(name)
            while len(self._cache) > self.capacity:
                self._cache.popitem(last=False)

            return model

    async def warmup(self):
        for name in settings.warmup_models:
            try:
                await self.get(name)
            except Exception as e:
                logger.error(f"[warmup] failed for {name}: {e}")
