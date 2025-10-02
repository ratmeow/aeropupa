export type Tool = {
  id: number;
  name: string;
  threshold: number; // % (0..100)
  confidence?: number; // % (0..100)
  count?: number;
  ocr?: string;        
};

export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number; // 0..1
  bbox: [number, number, number, number];
  polygons?: [number, number][][]; // 0..1
  ocr?: string;                    
};


export type ResponseData = {
  detections: Detection[];
  match: { overall: number; passed: boolean };
};

const threshold = 80;

export function initialTools(): Tool[] {
  return [
    { id: 0,  name: "Отвертка «-»",                 threshold, count: 0},
    { id: 1,  name: "Отвертка «+»",                 threshold, count: 0},
    { id: 2,  name: "Отвертка на смещенный крест",  threshold, count: 0},
    { id: 3,  name: "Коловорот",                    threshold, count: 0},
    { id: 4,  name: "Пассатижи контровочные",       threshold, count: 0},
    { id: 5,  name: "Пассатижи",                    threshold, count: 0},
    { id: 6,  name: "Шэрница",                     threshold, count: 0},
    { id: 7,  name: "Разводной ключ",               threshold, count: 0},
    { id: 8,  name: "Открывашка для банок с маслом",threshold, count: 0},
    { id: 9,  name: "Ключ рожковый/накидной ¾",     threshold, count: 0},
    { id: 10, name: "Бокорезы",                     threshold, count: 0},
  ];
}

/** Палитра для классов (можно расширить) */
export const PALETTE = [
  "#e6194b", // ярко-красный
  "#3cb44b", // насыщенный зелёный
  "#ffe119", // чисто-жёлтый
  "#4363d8", // синий
  "#f58231", // оранжевый
  "#911eb4", // фиолетовый
  "#46f0f0", // циан
  "#f032e6", // розовый/маджента
  "#bcf60c", // салатовый
  "#fabebe", // светло-розовый
  "#008080", // тёмный бирюзовый
];

export function colorFor(id: number) {
  return PALETTE[id % PALETTE.length];
}