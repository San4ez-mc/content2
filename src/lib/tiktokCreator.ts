// Інформація про акаунт TikTok (нік, дозволена приватність, заборони коментарів/дует/стіч) приходить
// асинхронно: воронка publish-tiktok робить запит creator_info і повертає результат callback-ом.
// Тут — коротка памʼять результатів (на час відкритого вікна публікації), спільна для роутів.

type Entry = { postId: string; createdAt: number; result?: Record<string, unknown> };

const g = globalThis as unknown as { __ttCreator?: Map<string, Entry> };
const store: Map<string, Entry> = g.__ttCreator || (g.__ttCreator = new Map());
const TTL_MS = 10 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, e] of Array.from(store.entries())) if (now - e.createdAt > TTL_MS) store.delete(id);
}

export function newCreatorRequest(postId: string): string {
  sweep();
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  store.set(id, { postId, createdAt: Date.now() });
  return id;
}

export function setCreatorResult(requestId: string, result: Record<string, unknown>): boolean {
  const e = store.get(requestId);
  if (!e) return false;
  e.result = result;
  return true;
}

export function getCreatorEntry(requestId: string): Entry | undefined {
  return store.get(requestId);
}
