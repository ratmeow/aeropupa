from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from .service import Detector
from ultralytics import YOLO
import logging
import json
from ..model_manager import ModelManager
from ..settings import settings
from ..utils.file_helper import FileHelper
from ..logger import PerformanceLogger

logger = logging.getLogger(__name__)

router = APIRouter()

_model_manager = ModelManager(
    registry=settings.models,
    capacity=settings.lru_capacity,
    device=settings.device,
)


def get_classes():
    with open("./toolsets/toolset-11.json", "r") as file:
        classes = json.load(file)
    return classes


def get_detector(classes = Depends(get_classes)) -> Detector:
    return Detector(model_manager=_model_manager, classes=classes)

@router.on_event("startup")
async def _warmup():
    await _model_manager.warmup()


@router.get(f"/models")
def list_models():
    return {"available": list(settings.models.keys()), "device": _model_manager.device}

@router.post(f"/detect")
async def detect(
    img_file: UploadFile = File(...),
    model_name: str = Form(default="default"),
    imgsz: int = Form(default=640),
    detector: Detector = Depends(get_detector),
):
    logging.info(f"/detect({img_file.filename=}, {model_name=})")
    if not FileHelper.is_allowed_name(name=img_file.filename):
        raise HTTPException(status_code=415, detail=f"Only {FileHelper.ALLOWED_EXTENSIONS} supported got {img_file.filename}")
    img_bytes = await img_file.read()
    with PerformanceLogger(logger=logger, message="Single detect took"):
        try:
            result = await detector.detect(image_bytes=img_bytes,
                                           model_name=model_name,
                                           imgsz=imgsz)
        except Exception as e:
            raise HTTPException(400, f"Inference failed: {e}")
    return JSONResponse(result)


@router.post(f"/detect/batch")
async def detect_batch(
    files: list[UploadFile] = File(..., description="files[] = jpg/png"),
    model_name: str = Form(default="default"),
    bs: int = Form(8),
    imgsz: int = Form(640),
    detector: Detector = Depends(get_detector),
):
    logging.info(f"/detect({model_name=})")
    if not files:
        raise HTTPException(400, "No files provided")
    if len(files) > settings.batch_max_files:
        raise HTTPException(413, f"Too many files (>{settings.batch_max_files})")

    _ = await _model_manager.get(model_name)

    names, blobs = [], []
    for f in files:
        if not FileHelper.is_allowed_name(name=f.filename):
            raise HTTPException(status_code=415, detail=f"Only {FileHelper.ALLOWED_EXTENSIONS} supported got {f.filename}")
        names.append(f.filename)
        blobs.append(await f.read())

    with PerformanceLogger(logger=logger, message="Batch detect took"):
        try:
            results = await detector.detect_many(
                images=blobs,
                model_name=model_name,
                batch_size=bs,
                imgsz=imgsz

            )
        except Exception as e:
            raise HTTPException(500, f"Batch inference failed: {e}")

    items = [{"filename": n, **r} for n, r in zip(names, results)]
    return JSONResponse({
        "items": items,
        "errors": [],
        "summary": {"input_files": len(files), "processed": len(items), "model": model_name, "batch": bs}
    })


@router.post(f"/detect/archive")
async def detect_archive(
    archive: UploadFile = File(..., description="ZIP or TAR archive"),
    model_name: str = Form(default="default"),
    bs: int = Form(8, description="batch size"),
    imgsz: int = Form(640, description="inference size"),
    detector: Detector = Depends(get_detector),
):
    logging.info(f"/detect({model_name=})")
    raw = await archive.read()
    max_bytes = settings.batch_max_archive_mb * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(413, f"Archive too large (>{settings.batch_max_archive_mb} MB)")

    pairs = await FileHelper.read_archive_images(archive_bytes=raw)
    if not pairs:
        raise HTTPException(400, "No images found in archive")

    if len(pairs) > settings.batch_max_files:
        pairs = pairs[:settings.batch_max_files]

    names = [n for (n, _) in pairs]
    blobs = [b for (_, b) in pairs]

    await _model_manager.get(model_name)

    try:
        results = await detector.detect_many(
            images=blobs,
            model_name=model_name,
            batch_size=bs,
            imgsz=imgsz
        )
    except Exception as e:
        raise HTTPException(500, f"Batch inference failed: {e}")

    items = [{"filename": fn, **res} for fn, res in zip(names, results)]

    summary = {
        "archive_name": archive.filename,
        "images_found": len(pairs),
        "processed": len(items),
        "failed": 0,
        "model": model_name,
        "batch": bs,
        "imgsz": imgsz,
    }
    return JSONResponse({"items": items, "errors": [], "summary": summary})