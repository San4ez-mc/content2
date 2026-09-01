// Засів методології маркетолога (12 архетипів, 25 схем допису, 7 типів контенту,
// 6 етапів циклу «7 дотиків», методологічні нотатки) у вектор-колекцію "global" —
// спільну для ВСІХ проєктів платформи (не per-client). Джерело чанків:
// онбординг-архітектура.md §5 / п'ять docx маркетолога, розпарсено 2026-08-22.
//
// Чому global, а не хардкод у системний промпт агента: архетипи/схеми — велика
// довідкова база (десятки KB), яку не варто вантажити в КОЖЕН виклик моделі.
// Агент має сам звертатись через query_vector, коли потрібна конкретна деталь
// (напр. "поясни архетип Мудрець" чи "дай схему допису про дефіцит").
//
// Важливо: /delete для колекції "global" заборонено проєкт-токеном (захист
// спільних даних) — цей засів розрахований на ОДНОРАЗОВИЙ запуск. Повторний
// запуск без ручного чищення БД вектор-сервісу створить дублікати чанків.
import { readFileSync } from "fs";
import { join } from "path";
import { ensureProjectVector } from "@/lib/vector-sync";
import { vectorIngest, vectorSearch, type VectorChunk } from "@/lib/vector";

type SeedChunk = { source: string; content: string; metadata: Record<string, any> };

function loadChunks(): SeedChunk[] {
  const p = join(process.cwd(), "src/lib/data/global-knowledge-chunks.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * Засіває Global-колекцію вектор-бази методологією маркетолога.
 * @param anchorProjectId - id будь-якого існуючого проєкту (потрібен лише щоб
 *   автентифікуватись у вектор-сервісі його токеном — сам чанк все одно піде
 *   в спільну global-колекцію з projectId=null, незалежно від токена).
 * @param force - пропустити перевірку на вже існуючі дані (небезпечно, дублює).
 */
export async function seedGlobalKnowledge(anchorProjectId: string, force = false) {
  const token = await ensureProjectVector(anchorProjectId);
  if (!token) {
    return { ok: false as const, reason: "Вектор-сервіс недоступний або не вдалось створити/знайти вектор-проєкт для anchorProjectId." };
  }

  if (!force) {
    // Ідемпотентність-guard: перевіряємо, чи вже є хоч один чанк з kind=archetype
    // у global. Якщо є — вважаємо, що засів уже був, і не дублюємо.
    const probe = await vectorSearch(token, "архетип Герой", { collections: ["global"], limit: 3 });
    const already = Array.isArray(probe) && probe.some((r) => r.metadata?.kind === "archetype");
    if (already) {
      return { ok: false as const, reason: "Global вже містить дані методології (kind=archetype знайдено). Передай force=true, якщо свідомо хочеш дозасіяти ще раз (буде дублікат)." };
    }
  }

  const chunks = loadChunks();
  const asVectorChunks: VectorChunk[] = chunks.map((c) => ({
    source: c.source,
    content: c.content,
    metadata: c.metadata,
  }));

  // Ingest батчами по 20, щоб не бити один величезний HTTP-запит.
  const BATCH = 20;
  let ingested = 0;
  for (let i = 0; i < asVectorChunks.length; i += BATCH) {
    const slice = asVectorChunks.slice(i, i + BATCH);
    const res = await vectorIngest(token, "global", slice);
    if (!res) return { ok: false as const, reason: `Ingest впав на батчі ${i}-${i + slice.length}.`, ingestedSoFar: ingested };
    ingested += res.ingested;
  }

  return { ok: true as const, ingested, totalChunks: chunks.length };
}
