import React, { useEffect, useMemo, useRef, useState } from "react";
import ControlsBar from "../components/detecting/ControlsBar";
import ImagePreview from "../components/detecting/ImagePreview";
import StatusBadge from "../components/detecting/StatusBadge";
import ToolsTable from "../components/detecting/ToolsTable";
import { downloadJson } from "../utils/downloadJson";
import { initialTools, type Detection, type ResponseData, type Tool } from "../types/detecting";
import { downscaleImage } from "../utils/imageCompress";

const toolKits = [{ value: "Test1", label: "Тестовый набор" }];

interface Option { value: string; label: string }
const models: Option[] = [];

// 0..1 -> %
const pct = (x: number | undefined) =>
  typeof x === "number" ? Math.round(x * 100) : undefined;

/** Сколько детекций типа прошли порог инструмента (threshold в %) */
function passCountForTool(tool: Tool, detections: Detection[]): number {
  const th = tool.threshold;
  return detections.reduce((acc, d) => {
    if (d.class_id !== tool.id) return acc;
    const c = pct(d.confidence) ?? 0;
    return c >= th ? acc + 1 : acc;
  }, 0);
}

function bestOcrForTool(tool: Tool, dets: Detection[]): string | undefined {
  let bestText: string | undefined;
  let bestConf = -1;
  for (const d of dets) {
    if (d.class_id !== tool.id) continue;
    const raw = (d as any).ocr as unknown;
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    const conf = typeof d.confidence === "number" ? d.confidence : 0;
    if (conf > bestConf) {
      bestConf = conf;
      bestText = text;
    }
  }
  return bestText;
}

/** Максимальная уверенность по типу (в %, для UI) */
function maxConfidencePctForTool(tool: Tool, dets: Detection[]): number | undefined {
  const confs = dets.filter(d => d.class_id === tool.id).map(d => pct(d.confidence) ?? 0);
  return confs.length ? Math.max(...confs) : undefined;
}

/** Центральная функция вычислений для текущего фото */
function computePhotoValidation(
  tools: Tool[],
  detections: Detection[],
  overrides?: { counts?: Record<number, number> }
) {
  const countsByTool: Record<number, number> = {};
  const maxConfByTool: Record<number, number | undefined> = {};
  const perToolPassed: Record<number, boolean> = {};

  for (const t of tools) {
    const autoCount = passCountForTool(t, detections);                 // после порога
    const effectiveCount = overrides?.counts?.[t.id] ?? autoCount;      // ручная правка
    countsByTool[t.id] = effectiveCount;
    maxConfByTool[t.id] = maxConfidencePctForTool(t, detections);
    perToolPassed[t.id] = effectiveCount === 1;                         // «ровно один»
  }

  const overallPassed = Object.values(perToolPassed).every(Boolean);
  const hasMismatch = !overallPassed;

  return { countsByTool, maxConfByTool, perToolPassed, overallPassed, hasMismatch };
}


const DetectingPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [tools, setTools] = useState<Tool[]>(initialTools());
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false); // показывать ли плашку статуса
  const [selectedToolKit, setSelectedToolKit] = useState<string>(toolKits[0].value);
  const [lastResult, setLastResult] = useState<ResponseData | null>(null); // для скачивания JSON

  const [chosenModel, setChosenModel] = useState<string>("");

  const [compress, setCompress] = useState<boolean>(false);
  const [ocr, setOcr] = useState<boolean>(false);
  const [overrides, setOverrides] = useState<{ counts: Record<number, number> }>({ counts: {} });

  const [palette, setPalette] = useState<string[]>([
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080",
  ]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/models');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const data = await response.json();
        const available = data.available;

        available.forEach((item: string) => {
          if (!models.some(obj => obj.value === item)) models.push({value: item ,label: item})
        });

        if (models.length) {
          setChosenModel(models[0].value);
        }
      } finally {}
    };

    fetchUser();
  }, []); // Пустой массив зависимостей = выполняется только при монтировании

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = () => inputRef.current?.click();

  const handleLocalPreview = (f: File) => {
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(url);
    setDetections([]);
    setTools(initialTools);
    setLastResult(null);
    setHasRun(false); // до запуска не показываем статус
    setOverrides({ counts: {} });
  };

  // добавили overridesArg с дефолтом = текущему состоянию
  function recompute(
    toolsState: Tool[],
    dets: Detection[],
    curLast: ResponseData | null,
    overridesArg: { counts: Record<number, number> } = overrides
  ) {
    const v = computePhotoValidation(toolsState, dets ?? [], overridesArg);

    // обновляем таблицу
    const toolsForUI = toolsState.map((t) => {
      const ocrText = bestOcrForTool(t, dets); // <-- берём лучший ocr по классу
      return {
        ...t,
        confidence: maxConfidencePctForTool(t, dets) ?? 0,
        count: v.countsByTool[t.id] ?? 0,
        ...(ocrText ? { ocr: ocrText } : {}), // <-- прокидываем в таблицу
      } as Tool & { ocr?: string };
    });
    setTools(toolsForUI);

    // обновляем JSON
    if (curLast) {
      const patched: ResponseData = {
        ...curLast,
        match: { ...(curLast.match ?? { overall: 0, passed: false }), passed: v.overallPassed },
        // @ts-expect-error клиентское поле
        client: {
          countsByTool: v.countsByTool,
          maxConfByTool: v.maxConfByTool,
          perToolPassed: v.perToolPassed,
          overallPassed: v.overallPassed,
        },
      };
      setLastResult(patched);
    }

    return v;
  }



  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleLocalPreview(f);
  };

  const runDetection = async () => {
    if (!file) return;
    setIsRunning(true);
    setHasRun(false);

    try {
      const toSend = compress ? await downscaleImage(file, 1280, "image/jpeg", 0.82) : file;
      const formData = new FormData();
      formData.append("img_file", toSend, toSend.name);
      formData.append("model_name", chosenModel); // строка
      formData.append("confidence_threshold", '0.5'); // строка (числа тоже как строки)
      formData.append("text_detection", String(ocr));
      // локальная заглушка ответа
      // const res = await fetch("/response.json");
      console.log('formData', formData);
      const res = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });
      const data: ResponseData = await res.json();

      setDetections(data.detections);
      setLastResult(data);

      recompute(tools, data.detections, data);
    } finally {
      setIsRunning(false);
      setHasRun(true); // запуск завершён — можно показывать плашку
    }
  };

  const isRowPass = (t: Tool) => {
    const cnt = (t as any).count as number | undefined;
    return cnt === 1; // уже после порога и с учётом ручной правки
  };

  const allGreen = useMemo(() => {
    if (!hasRun) return false;
    return tools.every((t) => (t as any).count === 1);
  }, [tools, hasRun]);

  const updateThreshold = (id: number, v: number) => {
    const vv = Math.max(0, Math.min(100, v));
    setTools(prev => {
      const nextTools = prev.map(t => (t.id === id ? { ...t, threshold: vv } : t));
      // используем ТЕКУЩИЕ overrides из стейта
      recompute(nextTools, detections, lastResult, overrides);
      return nextTools;
    });
  };

  const updateCount = (id: number, value: number) => {
    const safe = Math.max(0, Math.floor(value));
    setOverrides(prev => {
      const next = { counts: { ...prev.counts, [id]: safe } };
      // ВАЖНО: пересчитываем с "next", а не со старым overrides
      recompute(tools, detections, lastResult, next);
      return next;
    });
  };

  return (
    <div className="flex flex-row gap-8 w-full">
      {/* Левая часть – загрузка изображения */}
      <ImagePreview
        file={file}
        previewUrl={previewUrl}
        detections={detections}
        onPickFile={pickFile}
        onFileChange={onFileChange}
        inputRef={inputRef}
        palette={palette} 
      />

      {/* Правая часть – таблица и кнопки */}
      <div className="flex-1 bg-at-lightbrown rounded-[10px] px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-[24px]">Настройка параметров</h3>
        </div>

        <ControlsBar
          toolKits={toolKits}
          selectedToolKit={selectedToolKit}
          setSelectedToolKit={setSelectedToolKit}
          onRun={runDetection}
          disabled={!file || isRunning}
          isRunning={isRunning}
          models={models}
          chosenModel={chosenModel}
          setChosenModel={setChosenModel}
        />

        <div className="mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Сжимать изображение</span>
          </label>
        </div>

        <div className="mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ocr}
              onChange={(e) => setOcr(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Распознавать id</span>
          </label>
        </div>

        <div className="w-full border-t border-at-darkgray my-6" />

        <ToolsTable
          tools={tools}
          isRowPass={isRowPass}
          updateThreshold={updateThreshold}
          updateCount={updateCount}
          showOcr={ocr}
          showColors={true}
          palette={palette}
          setPalette={setPalette} 
        />


        <StatusBadge hasRun={hasRun} allGreen={allGreen} />

        <div className="mt-6">
          <button
            onClick={() =>
              downloadJson(
                lastResult,
                file?.name?.replace(/\.[^.]+$/, "") || "result"
              )
            }
            disabled={!lastResult}
            className="px-5 h-[38px] rounded-[6px] font-semibold bg-at-lightviolet text-white hover:bg-at-lightviolet/90 disabled:opacity-50"
          >
            Скачать JSON
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetectingPage;
