import { prisma } from "@/lib/prisma";

// Опис воронок-інструментів для Content Manager (ContentTool). Синхронізується кнопкою в адмінці або вебхуком project-admin {action:"sync_tools"}.
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
  "content-short-video": {
    aiDescription:
      "Збирає КОРОТКЕ ВЕРТИКАЛЬНЕ ВІДЕО (9:16, 10-20 с) БЕЗ людини в кадрі з готового сценарію: для кожної сцени AI-ілюстрація/кадр у єдиному стилі, рух камери, великий текст на екрані, музика під ритм. Для TikTok, YouTube Shorts, Instagram Reels. Сценарій передається в funnel_params.scenes (кожна сцена: visual — опис кадру англійською, text — напис українською на екрані, sec — тривалість), music.prompt — настрій музики, style — спільний стиль усіх кадрів. Поле content поста = підпис (caption) з хештегами.",
    exampleOutput: "MP4 9:16, 12-18 секунд: 4-6 сцен у єдиному мультяшному стилі, великі субтитри, фонова музика. Перша сцена — хук, остання — CTA.",
    paramsSchema: [
      { key: "scenes", label: "Сцени (JSON-масив {visual, text, sec, motion})", type: "json", required: true },
      { key: "style", label: "Єдиний стиль усіх кадрів (англійською)", type: "text", required: true },
      { key: "music", label: "Музика ({prompt})", type: "json", required: false },
      { key: "coverTitle", label: "Заголовок обкладинки", type: "text", required: false },
    ],
  },
  "video-talking-edit": {
    aiDescription:
      "МОНТАЖ РОЗМОВНОГО ВІДЕО зі сирого файлу (спікер дивиться в камеру). Розпізнає мовлення, ШІ-редактор вирізає тишу на початку й у кінці, паузи, вдихи, слова-паразити й зайві речення, кадрує під 9:16, додає зуми, субтитри з підсвіткою слова, заголовок-хук, плашку спікера, іконки-картинки, звуки, музику, заклик (CTA) і прогрес-бар. Для рекламних креативів і Reels/TikTok/Shorts. Джерело: funnel_params.videoUrl (https-посилання або файл у Сховищі на сервері). Результат: MP4 1080x1920 у календарі за 3-6 хв.",
    exampleOutput: "MP4 9:16, 30-55 с: чисте мовлення без пауз, субтитри, хук зверху, плашка з іменем спікера, 2-3 іконки, музика під голосом, CTA в кінці.",
    paramsSchema: [
      { key: "videoUrl", label: "Сире відео (https або файл на сервері)", type: "text", required: true },
      { key: "speaker", label: "Спікер ({name, role})", type: "json", required: false },
      { key: "cta", label: "Заклик у кінці ({text, sub})", type: "json", required: false },
      { key: "targetSec", label: "Цільова тривалість, с (15-75)", type: "number", required: false },
      { key: "purpose", label: "Мета", type: "select", options: ["ad", "reel"], required: false },
      { key: "topic", label: "Контекст для ШІ-редактора", type: "text", required: false },
    ],
  },
  "avatar-photo": {
    aiDescription:
      "НОВЕ ФОТО АВАТАРА (персонаж бренду, напр. Кіра): бере референси й правила компанії зі сторінки «Аватар», малює нове фото в заданій сцені (місце, поза, світло, інші люди на фоні) і привʼязує до поста. Для Instagram-фото й постів з обличчям бренду. Підпис до фото обовʼязковий і пишеться окремо в content.",
    exampleOutput: "PNG 4:5 (або 9:16, 1:1): аватар у сцені з опису, одяг і риси обличчя за правилами аватара.",
    paramsSchema: [
      { key: "scene", label: "Сцена англійською (де, що робить, світло)", type: "text", required: true },
      { key: "shot", label: "Кадр", type: "select", options: ["portrait", "laugh", "pull_flyer", "profile", "fullbody", "surprise", "smile", "skeptic"], required: false },
      { key: "aspect", label: "Формат", type: "select", options: ["4:5", "9:16", "1:1"], required: false },
      { key: "topic", label: "Рубрика (колір стрічки флаєра)", type: "select", options: ["concert", "party", "day", "culture", "sport", "free"], required: false },
      { key: "outfit", label: "Інший одяг (англійською)", type: "text", required: false },
      { key: "count", label: "Скільки варіантів (1-4)", type: "number", required: false },
    ],
  },
  "avatar-story": {
    aiDescription:
      "СТОРІЗ З АВАТАРОМ: нове фото аватара 9:16 у сцені + текст-заголовок поверх (шаблон, що не закриває обличчя). Для щоденних сторіз Instagram. Анонси реальних подій робляться без цієї воронки: готова картка події береться з get_events (image_path).",
    exampleOutput: "PNG 9:16: аватар у сцені, великий заголовок і підзаголовок знизу.",
    paramsSchema: [
      { key: "scene", label: "Сцена англійською", type: "text", required: true },
      { key: "title", label: "Заголовок українською (3-7 слів)", type: "text", required: true },
      { key: "subtitle", label: "Підзаголовок українською", type: "text", required: false },
      { key: "shot", label: "Кадр", type: "select", options: ["portrait", "laugh", "pull_flyer", "profile", "fullbody", "surprise", "smile", "skeptic"], required: false },
      { key: "topic", label: "Рубрика", type: "select", options: ["concert", "party", "day", "culture", "sport", "free"], required: false },
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

export async function syncContentTools(): Promise<string[]> {
  const synced: string[] = [];
  
    for (const [slug, desc] of Object.entries(TOOL_DESCRIPTIONS)) {
      const NAMES: Record<string, string> = { "video-talking-edit": "Монтаж розмовного відео", "avatar-photo": "Фото аватара", "avatar-story": "Сторіз аватара" };
      const name = NAMES[slug] || slug
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
  return synced;
}
