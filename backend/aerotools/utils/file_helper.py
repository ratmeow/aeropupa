import io, zipfile, tarfile
import hashlib, os, urllib.request
from pathlib import Path
import asyncio
from typing import Iterable
from PIL import Image
import numpy as np
from ..settings import settings

class FileHelper:
    ALLOWED_EXTENSIONS = tuple(e.lower() for e in settings.batch_allow_exts)

    @classmethod
    def is_allowed_name(cls, name: str) -> bool:
        return name.lower().endswith(cls.ALLOWED_EXTENSIONS)

    @staticmethod
    def bytes_to_numpy(image_bytes: bytes) -> np.ndarray:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_image = np.array(pil_image)
        return np_image

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
                # не tar — вернем пусто
                return []
            return out

        # блокирующие операции — в thread
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

    @classmethod
    def ensure_file(cls, path: str, url: str | None, sha256: str | None) -> Path:
        p = Path(path)
        if p.exists():
            if sha256:
                got = cls._sha256sum(p)
                if got != sha256:
                    raise RuntimeError(f"Hash mismatch for {p.name}: {got} != {sha256}")
            return p

        if not url:
            raise FileNotFoundError(f"{p} not found and no URL provided")

        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(p.suffix + ".part")
        print(f"Downloading {p.name} ...")
        try:
            urllib.request.urlretrieve(url, tmp)
            os.replace(tmp, p)
        except urllib.error.HTTPError as e:
            if tmp.exists():
                tmp.unlink(missing_ok=True)
            # Детализированная подсказка:
            raise RuntimeError(
                f"Download failed for {url} -> HTTP {e.code}. "
                f"Проверьте: 1) точный TAG релиза, 2) точное имя файла, 3) публичность релиза/репо. "
                f"Если репо приватный — задайте переменную окружения GITHUB_TOKEN."
            ) from e

        if sha256:
            got = cls._sha256sum(p)
            if got != sha256:
                raise RuntimeError(f"Hash mismatch after download for {p.name}")

        return p

    @staticmethod
    def _sha256sum(p: Path) -> str:
        h = hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()
