import React from "react";
// если у тебя Dropdown лежит рядом, можно: import Dropdown from "../ui/Dropdown";
import Dropdown from "../ui/Dropdown";

interface Option { value: string; label: string }

interface Props {
  toolKits: Option[];
  selectedToolKit: string;
  setSelectedToolKit: (v: string) => void;
  onRun: () => void;
  disabled: boolean;
  isRunning: boolean;
  models: Option[];
  chosenModel: string;
  setChosenModel: (v: string) => void;
  threshhold: number;
  setThreshhold: (v: number) => void;
}

const ControlsBar: React.FC<Props> = ({
  toolKits,
  selectedToolKit,
  setSelectedToolKit,
  onRun,
  disabled,
  isRunning,
  models,
  chosenModel,
  setChosenModel,
  threshhold,
  setThreshhold,
}) => {
  return (
    <div className="flex items-end justify-between gap-8">
      <div className="flex-1">
        Набор инструментов:
        <Dropdown
          options={toolKits}
          value={selectedToolKit}
          onChange={setSelectedToolKit}
          placeholder="Выберите набор"
          className="mt-2 w-full"
        />
      </div>
      <div className="flex-1">
        Модель:
        <Dropdown
          options={models}
          value={chosenModel}
          onChange={setChosenModel}
          placeholder="Выберите модель"
          className="mt-2 w-full"
        />
      </div>

      <div className="flex-1 flex flex-col">
        Threshhold:
        <div>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={threshhold}
            onChange={(e) => setThreshhold(Number(e.target.value))}
            className="w-[68px] h-[34px] bg-black/20 border border-at-darkgray rounded px-2 outline-none"
          />%
        </div>
      </div>

      <button
        onClick={onRun}
        disabled={disabled}
        className="w-[140px] h-[38px] rounded-[6px] font-semibold bg-at-lightviolet text-white hover:bg-at-lightviolet/90 disabled:opacity-50"
      >
        {isRunning ? "Запуск..." : "Запустить"}
      </button>
    </div>
  );
};

export default ControlsBar;
