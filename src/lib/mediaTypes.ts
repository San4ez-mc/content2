// Реєстр медіа-типів. Кожен медіа-тип → воронка генерації (ContentTool.slug) + поля +
// джерело (авто/сховище). Поля медіа беруться з paramsSchema відповідної воронки;
// тут — семантична карта «медіа → воронка + додаткові налаштування».
export type MediaSource = "auto" | "storage";
export type MediaTypeDef = {
  key: string;
  label: string;
  funnelSlug: string | null; // воронка, що це генерує (null = чистий текст/файл)
  hasText: boolean;          // чи є текстовий шар → застосовуються текст-структури
  sources: MediaSource[];    // авто (генерація) / сховище (завантажений файл)
  extraFields: string[];     // налаштування поверх funnelParams
};

export const MEDIA_TYPES: MediaTypeDef[] = [
  { key: "text", label: "Текст", funnelSlug: null, hasText: true, sources: [], extraFields: [] },
  { key: "image", label: "Фото + текст", funnelSlug: "content-ai-bg", hasText: true, sources: ["auto", "storage"], extraFields: ["palette", "aspect"] },
  { key: "text_on_image", label: "Текст на фото", funnelSlug: "content-photo-text", hasText: true, sources: ["auto", "storage"], extraFields: ["template", "aspect"] },
  { key: "carousel", label: "Карусель (кілька фото)", funnelSlug: "content-carousel", hasText: true, sources: ["auto", "storage"], extraFields: ["slides", "palette", "aspect"] },
  { key: "video", label: "Відео + текст", funnelSlug: "content-video-broll", hasText: true, sources: ["auto", "storage"], extraFields: ["duration", "subtitles", "thumbnail", "music", "aspect"] },
  { key: "file", label: "Файл", funnelSlug: null, hasText: true, sources: ["storage"], extraFields: ["file"] },
  { key: "image_music", label: "Фото під музику", funnelSlug: "content-carousel", hasText: false, sources: ["auto", "storage"], extraFields: ["music", "aspect", "duration"] },
];

export const MEDIA_BY_KEY: Record<string, MediaTypeDef> = Object.fromEntries(MEDIA_TYPES.map((m) => [m.key, m]));
