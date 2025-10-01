import React, { useState } from "react";
import type { Detection } from "../../types/detecting";

interface Props {
  file: File | null;
  previewUrl: string;
  detections: Detection[];
  onPickFile: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/** Палитра для классов (можно расширить) */
const PALETTE = [
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

/** Стабильный выбор цвета по ключу (class_id -> class_name -> индекс) */
function colorFor(det: Detection) {
  return PALETTE[det.class_id % PALETTE.length];
}

const ImagePreview: React.FC<Props> = ({
  file,
  previewUrl,
  detections,
  onPickFile,
  onFileChange,
  inputRef,
}) => {
  const [showBBoxes, setShowBBoxes] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-4 mb-4 justify-between ">
        <div className="flex items-center gap-4">
          <button
            onClick={onPickFile}
            className="px-5 h-[40px] rounded-[6px] bg-at-lightviolet text-white font-semibold hover:bg-at-lightviolet/90"
          >
            Выбрать файл
          </button>

          {file && (
            <span className="text-gray-200 text-sm truncate max-w-[300px]">
              {file.name}
            </span>
          )}
        </div>
        <div>
          {/* Переключатель отображения bbox */}
          <label className="ml-auto flex items-center gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-at-lightviolet"
              checked={showBBoxes}
              onChange={(e) => setShowBBoxes(e.target.checked)}
            />
            <span className="text-sm text-gray-200">Показывать bbox</span>
          </label>
          
          {/* Переключатель отображения полигонов */}
          <label className="ml-auto flex items-center gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-at-lightviolet"
              checked={showPolygons}
              onChange={(e) => setShowPolygons(e.target.checked)}
            />
            <span className="text-sm text-gray-200">Показывать Полигоны</span>
          </label>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="relative w-full min-h-[480px] rounded-[10px] border-2 border-gray-300 flex items-center justify-center overflow-hidden bg-transparent">
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-contain" />

            {/* SVG Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {detections.map((det, i) => {
                const [x1, y1, x2, y2] = det.bbox;
                const color = colorFor(det); // цвет для подписи и полигонов

                return (
                  <g key={i}>
                    {/* bbox — показываем по чекбоксу */}
                    {showBBoxes && (
                      <rect
                        x={x1}
                        y={y1}
                        width={x2 - x1}
                        height={y2 - y1}
                        stroke="lime"
                        strokeWidth={0.002}
                        fill="transparent"
                      />
                    )}

                    {/* полигоны — индивидуальные цвета */}
                    {showPolygons && det.polygons?.map((poly, j) => (
                      <polygon
                        key={j}
                        points={poly.map(([px, py]) => `${px},${py}`).join(" ")}
                        stroke={color}
                        strokeWidth={0.002}
                        fill="transparent"
                      />
                    ))}

                    {/* подпись — тот же индивидуальный цвет; с обводкой для читабельности */}
                    <text
                      x={x1}
                      y={Math.max(0.03, y1 - 0.01)}
                      fontSize={0.02}
                      fill={color}
                      stroke="black"
                      strokeWidth={0.0012}
                      paintOrder="stroke"
                    >
                      {det.class_name} {(det.confidence * 100).toFixed(1)}%
                    </text>
                  </g>
                );
              })}
            </svg>
          </>
        ) : (
          <div className="text-gray-400 text-center">
            <p className="mb-1 font-medium">Загрузите изображение</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagePreview;
