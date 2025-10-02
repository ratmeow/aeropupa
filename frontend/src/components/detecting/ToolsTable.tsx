import React, { useState } from "react";
import { type Tool } from "../../types/detecting";
import { RgbaColorPicker, type RgbaColor } from "react-colorful";

interface Props {
  tools: Tool[];
  isRowPass: (t: Tool) => boolean;
  updateThreshold: (id: number, v: number) => void;
  updateCount: (id: number, v: number) => void;
  showOcr?: boolean; 
  showColors?: boolean;

  palette?: string[];
  setPalette?: React.Dispatch<React.SetStateAction<string[]>>;
}

const ToolsTable: React.FC<Props> = ({ tools, isRowPass, updateThreshold, updateCount, showOcr = false, showColors = false, palette, setPalette, }) => {

  const colorFor = (id: number) => 
    palette ? palette[id % palette.length] : '#000000';

  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const hexToRgba = (hex: string): RgbaColor => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  };

  const rgbaToHex8 = ({ r, g, b, a }: RgbaColor) => {
    const to2 = (n: number) => n.toString(16).padStart(2, "0");
    const alpha = Math.round((a ?? 1) * 255);
    return `#${to2(r)}${to2(g)}${to2(b)}${to2(alpha)}`;
  };

  const setColorForId = (id: number, hexOrRgba: string | RgbaColor) => {
    if (!palette || !setPalette) return;
    const idx = id % palette.length;
    const hex =
      typeof hexOrRgba === "string" ? hexOrRgba : rgbaToHex8(hexOrRgba);
    setPalette(prev => prev.map((c, i) => (i === idx ? hex : c)));
  };


  return (
    <table className="w-full text-[14px]">
      <thead className="border-b border-at-darkgray bg-at-lighterbrown/40">
        <tr>
          <th className="px-6 py-2 text-left font-semibold">Инструмент</th>
          <th className="px-6 py-2 text-left font-semibold">Порог</th>
          <th className="px-6 py-2 text-left font-semibold">Уверенность</th>
          {showOcr && <th className="px-6 py-2 text-left font-semibold">ID</th>}
          <th className="px-6 py-2 text-left font-semibold">Кол-во</th>
        </tr>
      </thead>
      <tbody>
        {tools.map((tool, idx) => {
          const hasConf = typeof tool.confidence === "number";
          const pass = isRowPass(tool);
          const ocr = (tool.ocr ?? "").trim();
          return (
            <tr key={tool.id} className={idx % 2 === 0 ? "bg-at-lighterbrown/20" : ""}>

              <td className="px-6 py-1">
                {showColors && 
                  <>
                  {/* Квадратик-активатор */}
                  <button
                    type="button"
                    aria-label={`Выбрать цвет для ${tool.name}`}
                    className="inline-block w-4 h-4 rounded-sm border border-black/30 align-middle mr-2"
                    style={{ backgroundColor: colorFor(tool.id) }}
                    onClick={() => setPickerFor(pickerFor === tool.id ? null : tool.id)}
                  />

                  {/* Поповер с пикером */}
                  {pickerFor === tool.id && (
                    <div 
                      className={`absolute z-50 mt-2 p-3 rounded-md border border-black/20 bg-white shadow-lg translate-y-[-260px]`}
                    >
                      <div className="flex items-start gap-3">
                        <RgbaColorPicker
                          color={hexToRgba(colorFor(tool.id))}
                          onChange={(rgba) => setColorForId(tool.id, rgba)}
                        />
                        <div className="flex flex-col gap-2 text-black">
                          <input
                            className="w-[120px] px-2 py-1 border rounded text-sm"
                            value={colorFor(tool.id)}
                            onChange={(e) => setColorForId(tool.id, e.target.value)}
                          />
                          <button
                            type="button"
                            className="px-2 py-1 border rounded text-sm"
                            onClick={() => setPickerFor(null)}

                          >
                            Готово
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                }
                {tool.name}
              </td>

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
                    {tool.confidence!.toFixed(1)} %
                  </span>
                ) : (
                  <span className="text-gray-400 italic">—</span>
                )}
              </td>

              {showOcr && (
                <td className="px-6 py-1">
                  {ocr ? <code className="text-xs bg-black/20 px-2 py-1 rounded">{ocr}</code> : <span className="text-gray-400 italic">—</span>}
                </td>
              )}

              <td className="px-6 py-1">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={tool.count ?? 0}
                  onChange={(e) => updateCount(tool.id, Number(e.target.value))}
                  className="w-[68px] h-[34px] bg-black/20 border border-at-darkgray rounded px-2 outline-none"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ToolsTable;
