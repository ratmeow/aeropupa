import React, { useEffect, useMemo, useRef, useState } from "react";
import ControlsBar from "../components/detecting/ControlsBar";
import ImagePreview from "../components/detecting/ImagePreview";
import StatusBadge from "../components/detecting/StatusBadge";
import ToolsTable from "../components/detecting/ToolsTable";
import { downloadJson } from "../utils/downloadJson";
import type { Detection, ResponseData, Tool } from "../types/detecting";

const toolKits = [{ value: "Test1", label: "Тестовый набор" }];

interface Option { value: string; label: string }
const models: Option[] = [];

// Инициализируем пороги числами (проценты)
const initialTools: Tool[] = [
  { id: 0, name: "Отвертка «-»", threshold: 98 },
  { id: 1, name: "Отвертка «+»", threshold: 98 },
  { id: 2, name: "Отвертка на смещенный крест", threshold: 98 },
  { id: 3, name: "Коловорот", threshold: 98 },
  { id: 4, name: "Пассатижи контровочные", threshold: 98 },
  { id: 5, name: "Пассатижи", threshold: 98 },
  { id: 6, name: "Шэрница", threshold: 98 },
  { id: 7, name: "Разводной ключ", threshold: 98 },
  { id: 8, name: "Открывашка для банок с маслом", threshold: 98 },
  { id: 9, name: "Ключ рожковый/накидной ¾", threshold: 98 },
  { id: 10, name: "Бокорезы", threshold: 98 },
];

const DetectingPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [tools, setTools] = useState<Tool[]>(initialTools);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false); // показывать ли плашку статуса
  const [selectedToolKit, setSelectedToolKit] = useState<string>(toolKits[0].value);
  const [lastResult, setLastResult] = useState<ResponseData | null>(null); // для скачивания JSON

  const [chosenModel, setChosenModel] = useState<string>("");
  
  const [threshhold, setThreshhold] = useState<number>(50);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/models');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const data = await response.json();
        const available = data.available;

        console.log('available', available);

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
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleLocalPreview(f);
  };

  const runDetection = async () => {
    if (!file) return;
    setIsRunning(true);
    setHasRun(false);

    try {
      const formData = new FormData();
      formData.append("img_file", file, file.name); // файл
      formData.append("model_name", chosenModel); // строка
      formData.append("confidence_threshold", `${(threshhold/100)}`); // строка (числа тоже как строки)
      // локальная заглушка ответа
      // const res = await fetch("/response.json");
      console.log('formData', formData);
      const res = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });
      const data: ResponseData = await res.json();

      console.log('data response', data);

      setDetections(data.detections);
      setLastResult(data);

      // обновляем confidence по совпадению id
      // если детекция не найдена → confidence = 0.0
      const updated = initialTools.map((tool) => {
        const det = data.detections.find(
          (d) => d.class_id === tool.id
        );
        return det
          ? { ...tool, confidence: Math.round(det.confidence * 1000) / 10 } // 1 знак после запятой
          : { ...tool, confidence: 0.0 };
      });
      setTools(updated);
    } finally {
      setIsRunning(false);
      setHasRun(true); // запуск завершён — можно показывать плашку
    }
  };

  const isRowPass = (t: Tool) =>
    typeof t.confidence === "number" && t.confidence >= t.threshold;

  // Индикатор «все зелёные»: проверяем все строки таблицы
  const allGreen = useMemo(() => {
    if (!hasRun) return false;
    return tools.every(isRowPass);
  }, [tools, hasRun]);

  const updateThreshold = (id: number, value: number) => {
    const v = Math.max(0, Math.min(100, value));
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, threshold: v } : t)));
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
      />

      {/* Правая часть – таблица и кнопки */}
      <div className="flex-1 bg-at-lightbrown rounded-[10px] px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-[24px]">Настройка параметров</h3>
          {/* индикатор раньше был здесь */}
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
          threshhold={threshhold}
          setThreshhold={setThreshhold}
        />

        <div className="w-full border-t border-at-darkgray my-6" />

        <ToolsTable
          tools={tools}
          isRowPass={isRowPass}
          updateThreshold={updateThreshold}
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
