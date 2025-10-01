import math
from typing import Sequence

Point = tuple[float, float]

class GeometryHelper:

    @classmethod
    def normalize_and_clamp(cls, x: float, y: float, w: int, h: int,) -> Point:
        x, y = x / w, y / h
        return (cls._clamp01(x), cls._clamp01(y))

    @classmethod
    def _clamp01(cls, v: float) -> float:
        return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)

    @classmethod
    def _clamp_px(cls, v: float, limit: int) -> float:
        return 0.0 if v < 0 else (float(limit - 1) if v > limit - 1 else float(v))


    @classmethod
    def rdp(cls, points: Sequence[Point], epsilon: float) -> list[Point]:
        """
        Ramer–Douglas–Peucker упрощение ломаной.
        """
        if epsilon <= 0 or len(points) < 3:
            return list(points)

        # найдём точку с макс. отклонением от прямой между концами
        dmax, idx = 0.0, 0
        start, end = points[0], points[-1]
        for i in range(1, len(points) - 1):
            d = cls._perp_distance(points[i], start, end)
            if d > dmax:
                dmax, idx = d, i

        if dmax > epsilon:
            left = cls.rdp(points[: idx + 1], epsilon)
            right = cls.rdp(points[idx:], epsilon)
            # склейка без дублирования стыковочной точки
            return left[:-1] + right
        return [start, end]


    @classmethod
    def _perp_distance(cls, pt: Point, a: Point, b: Point) -> float:
        """Перпендикулярное расстояние от точки до отрезка AB (если A==B — до точки A)."""
        (x, y), (x1, y1), (x2, y2) = pt, a, b
        if x1 == x2 and y1 == y2:
            return math.hypot(x - x1, y - y1)
        num = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1)
        den = math.hypot((y2 - y1), (x2 - x1))
        return num / den