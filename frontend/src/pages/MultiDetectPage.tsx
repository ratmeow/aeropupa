import React, { useEffect, useMemo, useRef, useState } from "react";
import { type Tool, type Detection, type ResponseData, initialTools } from "../types/detecting";
import ToolsTable from "../components/detecting/ToolsTable";
import { downscaleImage, mapWithConcurrency } from "../utils/imageCompress";

const API_URL_BATCH  = "/api/detect/batch";
const DEFAULT_MODEL = "main"; 
const DEFAULT_CONFIDENCE = 0.5;  
const DEFAULT_BS = 8;           


/** Сколько раз найден инструмент данного типа */
function countForTool(tool: Tool, detections: Detection[]): number {
  return detections.filter((d) => d.class_id === tool.id).length;
}


/** Сколько детекций этого типа ПРОШЛИ порог инструмента */
function passCountForTool(tool: Tool, detections: Detection[]): number {
  const th = tool.threshold; // порог в %
  return detections.reduce((acc, d) => {
    if (d.class_id !== tool.id) return acc;
    const c = pct(d.confidence) ?? 0;
    return c >= th ? acc + 1 : acc;  // считаем только прошедшие порог
  }, 0);
}

/** Максимальная уверенность по типу (для отображения в таблице) */
function maxConfidencePctForTool(tool: Tool, detections: Detection[]): number | undefined {
  const confs = detections.filter(d => d.class_id === tool.id).map(d => pct(d.confidence) ?? 0);
  return confs.length ? Math.max(...confs) : undefined;
}

/** Правила валидации кадра: ровно 1 каждого типа и порог выполнен */
function computePhotoValidation(
  tools: Tool[],
  detections: Detection[],
  overrides?: { counts?: Record<number, number> }
) {
  const countsByTool: Record<number, number> = {};
  const maxConfByTool: Record<number, number | undefined> = {};
  const perToolPassed: Record<number, boolean> = {};

  for (const t of tools) {
    const basePassCount = passCountForTool(t, detections);       // считаем только прошедшие порог
    const effectiveCount = overrides?.counts?.[t.id] ?? basePassCount; // ручная правка имеет приоритет

    countsByTool[t.id] = effectiveCount;
    maxConfByTool[t.id] = maxConfidencePctForTool(t, detections); // для UI

    // корректно, если ровно 1
    perToolPassed[t.id] = effectiveCount === 1;
  }

  const overallPassed = Object.values(perToolPassed).every(Boolean);
  const hasMismatch = !overallPassed;

  return { countsByTool, maxConfByTool, perToolPassed, overallPassed, hasMismatch };
}


function recomputeFile(file: FileItem, toolsState: Tool[]): FileItem {
  if (!file.data) return file;
  const { countsByTool, maxConfByTool, perToolPassed, overallPassed, hasMismatch } =
    computePhotoValidation(toolsState, file.data.detections ?? [], file.overrides);

  const patchedData = {
    ...file.data,
    match: { ...(file.data.match ?? { overall: 0, passed: false }), passed: overallPassed },
    client: { countsByTool, maxConfByTool, perToolPassed, overallPassed },
  };

  return { ...file, data: patchedData, hasMismatch };
}



function recomputeAllFiles(filesState: FileItem[], toolsState: Tool[]): FileItem[] {
  return filesState.map((f) => recomputeFile(f, toolsState));
}

/** ------------------------------------------------------
 * Модель файла на странице
 * ------------------------------------------------------ */
export type FileItem = {
  id: number;
  file: File;
  name: string;
  url: string;
  status: "idle" | "processing" | "done" | "error";
  hasMismatch?: boolean;
  data?: ResponseData & {
    // клиентские поля попадут и в скачиваемый JSON
    client?: {
      countsByTool: Record<number, number>;
      maxConfByTool: Record<number, number | undefined>;
      perToolPassed: Record<number, boolean>;
      overallPassed: boolean;
    }
  };
  error?: string;

  // локальные правки пользователя (на файл)
  overrides?: {
    counts?: Record<number, number>;
    confidences?: Record<number, number>; // на будущее, если разрешишь правку уверенности
  };
};


/** ------------------------------------------------------
 * Вспомогательные функции
 * ------------------------------------------------------ */
