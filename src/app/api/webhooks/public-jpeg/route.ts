import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFile } from "fs/promises";
import path from "path";

// Віддає зображення з бібліотеки медіа як JPEG. Навіщо: Instagram API приймає ЛИШЕ JPEG, а наші згенеровані картинки лежать у PNG/WebP.
// Публікатор publish-instagram підставляє сюди URL замість прямого посилання на PNG.
//   GET ?p=/uploads/media/<проєкт>/<файл>.png  →  image/jpeg
// Без токена (Instagram забирає картинку без заголовків); безпечно, бо віддаються тільки файли з /uploads/media (вони й так публічні як статика).
const ALLOWED = /^\/uploads\/media\/[A-Za-z0-9_\-./]+\.(png|webp|jpe?g|gif)$/i;

function toJpeg(file: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // довша сторона ≤ 1440 (Instagram стискає більше); якість 2 ≈ 95%
    const ff = spawn("ffmpeg", ["-loglevel", "error", "-i", file, "-frames:v", "1", "-vf", "scale='min(1440,iw)':-2", "-q:v", "2", "-f", "mjpeg", "pipe:1"]);
    const chunks: Buffer[] = [];
    let err = "";
    ff.stdout.on("data", (c) => chunks.push(c));
    ff.stderr.on("data", (c) => (err += String(c)));
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 && chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error("ffmpeg: " + err.slice(0, 200)))));
  });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p") || "";
  if (!ALLOWED.test(p) || p.includes("..")) return NextResponse.json({ error: "bad path" }, { status: 400 });
  const file = path.join(process.cwd(), "public", p);
  try {
    const body = /\.jpe?g$/i.test(p) ? await readFile(file) : await toJpeg(file);
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  } catch (e: any) {
    return NextResponse.json({ error: "not found or conversion failed" }, { status: 404 });
  }
}
