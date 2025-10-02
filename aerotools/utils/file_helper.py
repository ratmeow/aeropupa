import io, zipfile, tarfile
import asyncio
from typing import Iterable
import cv2
import numpy as np
from ..settings import settings

class FileHelper:
    ALLOWED_EXTENSIONS = tuple(e.lower() for e in settings.batch_allow_exts)

    @classmethod
    def is_allowed_name(cls, name: str) -> bool:
        return name.lower().endswith(cls.ALLOWED_EXTENSIONS)

    @staticmethod
    def bytes_to_numpy(image_bytes: bytes) -> np.ndarray:
        np_img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if np_img is None:
            raise ValueError("Invalid image data")
        np_img = cv2.cvtColor(np_img, cv2.COLOR_BGR2RGB)
        return np_img

    @classmethod
    async def read_archive_images(cls, archive_bytes: bytes) -> Iterable[tuple[str, bytes]]:
        bio = io.BytesIO(archive_bytes)

        def try_zip() -> list[tuple[str, bytes]]:
            out: list[tuple[str, bytes]] = []
            with zipfile.ZipFile(bio, "r") as z:
                for info in cls._safe_members_zip(z):
                    if cls.is_allowed_name(info.filename):
                        out.append((info.filename, z.read(info)))
            return out

        def try_tar() -> list[tuple[str, bytes]]:
            out: list[tuple[str, bytes]] = []
            bio.seek(0)
            try:
                with tarfile.open(fileobj=bio, mode="r:*") as t:
                    for m in cls._safe_members_tar(t):
                        if cls.is_allowed_name(m.name):
                            f = t.extractfile(m)
                            if f:
                                out.append((m.name, f.read()))
            except tarfile.ReadError:
                return []
            return out

        imgs = await asyncio.to_thread(try_zip)
        if imgs:
            return imgs
        return await asyncio.to_thread(try_tar)

    @staticmethod
    def _safe_members_zip(z: zipfile.ZipFile) -> Iterable[zipfile.ZipInfo]:
        for info in z.infolist():
            if info.is_dir():
                continue
            if ".." in info.filename or info.filename.startswith(("/", "\\")):
                continue
            yield info

    @staticmethod
    def _safe_members_tar(t: tarfile.TarFile) -> Iterable[tarfile.TarInfo]:
        for m in t.getmembers():
            if not m.isfile():
                continue
            name = m.name
            if ".." in name or name.startswith(("/", "\\")):
                continue
            yield m
