// Клієнт вектор-мікросервісу (перевикористання спільного сервісу на :4500).
// 3 індекси: `global` (спільний, projectId=null), `static`/`dynamic` (на компанію).
// Усе fail-safe: сервіс недоступний → повертаємо null, ніколи не кидаємо (СТОП-правило
// КБ обробляє викликач — не генерувати «з голови», а чесно повідомити).

const VECTOR_URL = (process.env.VECTOR_URL || "http://localhost:4500").replace(/\/$/, "");

export type VectorChunk = {
  source: string;
  content: string;
  folderId?: string;
  chunkNo?: number;
  metadata?: Record<string, any>;
};

export type VectorResult = {
  source: string;
  collection: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
};

/** Створити вектор-проєкт компанії (unauth). Повертає {projectId, rootToken}. */
export async function createVectorProject(name: string): Promise<{ projectId: string; rootToken: string } | null> {
  try {
    const res = await fetch(`${VECTOR_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j?.rootToken ? { projectId: j.project?.id, rootToken: j.rootToken } : null;
  } catch {
    return null;
  }
}

/** Проіндексувати чанки у колекцію (static|dynamic|global) під токеном проєкту. */
export async function vectorIngest(
  token: string,
  collection: "static" | "dynamic" | "global",
  chunks: VectorChunk[],
): Promise<{ ingested: number } | null> {
  if (!token || !chunks.length) return { ingested: 0 };
  try {
    const res = await fetch(`${VECTOR_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ collection, chunks }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Видалити чанки проєкту (для ідемпотентного ре-синку). source — опційно (інакше вся колекція). */
export async function vectorDelete(
  token: string,
  collection: "static" | "dynamic",
  source?: string,
): Promise<{ deleted: number } | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${VECTOR_URL}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(source ? { collection, source } : { collection }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Семантичний пошук зі скоупом по колекціях (за замовч. усі 3). */
export async function vectorSearch(
  token: string,
  query: string,
  opts: { collections?: ("static" | "dynamic" | "global")[]; limit?: number; filters?: Record<string, any> } = {},
): Promise<VectorResult[] | null> {
  if (!token || !query.trim()) return [];
  try {
    const body: any = { query, limit: opts.limit ?? 6 };
    if (opts.collections) body.collections = opts.collections;
    if (opts.filters) body.filters = opts.filters;
    const res = await fetch(`${VECTOR_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return Array.isArray(j?.results) ? j.results : [];
  } catch {
    return null;
  }
}
