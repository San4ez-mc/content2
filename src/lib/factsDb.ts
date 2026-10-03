// Робота з фактами в БД (спільна для agent-tools — бот — і /api/facts — UI).
import { prisma } from "./prisma";
import { factStatus, factsPromptBlock, todayKyiv, parseDay, dayOf, dayBefore, sameTopic, splitMarkers, findStaleMarkers, fmtDay, derivedStaleMarkers } from "./facts";

export const factView = (f: any, today: string) => ({
  id: f.id as string, topic: f.topic as string | null, title: f.title as string, content: f.content as string,
  status: factStatus(f, today),
  validFrom: dayOf(f.validFrom), validUntil: dayOf(f.validUntil),
  supersededAt: f.supersededAt ? (f.supersededAt as Date).toISOString() : null,
  addedBy: f.addedBy as string,
  createdAt: (f.createdAt as Date).toISOString(),
  staleMarkers: splitMarkers(f.staleMarkers),
});

export async function allFacts(projectId: string) {
  return prisma.knowledgeEntry.findMany({ where: { projectId, category: "fact" }, orderBy: { createdAt: "desc" } });
}

export type SaveFactInput = {
  title?: unknown; content?: unknown; topic?: unknown;
  valid_from?: unknown; valid_until?: unknown; stale_markers?: unknown; addedBy?: "user" | "bot";
};

export async function saveFactCore(projectId: string, p: SaveFactInput) {
  const title = String(p.title || "").trim();
  const content = String(p.content || "").trim();
  const topic = String(p.topic || "").trim();
  if (!title || !content) return { ok: false as const, error: "title і content обовʼязкові" };
  if (!topic) return { ok: false as const, error: "topic обовʼязковий (коротка тема, напр. 'тестування застосунку'): за ним новий факт замінює старий" };
  const today = todayKyiv();
  const validFrom = p.valid_from ? parseDay(p.valid_from) : null;
  const validUntil = p.valid_until ? parseDay(p.valid_until) : null;
  if (p.valid_from && !validFrom) return { ok: false as const, error: "valid_from: формат YYYY-MM-DD або DD.MM.YY" };
  if (p.valid_until && !validUntil) return { ok: false as const, error: "valid_until: формат YYYY-MM-DD або DD.MM.YY" };
  if (validFrom && validUntil && validUntil < validFrom) return { ok: false as const, error: "valid_until раніше за valid_from" };
  const markers = Array.isArray(p.stale_markers) ? (p.stale_markers as unknown[]).join("\n") : String(p.stale_markers || "");

  const startDay = validFrom && validFrom > today ? validFrom : today;
  const created = await prisma.knowledgeEntry.create({
    data: {
      projectId, category: "fact", title, content, topic, addedBy: p.addedBy || "bot",
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      staleMarkers: markers.trim() || null,
    },
  });

  // Замінити діючі/запліновані факти тієї ж теми.
  const replaced: string[] = [];
  for (const f of await allFacts(projectId)) {
    if (f.id === created.id || !sameTopic(f.topic, topic)) continue;
    if (factStatus(f, today) === "outdated") continue;
    const oldUntil = dayOf(f.validUntil);
    const cutoff = dayBefore(startDay);
    const futureStart = startDay > today; // новий факт ще не діє: старий доживає до дня перед ним
    await prisma.knowledgeEntry.update({
      where: { id: f.id },
      data: {
        supersededBy: created.id,
        validUntil: new Date(oldUntil && oldUntil < cutoff ? oldUntil : cutoff),
        ...(futureStart ? {} : { supersededAt: new Date() }),
      },
    });
    replaced.push(f.title);
  }

  const stale = await collectStalePosts(projectId, today);
  return { ok: true as const, id: created.id, status: factStatus(created, today), replaced, stale };
}

