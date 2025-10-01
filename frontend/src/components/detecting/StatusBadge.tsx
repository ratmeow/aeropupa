import React from "react";

interface Props { hasRun: boolean; allGreen: boolean }

const StatusBadge: React.FC<Props> = ({ hasRun, allGreen }) => {
  if (!hasRun) return null;
  return (
    <div className="mt-4">
      <span
        className={[
          "px-3 py-1 rounded-[999px] text-sm font-semibold",
          allGreen ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400",
        ].join(" ")}
        title={
          allGreen
            ? "Все инструменты удовлетворяют порогам"
            : "Есть инструменты ниже порога или не распознаны (0%)"
        }
      >
        {allGreen ? "Проверка пройдена" : "Найдены расхождения"}
      </span>
    </div>
  );
};

export default StatusBadge;