function downloadJSON(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function pct(x: number) {
  return Math.round(x * 100);
}


/** Адаптер backend-элемента к локальному ResponseData */
type BackendBatchItem = {
  filename: string;
  detections: Detection[];
  match?: { overall?: number };
  stats?: { match_expected_set?: { passed?: boolean } };
};

type BackendBatchResponse = {
  items: BackendBatchItem[];
  errors?: any[];
  summary?: { input_files: number; processed: number; model: string; batch: number };
};

function adaptBackendItemToResponseData(item: BackendBatchItem): ResponseData {
  const detections = (item.detections ?? []);
  const overall = item.match?.overall ?? 0;
  const passed = item.stats?.match_expected_set?.passed ?? false;
  return { detections, match: { overall, passed } };
}

/** ------------------------------------------------------
 * Мелкие UI-компоненты
 * ------------------------------------------------------ */
const StatusDot: React.FC<{ ok?: boolean; processing?: boolean }> = ({ ok, processing }) => (
  <span
    className={[
      "inline-block w-3 h-3 rounded-full border",
      processing ? "bg-yellow-400 border-yellow-500 animate-pulse" : ok ? "bg-emerald-500 border-emerald-600" : "bg-rose-500 border-rose-600",
    ].join(" ")}
    title={processing ? "Обработка" : ok ? "Совпадает" : "Есть расхождения"}
  />
);

const IconChevron: React.FC<{ dir: "left" | "right"; className?: string }> = ({ dir, className }) => (
  <svg viewBox="0 0 24 24" className={["w-8 h-8", className].join(" ")} aria-hidden>
    {dir === "left" ? (
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    ) : (
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    )}
  </svg>
);

/** ------------------------------------------------------
 * Главная страница
 * ------------------------------------------------------ */
const MultiDetectPage: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Пороги инструментов — в стейте, чтобы ToolsTable могла менять threshold
  const [tools, setTools] = useState<Tool[]>(initialTools());
  
  const [compress, setCompress] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const indexInputRef = useRef<HTMLInputElement | null>(null);

  const currentItem = files[current];

  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDirectory = () => fileInputRef.current?.click();

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl || !fl.length) return;

    const images = Array.from(fl).filter((f) => f.type.startsWith("image/"));
    const items: FileItem[] = images.map((file, i) => ({
      id: Date.now() + i,
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      status: "idle",
    }));
    setFiles(items);
    setCurrent(0);
  };


  /** Один батч-запрос — формируем multipart и раскладываем ответ по именам */
  const analyzeBatch = async (items: FileItem[]): Promise<(ResponseData | null)[]> => {
    const formData = new FormData();

    if (compress) {
      const processed = await mapWithConcurrency(items, 6, async (it) => {
        return downscaleImage(it.file);
      });

      for (const file of processed) {
        formData.append("files", file, file.name);
      }
    } else {
      for (const it of items) formData.append("files", it.file);
    }

    formData.append("model_name", DEFAULT_MODEL);
    formData.append("bs", String(DEFAULT_BS));
    formData.append("confidence_threshold", String(DEFAULT_CONFIDENCE));

    const res = await fetch(API_URL_BATCH, { method: "POST", body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json: BackendBatchResponse = await res.json();

    // ---------- НОРМАЛИЗАЦИЯ И СООТНЕСЕНИЕ ПО ИМЕНИ ----------
    const base = (s: string) => s.split(/[\\/]/).pop() || s;
    const noExt = (s: string) => base(s).replace(/\.[^.]+$/, "");
    const normFull = (s: string) => base(s).toLowerCase();
    const normNoExt = (s: string) => noExt(s).toLowerCase();

    type Pair = { data: ResponseData; used?: boolean };
    const mapByFull = new Map<string, Pair>();
    const mapByNoExt = new Map<string, Pair>();
    const backendList: Pair[] = [];

    for (const it of json.items ?? []) {
      const data = adaptBackendItemToResponseData(it);
      const full = normFull(it.filename ?? "");
      const short = normNoExt(it.filename ?? "");
      const pair: Pair = { data };
      backendList.push(pair);
      if (full) mapByFull.set(full, pair);
      if (short) mapByNoExt.set(short, pair);
    }

    const out: (ResponseData | null)[] = new Array(items.length).fill(null);

    // 1-й проход — по имени
    items.forEach((f, idx) => {
      const candidateNames = [
        normFull(f.name),
        normNoExt(f.name),
        // @ts-expect-error webkitRelativePath есть у File в Chromium
        f.webkitRelativePath ? normFull(f.webkitRelativePath) : "",
        // @ts-expect-error
        f.webkitRelativePath ? normNoExt(f.webkitRelativePath) : "",
      ].filter(Boolean);

      for (const key of candidateNames) {
        const pair = mapByFull.get(key) ?? mapByNoExt.get(key);
        if (pair && !pair.used) {
          out[idx] = pair.data;
          pair.used = true;
          break;
        }
      }
    });

    // 2-й проход — фолбэк по порядку
    let cursor = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== null) continue;
      while (cursor < backendList.length && backendList[cursor].used) cursor++;
      if (cursor < backendList.length) {
        backendList[cursor].used = true;
        out[i] = backendList[cursor].data;
        cursor++;
      } else {
        out[i] = null;
      }
    }

    return out;
  };

  const runAnalysis = async () => {
    if (!files.length || isAnalyzing) return;
    setIsAnalyzing(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "processing", error: undefined })));

    try {
      const results = await analyzeBatch(files); // в порядке исходных файлов

      setFiles((prev) =>
        prev.map((f, i) => {
          const data = results[i];
          if (!data) return { ...f, status: "error", error: "Нет данных" };

          const { countsByTool, maxConfByTool, perToolPassed, overallPassed, hasMismatch } =
            computePhotoValidation(tools, data.detections ?? [], f.overrides);

          const patchedData = {
            ...data,
            match: { ...(data.match ?? { overall: 0, passed: false }), passed: overallPassed },
            client: { countsByTool, maxConfByTool, perToolPassed, overallPassed },
          };

          return { ...f, status: "done", data: patchedData, hasMismatch };
        })
      );

    } catch (err: any) {
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error", error: err?.message ?? "Ошибка запроса" })));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const goto = (idx: number) => {
    if (!files.length) return;
    const clamped = Math.max(0, Math.min(files.length - 1, idx));
    setCurrent(clamped);
    if (indexInputRef.current) indexInputRef.current.value = String(clamped + 1);
  };
  const next = () => goto(current + 1);
  const prev = () => goto(current - 1);

  /** Готовим данные для ToolsTable: confidence в процентах (0–100) */
  const toolsWithConfidence: Tool[] = useMemo(() => {
    const dets = currentItem?.data?.detections ?? [];
    const counts = currentItem?.data?.client?.countsByTool;
    return tools.map((t) => {
      const conf = maxConfidencePctForTool(t, dets);
      const count = counts?.[t.id] ?? countForTool(t, dets);
      return { ...t, confidence: conf, count }; // count нужен для редактирования в таблице
    });
  }, [currentItem?.data, tools]);


  /** Коллбеки под API ToolsTable */
  const isRowPass = (t: Tool) => {
    // Условие теперь только по количеству (оно уже «после порога»)
    const cnt = (t as any).count as number | undefined;
    return cnt === 1;
  };

  const updateThreshold = (id: number, v: number) => {
    setTools((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, threshold: v } : t));
      setFiles((ff) => recomputeAllFiles(ff, next)); // т.к. порог меняет passCount
      return next;
    });
  };


