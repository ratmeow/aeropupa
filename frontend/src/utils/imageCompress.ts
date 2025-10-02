export async function downscaleImage(
    file: File,
    maxSide = 1280,
    mime: "image/jpeg" | "image/png" = "image/jpeg",
    quality = 0.82
  ): Promise<File> {
    const img = await createImageBitmap(file);
    let { width, height } = img;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d")!;
    // важно для качества даунскейла
    (ctx as any).imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await canvas.convertToBlob({ type: mime, quality });
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + (mime === "image/png" ? ".png" : ".jpg"), { type: blob.type });
  }


  
  // Универсальная утилита "map с лимитом"
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;

    async function run() {
      while (true) {
        const i = next++;
        if (i >= items.length) break;
        results[i] = await worker(items[i], i);
      }
    }

    const runners = Array.from({ length: Math.min(limit, items.length) }, run);
    await Promise.all(runners);
    return results;
  }