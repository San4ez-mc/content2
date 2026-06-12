import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ParamField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

type ToolDesc = {
  aiDescription: string;
  exampleOutput: string;
  paramsSchema: ParamField[];
};

const TOOL_DESCRIPTIONS: Record<string, ToolDesc> = {
  "content-ai-bg": {
    aiDescription:
      "Генерує зображення з AI-фоном (FLUX schnell) та накладеним текстом. Підходить для: інформаційних постів, цитат, анонсів, кейсів з результатами. Швидка генерація, хороша якість для соцмереж.",
    exampleOutput: "AI-фон з текстом поверх. Формат 1:1 або 9:16.",
    paramsSchema: [
      { key: "imagePrompt", label: "Опис зображення", type: "text", required: true },
      { key: "palette", label: "Палітра дизайну", type: "select", options: ["DARK_CINEMATIC", "MINIMAL_WHITE", "ENERGY_ORANGE", "TRUST_BLUE", "PREMIUM_PURPLE"], required: false },
    ],
  },
  "content-ai-bg-pro": {
    aiDescription:
      "Генерує зображення з AI-фоном у 2K якості (FLUX Pro). Підходить для: преміум контенту, реклами, коли потрібна висока деталізація. Повільніша але якісніша за content-ai-bg.",
    exampleOutput: "Фотореалістичний AI-фон 2K з текстом. Формат 1:1 або 9:16.",
    paramsSchema: [
      { key: "imagePrompt", label: "Опис зображення", type: "text", required: true },
      { key: "palette", label: "Палітра дизайну", type: "select", options: ["DARK_CINEMATIC", "MINIMAL_WHITE", "ENERGY_ORANGE", "TRUST_BLUE", "PREMIUM_PURPLE"], required: false },
    ],
  },
  "content-ideogram": {
    aiDescription:
      "Генерує зображення через Ideogram V3 — найкращий AI для зображень З ТЕКСТОМ всередині картинки. Підходить для: мемів, афіш, коли потрібні написи прямо на картинці.",
    exampleOutput: "Зображення з красиво вбудованим текстом/написами прямо в картинці.",
    paramsSchema: [
      { key: "imagePrompt", label: "Опис зображення + текст для написів", type: "text", required: true },
      { key: "style", label: "Стиль", type: "select", options: ["realistic", "design", "illustration", "3d"], required: false },
    ],
  },
  "content-recraft": {
    aiDescription:
      "Генерує брендові графічні дизайни через Recraft V4. Підходить для: брендованих матеріалів, інфографіки з фірмовим стилем.",
    exampleOutput: "Векторний або растровий брендовий дизайн.",
    paramsSchema: [
      { key: "imagePrompt", label: "Опис дизайну", type: "text", required: true },
      { key: "style", label: "Стиль Recraft", type: "select", options: ["realistic_image", "digital_illustration", "vector_illustration", "icon"], required: false },
    ],
  },
  "content-stories-generator": {
    aiDescription:
      "Автогенерація Stories (вертикальний формат 9:16). Підходить для: Instagram/Facebook Stories, Telegram Stories, Reels-обкладинок.",
    exampleOutput: "Вертикальне Stories зображення 9:16 з текстом і фоном.",
    paramsSchema: [
      { key: "imagePrompt", label: "Опис фону/сцени", type: "text", required: true },
      { key: "title", label: "Заголовок Stories", type: "text", required: false },
      { key: "subtitle", label: "Підзаголовок", type: "text", required: false },
    ],
  },
  "content-carousel": {
    aiDescription:
      "Генерує карусель з кількох слайдів з безшовним фоном. Підходить для: навчального контенту, списків, step-by-step гайдів, порівнянь. Кожен слайд має свій текст та єдиний стиль.",
    exampleOutput: "Серія з 3-8 слайдів з єдиним дизайном. Перший — обкладинка, останній — CTA.",
    paramsSchema: [
      { key: "slides", label: "Кількість слайдів", type: "number", required: true },
      { key: "imagePrompt", label: "Опис стилю фону", type: "text", required: true },
      { key: "palette", label: "Палітра", type: "select", options: ["DARK_CINEMATIC", "MINIMAL_WHITE", "ENERGY_ORANGE", "TRUST_BLUE", "PREMIUM_PURPLE"], required: false },
    ],
  },
  "content-image-template": {
    aiDescription:
      "Рендерить зображення за готовим шаблоном з підставленням тексту/даних. Підходить для: регулярних рубрик зі сталим дизайном, результатів, статистики.",
    exampleOutput: "Зображення за шаблоном з підставленими даними.",
    paramsSchema: [
      { key: "templateId", label: "ID шаблону", type: "text", required: true },
      { key: "fields", label: "Поля для підставлення (JSON)", type: "json", required: true },
    ],
  },
  "content-video-broll": {
    aiDescription:
      "Генерує AI B-roll відео через Kling. Підходить для: Reels, TikTok, коли потрібне коротке відео замість статичного зображення.",
    exampleOutput: "Короткий відеокліп 3-10 секунд.",
    paramsSchema: [
      { key: "videoPrompt", label: "Опис відео", type: "text", required: true },
      { key: "duration", label: "Тривалість (сек)", type: "number", required: false },
    ],
  },
};

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const synced: string[] = [];

  for (const [slug, desc] of Object.entries(TOOL_DESCRIPTIONS)) {
    const name = slug
      .replace("content-", "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    await prisma.contentTool.upsert({
      where: { slug },
      create: {
        slug,
        name,
        aiDescription: desc.aiDescription,
        exampleOutput: desc.exampleOutput,
        paramsSchema: desc.paramsSchema,
        syncedAt: new Date(),
      },
      update: {
        aiDescription: desc.aiDescription,
        exampleOutput: desc.exampleOutput,
        paramsSchema: desc.paramsSchema,
        syncedAt: new Date(),
      },
    });
    synced.push(slug);
  }

  return NextResponse.json({ ok: true, synced });
}