// count — это правка на УРОВНЕ ТЕКУЩЕГО ФАЙЛА
const updateCount = (id: number, v: number) => {
  setFiles((prev) => {
    if (!prev.length) return prev;
    return prev.map((f, idx) => {
      if (idx !== current) return f;
      const overrides = { ...(f.overrides ?? {}), counts: { ...(f.overrides?.counts ?? {}), [id]: v } };
      return recomputeFile({ ...f, overrides }, tools);
    });
  });
};


  return (
    <div className="flex-1 flex gap-6 p-6 overflow-hidden">
      {/* Левая колонка */}
      <aside className="bg-[#1a161d] w-[320px] rounded-2xl shadow-lg p-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={openDirectory}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm font-medium"
          >
            Открыть
          </button>
          <button
            onClick={runAnalysis}
            disabled={!files.length || isAnalyzing}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium"
          >
            Запустить
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            // @ts-expect-error: webkitdirectory — поддерживается Chromium/Edge; для Firefox будет multiple
            webkitdirectory=""
            onChange={handlePick}
            className="hidden"
            accept="image/*"
          />
        </div>

        <div className="p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Сжимать изображения</span>
          </label>
        </div>

        <div className="mt-4 text-xs text-white/60">Файлов: {files.length}</div>

        <div className="mt-3 flex-1 overflow-auto pr-2 space-y-2 max-h-[500px]">
          {files.map((f, i) => (
            <button
              key={f.id}
              onClick={() => goto(i)}
              className={[
                "w-full text-left px-3 py-2 rounded-xl border flex items-center gap-2",
                i === current ? "bg-white/10 border-white/20" : "bg-transparent border-white/10 hover:bg-white/5",
              ].join(" ")}
            >
              {f.status === "processing" ? (
                <StatusDot processing />
              ) : f.status === "done" ? (
                <StatusDot ok={!f.hasMismatch} />
              ) : f.status === "error" ? (
                <span className="text-rose-400">×</span>
              ) : (
                <span className="w-3 h-3 inline-block rounded-full bg-white/20" />
              )}
              <span className="truncate flex-1 text-sm">{f.name}</span>
            </button>
          ))}

          {!files.length && (
            <div className="text-sm text-white/50">
              Выберите директорию с изображениями
            </div>
          )}
        </div>
      </aside>

      {/* Центр: превью и навигация */}
      <main
        className="bg-[#1a161d] rounded-2xl shadow-lg p-4 relative flex flex-col items-center justify-center overflow-hidden flex-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
          if (!dropped.length) return;
          const items: FileItem[] = dropped.map((file, i) => ({
            id: Date.now() + i,
            file,
            name: file.name,
            url: URL.createObjectURL(file),
            status: "idle",
          }));
          setFiles(items);
          setCurrent(0);
        }}
      >
        {/* Навигация слева/справа */}
        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
          disabled={!files.length || current === 0}
        >
          <IconChevron dir="left" />
        </button>

        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
          disabled={!files.length || current === files.length - 1}
        >
          <IconChevron dir="right" />
        </button>

        {/* Превью */}
        {currentItem ? (
          <div className="max-h-[70vh] max-w-full flex flex-col items-center gap-3">
            <img
              src={currentItem.url}
              alt={currentItem.name}
              className="max-h-[60vh] max-w-[74vw] object-contain rounded-xl border border-white/10 bg-black"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded bg-white/10">{current + 1} / {files.length}</span>
              <input
                ref={indexInputRef}
                type="number"
                min={1}
                max={Math.max(1, files.length)}
                defaultValue={current + 1}
                className="w-24 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-sm"
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) goto(v - 1);
                }}
              />
              <span className="text-white/60 text-sm">№ изображения</span>
            </div>
          </div>
        ) : (
          <div className="text-white/50 text-sm">Нет выбранного изображения</div>
        )}
      </main>

      {/* Правая колонка: ToolsTable + кнопка скачать JSON */}
      <aside className="bg-[#1a161d] rounded-2xl shadow-lg p-4 flex flex-col overflow-hidden w-[640px]">
        <div className="text-sm font-medium mb-2">Результаты по изображению</div>

        <div className="flex-1 overflow-auto rounded-xl border border-white/10">
          <ToolsTable
            tools={toolsWithConfidence}
            isRowPass={isRowPass}
            updateThreshold={updateThreshold}
            updateCount={updateCount}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-white/60">
            {currentItem?.status === "done" && currentItem.data && (
              <span>
                Итог: {currentItem.hasMismatch ? (
                  <span className="text-rose-400">есть расхождения</span>
                ) : (
                  <span className="text-emerald-400">совпадает</span>
                )}
                <span className="ml-2 text-white/50">
                  (score: {Math.round((currentItem.data.match.overall ?? 0) * 100)}%, passed: {String(currentItem.data.match.passed)})
                </span>
              </span>
            )}
            {currentItem?.status === "processing" && <span>Обработка…</span>}
            {currentItem?.status === "error" && currentItem.error && <span className="text-rose-400">{currentItem.error}</span>}
          </div>

          <button
            onClick={() => {
              if (!currentItem?.data) return;
              downloadJSON(currentItem.name.replace(/\.[^.]+$/, ""), currentItem.data);
            }}
            disabled={!currentItem?.data}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50"
          >
            Скачать JSON
          </button>
        </div>
      </aside>
    </div>
  );
};

export default MultiDetectPage;