export async function expireFactCore(projectId: string, p: { id?: unknown; topic?: unknown; valid_until?: unknown }) {
  const today = todayKyiv();
  const id = p.id ? String(p.id) : "";
  const topic = p.topic ? String(p.topic) : "";
  const targets = (await allFacts(projectId)).filter((f) => (id ? f.id === id : topic ? sameTopic(f.topic, topic) : false) && factStatus(f, today) !== "outdated");
  if (!targets.length) return { ok: false as const, error: "Не знайдено діючого факту (передай id або topic)" };
  const until = p.valid_until ? parseDay(p.valid_until) : null;
  for (const f of targets) {
    await prisma.knowledgeEntry.update({ where: { id: f.id }, data: { supersededAt: new Date(), validUntil: new Date(until || dayBefore(today)) } });
  }
  return { ok: true as const, expired: targets.map((f) => f.title) };
}

export async function listFactsCore(projectId: string, status: string = "active") {
  const today = todayKyiv();
  const facts = await allFacts(projectId);
  const views = facts.map((f) => factView(f, today));
  const shown = status === "all" ? views : views.filter((v) => v.status === status);
  return { today, facts: shown, text: factsPromptBlock(facts as any[], today) };
}

/** Пости (чернетки/заплановані, дата ≥ сьогодні), де лишилась фраза зі старого формулювання. */
export async function collectStalePosts(projectId: string, today: string = todayKyiv()) {
  const facts = await allFacts(projectId);
  const explicit = facts.filter((f) => factStatus(f, today) !== "scheduled").flatMap((f) => splitMarkers(f.staleMarkers));
  // + детерміновані маркери зі вичерпаних фактів (числові звороти, яких уже нема в діючих)
  const current = facts.filter((f) => factStatus(f, today) !== "outdated").map((f) => `${f.title}\n${f.content}`).join("\n");
  const derived = derivedStaleMarkers(facts.filter((f) => factStatus(f, today) === "outdated"), current);
  const markers = Array.from(new Set([...explicit, ...derived]));
  const out: { number: number; date: string; markers: string[] }[] = [];
  if (!markers.length) return out;
  const groups = await prisma.postGroup.findMany({
    where: { projectId, status: { in: ["draft", "scheduled"] }, postDate: { gte: new Date(today) } },
    include: { items: true },
    orderBy: { postDate: "asc" },
    take: 300,
  });
  for (const g of groups) {
    const hit = findStaleMarkers(g.items.map((i) => i.content || "").join("\n"), markers);
    if (hit.length) out.push({ number: g.number, date: fmtDay(dayOf(g.postDate)), markers: hit });
  }
  return out;
}

/** Правка факту на місці (з UI): змінює текст/тему/дати/маркери, не створює нового запису й нічого не замінює. */
export async function updateFactCore(
  projectId: string,
  p: { id?: unknown; title?: unknown; content?: unknown; topic?: unknown; valid_from?: unknown; valid_until?: unknown; stale_markers?: unknown },
) {
  const id = String(p.id || "");
  const existing = id ? await prisma.knowledgeEntry.findFirst({ where: { id, projectId, category: "fact" } }) : null;
  if (!existing) return { ok: false as const, error: "Факт не знайдено" };
  const data: any = {};
  if (p.title !== undefined) { const v = String(p.title).trim(); if (!v) return { ok: false as const, error: "title не може бути порожнім" }; data.title = v; }
  if (p.content !== undefined) { const v = String(p.content).trim(); if (!v) return { ok: false as const, error: "content не може бути порожнім" }; data.content = v; }
  if (p.topic !== undefined) data.topic = String(p.topic).trim() || null;
  if (p.stale_markers !== undefined) data.staleMarkers = String(p.stale_markers).trim() || null;
  for (const [key, field] of [["valid_from", "validFrom"], ["valid_until", "validUntil"]] as const) {
    const raw = (p as any)[key];
    if (raw === undefined) continue;
    if (raw === "" || raw === null) { data[field] = null; continue; }
    const d = parseDay(raw);
    if (!d) return { ok: false as const, error: `${key}: формат YYYY-MM-DD або DD.MM.YY` };
    data[field] = new Date(d);
  }
  await prisma.knowledgeEntry.update({ where: { id }, data });
  return { ok: true as const };
}
