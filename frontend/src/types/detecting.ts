export type Tool = {
  id: number;
  name: string;
  threshold: number;      // % (0–100)
  confidence?: number;    // % (0–100)
};

export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;                         // 0..1
  bbox: [number, number, number, number];     // нормализованные координаты [0..1]
  polygons?: [number, number][][];            // нормализованные координаты [0..1]
};

export type ResponseData = {
  detections: Detection[];
  match: { overall: number; passed: boolean };
};
