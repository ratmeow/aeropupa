import React from "react";
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
