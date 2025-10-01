import type { ResponseData } from "../types/detecting";

export function downloadJson(lastResult: ResponseData | null, baseName?: string) {
  if (!lastResult) return;
  const pretty = JSON.stringify(lastResult, null, 2);
  const blob = new Blob([pretty], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName || "result"}_detections.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
