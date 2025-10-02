from typing import List, Dict, Tuple
from ..utils.geometry import Point, GeometryHelper
from ..utils.file_helper import FileHelper
from .schemas import Box, DetectionDict
from ..model_manager import ModelManager
import logging
from collections import Counter
from ..logger import PerformanceLogger

import numpy as np
import easyocr

logger = logging.getLogger(__name__)

class Detector:
    def __init__(self, model_manager: ModelManager, ocr, classes):
        self.model_manager = model_manager
        self.classes = classes
        self._ocr_reader = ocr

    @staticmethod
    def _ocr_on_rois(reader: easyocr.Reader, rois: List[np.ndarray]) -> List[str]:
        texts: List[str] = []
        for roi in rois:
            if roi is None or roi.size == 0:
                continue
        for roi in rois:
            ocr_results = reader.readtext(
                roi,
                text_threshold=0.5,
                link_threshold=0.6,
                threshold=0.7,
                detail=0,
                paragraph=False,
                allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
                min_size=10,
                rotation_info = [0, 45, 90, 135, 180, 225, 270, 315, 360]
            )
            for t in ocr_results:
                if isinstance(t, str):
                    t = t.strip()
                    if t:
                        texts.append(t)
        return texts

    @staticmethod
    def _pick_best_id(texts: List[str], min_len: int = 5) -> str:
        candidates: List[str] = []

        for raw in texts:
            if len(raw) < min_len:
                continue
            if "-" not in raw:
                continue
            candidates.append(raw)

        if not candidates:
            return ""

        return max(candidates, key=len)

    async def detect(
        self,
        image_bytes: bytes,
        model_name: str,
        text_detection: bool
    ) -> Dict:
        results = await self.detect_many(
            images=[image_bytes],
            model_name=model_name,
            batch_size=1,
            include_polygons=True,
            text_detection=text_detection
        )
        return results[0] if results else {"detections": [], "match": {"overall": 0.0, "passed": False}}

    async def detect_many(
        self,
        images: list[bytes],
        model_name: str,
        batch_size: int = 8,
        include_polygons: bool = False,
        text_detection: bool = False
    ) -> list[dict]:
        if not images:
            return []

        with PerformanceLogger(logger=logger, message="Image preprocessing"):
            np_imgs, sizes = [], []
            for b in images:
                np_img = FileHelper.bytes_to_numpy(image_bytes=b)
                h, w = np_img.shape[:2]
                np_imgs.append(np_img)
                sizes.append((w, h))

        model = await self.model_manager.get(model_name)

        out: list[dict] = []
        n = len(np_imgs)
        for i in range(0, n, batch_size):
            chunk = np_imgs[i:i + batch_size]

            results = model.predict(
                chunk,
                imgsz=1280,
                batch=min(batch_size, len(chunk)),
                verbose=False,
            )

            for j, r in enumerate(results):
                idx = i + j
                img_w, img_h = sizes[idx]
                np_img = np_imgs[idx]
                out.append(self._build_result_for_frame(
                    model_result=r,
                    np_img=np_img,
                    img_w=img_w,
                    img_h=img_h,
                    include_polygons=include_polygons,
                    text_detection=text_detection
                ))

        return out

    def _build_result_for_frame(
            self,
            model_result,
            np_img: np.ndarray,
            img_w: int,
            img_h: int,
            include_polygons: bool,
            text_detection: bool
    ) -> Dict:
        boxes = getattr(model_result, "boxes", None)
        masks = getattr(model_result, "masks", None)

        detections: List[DetectionDict] = []
        class_ids_for_counter: list[int] = []

        if boxes is not None:
            m = len(boxes)
            for i in range(m):
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())

                bbox_raw = boxes.xyxy[i].tolist()
                bbox = Box.from_xyxy(bbox_raw, normalize_by=(img_w, img_h)).as_list()

                det: DetectionDict = {
                    "class_id": cls_id,
                    "class_name": self.classes[cls_id],
                    "confidence": conf,
                    "bbox": bbox,
                }

                if masks is not None:
                    mask_xy = masks.xy[i]
                    contours = mask_xy if isinstance(mask_xy, list) else [mask_xy]

                    if include_polygons:
                        polys: list[list[list[float]]] = []
                        for arr in contours:
                            poly: List[Point] = [
                                GeometryHelper.normalize_and_clamp(float(x), float(y), img_w, img_h)
                                for (x, y) in arr
                            ]
                            if len(poly) >= 2 and poly[0] != poly[-1]:
                                poly = [*poly, poly[0]]
                            if len(poly) >= 3:
                                polys.append([[x, y] for (x, y) in poly])
                        if polys:
                            det["polygons"] = polys

                    if text_detection:
                        pixel_polys: List[np.ndarray] = []
                        for arr in contours:
                            if isinstance(arr, np.ndarray):
                                pixel_polys.append(arr[:, :2])
                            else:
                                pixel_polys.append(np.array(arr, dtype=np.float32)[:, :2])

                        rois = GeometryHelper.polygon_mask_and_crop(np_img, pixel_polys)
                        id_text = ""
                        if rois:
                            raw_texts = self._ocr_on_rois(self._ocr_reader, rois)
                            id_text = self._pick_best_id(raw_texts, min_len=5)

                        det["ocr"] = id_text

                detections.append(det)
                class_ids_for_counter.append(cls_id)

        counts_by_id = Counter(class_ids_for_counter)
        detected_ids = set(counts_by_id.keys())

        counts_by_name = {name: counts_by_id.get(i, 0) for i, name in enumerate(self.classes)}
        not_detected_ids = {i for i in range(len(self.classes)) if i not in detected_ids}

        overdetected_pairs = {i: (cnt - 1) for i, cnt in counts_by_id.items() if cnt > 1}
        overdetected = {self.classes[i]: extra for i, extra in overdetected_pairs.items()}

        all_present = (len(not_detected_ids) == 0)
        no_duplicates = (len(overdetected) == 0)
        exact_set_match = all_present and no_duplicates

        stats = {
            "total_detections": sum(counts_by_id.values()),
            "unique_detected": len(detected_ids),
            "counts": counts_by_name,
            "detected": sorted(self.classes[i] for i in detected_ids),
            "not_detected": sorted(self.classes[i] for i in not_detected_ids),
            "extra_detected": [],
            "overdetected": overdetected,
            "expected_each": 1,
            "match_expected_set": {
                "all_present": all_present,
                "no_duplicates": no_duplicates,
                "passed": exact_set_match,
            },
        }

        overall = round(len(detected_ids) / len(self.classes), 3) if self.classes else 0.0

        return {
            "detections": detections,
            "match": {"overall": overall},
            "stats": stats,
        }
