import React from "react";
import type { Tool } from "../../types/detecting";

interface Props {
  tools: Tool[];
  isRowPass: (t: Tool) => boolean;
  updateThreshold: (id: number, v: number) => void;
}

const ToolsTable: React.FC<Props> = ({ tools, isRowPass, updateThreshold }) => {
  return (
    <table className="w-full text-[16px]">
      <thead className="border-b border-at-darkgray bg-at-lighterbrown/40">
        <tr>
          <th className="px-6 py-2 text-left font-semibold">Инструмент</th>
          <th className="px-6 py-2 text-left font-semibold">Порог</th>
          <th className="px-6 py-2 text-left font-semibold">Уверенность</th>
        </tr>
      </thead>
      <tbody>
        {tools.map((tool, idx) => {
          const hasConf = typeof tool.confidence === "number";
          const pass = isRowPass(tool);
          return (
            <tr key={tool.id} className={idx % 2 === 0 ? "bg-at-lighterbrown/20" : ""}>
              <td className="px-6 py-1">{tool.name}</td>
              <td className="px-6 py-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={tool.threshold}
                    onChange={(e) => updateThreshold(tool.id, Number(e.target.value))}
                    className="w-[68px] h-[34px] bg-black/20 border border-at-darkgray rounded px-2 outline-none"
                  />
                  <span>%</span>
                </div>
              </td>
              <td className="px-6 py-1">
                {hasConf ? (
                  <span className={"font-semibold " + (pass ? "text-green-400" : "text-red-400")}>
                    {tool.confidence?.toFixed(1)} %
                  </span>
                ) : (
                  <span className="text-gray-400 italic">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ToolsTable;
