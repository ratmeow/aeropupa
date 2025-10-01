from typing import TypedDict
from dataclasses import dataclass


@dataclass(frozen=True)
class Box:
    x1: float
    y1: float
    x2: float
    y2: float

    @classmethod
    def from_xyxy(cls, xyxy: list[float], *,
                  normalize_by: tuple[int, int]) -> "Box":
        x1, y1, x2, y2 = map(float, xyxy)
        w, h = normalize_by
        return cls(x1 / w, y1 / h, x2 / w, y2 / h)

    def as_list(self) -> list[float]:
        return [self.x1, self.y1, self.x2, self.y2]


class DetectionDict(TypedDict, total=False):
    class_id: int
    class_name: str
    confidence: float
    bbox: list[float]
    polygons: list[list[list[float]]]