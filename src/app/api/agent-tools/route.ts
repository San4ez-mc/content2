import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";
import { injectTrackedLinks } from "@/lib/leadMagnetLinks";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";
const FLOWS_BASE = process.env.FLOWS_WEBHOOK_BASE || "https://flows.fineko.space/webhook/bot";
const CONTENT2_URL = process.env.NEXTAUTH_URL || "https://content2.fineko.space";

// Agent tools for the content-manager bot. GET or POST with ?action=...&token=...
// Posts are addressed by their human-friendly `number` (PostGroup.number).
export async function GET(req: NextRequest) {
  return handle(req, Object.fromEntries(req.nextUrl.searchParams));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  return handle(req, { ...Object.fromEntries(req.nextUrl.searchParams), ...body });
}

async function handle(req: NextRequest, params: Record<string, unknown>) {
  if (params.token !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const action = String(params.action || "");
  const projectId = String(params.projectId || "");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" });
  const telegramChatId = String(params.telegramChatId || "");
  const telegramBotToken = String(params.telegramBotToken || "");

  try {
    switch (action) {
      case "list_posts": return await listPosts(projectId, params);
      case "get_post": return await getPost(projectId, params);
      case "create_post": return await createPost(projectId, params, telegramChatId, telegramBotToken);
      case "edit_post": return await editPost(projectId, params);
      case "delete_post": return await deletePost(projectId, params);
      case "delete_posts": return await deletePosts(projectId, params);
      case "regenerate_image": return await regenerateImage(projectId, params, telegramChatId, telegramBotToken);
      case "send_media": return await sendMedia(projectId, params, telegramChatId, telegramBotToken);
      case "list_media": return await listMedia(projectId);
      case "get_rules": return await getRules(projectId, params);
      case "save_rule": return await saveRule(projectId, params);
      case "get_topics": return await getTopics(projectId, params);
      case "get_structures": return await getStructures(projectId);
      case "get_products": return await getProducts(projectId);
      case "get_lead_magnets": return await getLeadMagnets(projectId, params);
      case "mark_topics_used": return await markTopicsUsed(projectId, params);
      case "create_avatar_reel": return await createAvatarReel(params, telegramChatId, telegramBotToken);
      default:
        return NextResponse.json({ ok: false, error: "Unknown action: " + action });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}

const PLATFORM_MAP: Record<string, string> = {
  threads: "threads",
  instagram: "instagram_posts",
  instagram_post: "instagram_posts",
  stories: "instagram_stories",
  instagram_stories: "instagram_stories",
  reels: "instagram_reels",
  instagram_reels: "instagram_reels",
  linkedin: "linkedin",
  tiktok: "tiktok",
  telegram: "telegram",
};

function dateFilter(params: Record<string, unknown>) {
  const f: any = {};
  if (params.date_from) f.gte = new Date(String(params.date_from));
  if (params.date_to) f.lte = new Date(String(params.date_to));
  return Object.keys(f).length ? f : undefined;
}

function platformWhere(projectId: string, params: Record<string, unknown>) {
  const where: any = { projectId };
  const pd = dateFilter(params);
  if (pd) where.postDate = pd;
  if (params.platform) {
    const key = PLATFORM_MAP[String(params.platform)] || String(params.platform);
    where.socialNetwork = { platformKey: { in: [key, String(params.platform)] } };
  }
  return where;
}

function serialize(g: any, full = false) {
  const item = g.items?.[0];
  const content = item?.content || "";
  return {
    number: g.number,
    id: g.id,
    date: g.postDate.toISOString().slice(0, 10),
    platform: g.socialNetwork?.platformKey || null,
    network: g.socialNetwork?.name || null,
    post_type: g.type,
    audience: g.audience,
    status: g.status,
    funnel_slug: item?.funnelSlug || null,
    funnel_params: full ? item?.funnelParams || null : undefined,
    generation_status: item?.generationStatus || null,
    image_path: item?.imagePath || null,
    content: full ? content : content.slice(0, 120).replace(/\n/g, " "),
  };
}

async function listPosts(projectId: string, params: Record<string, unknown>) {
  const groups = await prisma.postGroup.findMany({
    where: platformWhere(projectId, params),
    include: { socialNetwork: true, items: { orderBy: { orderIndex: "asc" } } },
    orderBy: { postDate: "asc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, count: groups.length, posts: groups.map((g) => serialize(g)) });
}

async function findByNumberOrId(projectId: string, params: Record<string, unknown>) {
  const num = parseInt(String(params.number || params.id || ""), 10);
  const where: any = { projectId };
  if (!isNaN(num) && String(num) === String(params.number || params.id)) where.number = num;
  else where.id = String(params.id || params.number);
  return prisma.postGroup.findFirst({
    where,
    include: { socialNetwork: true, items: { orderBy: { orderIndex: "asc" } } },
  });
}

async function getPost(projectId: string, params: Record<string, unknown>) {
  const g = await findByNumberOrId(projectId, params);
  if (!g) return NextResponse.json({ ok: false, error: "Post not found" });
  return NextResponse.json({ ok: true, post: serialize(g, true) });
}

async function createPost(projectId: string, params: Record<string, unknown>, telegramChatId = "", telegramBotToken = "") {
  const platformKey = PLATFORM_MAP[String(params.platform)] || String(params.platform || "instagram_posts");
  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const network = networks.find((n) => n.platformKey === platformKey) || networks.find((n) => n.isEnabled) || networks[0];
  if (!network) return NextResponse.json({ ok: false, error: "No networks in project" });

  const funnelSlug = (params.funnel_slug as string) || null;
  let funnelParams: any = (params.funnel_params as any) || null;
  if (typeof funnelParams === "string") { try { funnelParams = JSON.parse(funnelParams); } catch { funnelParams = null; } }
  const needsGeneration = Boolean(funnelSlug && funnelSlug !== "text_only");

  const group = await prisma.postGroup.create({
    data: {
      projectId,
      socialNetworkId: network.id,
      postDate: params.date ? new Date(String(params.date)) : new Date(),
      type: (String(params.post_type || "single") === "post" ? "single" : String(params.post_type || "single")) as any,
      audience: String(params.audience || "cold"),
      status: "scheduled",
      items: {
        create: [{
          orderIndex: 0,
          content: String(params.content || ""),
          imagePrompt: (params.image_prompt as string) || (funnelParams?.imagePrompt as string) || null,
          funnelSlug: funnelSlug || "text_only",
          funnelParams,
          generationStatus: needsGeneration ? "pending" : "done",
        }],
      },
    },
    include: { socialNetwork: true, items: true },
  });

  // Per-post deep-link tracking: swap any lead-magnet base link for a unique tracked link.
  const tracked = await injectTrackedLinks({
    projectId, postItemId: group.items[0].id, postGroupId: group.id, postNumber: group.number, platform: platformKey, content: String(params.content || ""),
  });
  if (tracked !== String(params.content || "")) {
    await prisma.postItem.update({ where: { id: group.items[0].id }, data: { content: tracked } }).catch(() => {});
    group.items[0].content = tracked;
  }

  if (needsGeneration) fireGeneration(group.items[0].id, group.id, funnelSlug!, funnelParams, telegramChatId, telegramBotToken);
  broadcastToProject(projectId, { type: "post_updated", source: "agent" });
  return NextResponse.json({ ok: true, post: serialize(group) });
}

async function editPost(projectId: string, params: Record<string, unknown>) {
  const g = await findByNumberOrId(projectId, params);
  if (!g) return NextResponse.json({ ok: false, error: "Post not found" });

  const groupData: any = {};
  if (params.post_date || params.date) groupData.postDate = new Date(String(params.post_date || params.date));
  if (params.audience) groupData.audience = String(params.audience);
  if (params.status) groupData.status = String(params.status);
  if (Object.keys(groupData).length) {
    await prisma.postGroup.update({ where: { id: g.id }, data: groupData });
  }
  const newContent = params.text ?? params.content;
  if (newContent != null && g.items[0]) {
    await prisma.postItem.update({ where: { id: g.items[0].id }, data: { content: String(newContent) } });
  }
  broadcastToProject(projectId, { type: "post_updated", source: "agent" });
  return NextResponse.json({ ok: true, number: g.number });
}

async function deletePost(projectId: string, params: Record<string, unknown>) {
  const g = await findByNumberOrId(projectId, params);
  if (!g) return NextResponse.json({ ok: false, error: "Post not found" });
  await prisma.postGroup.delete({ where: { id: g.id } });
  broadcastToProject(projectId, { type: "post_updated", source: "agent" });
  return NextResponse.json({ ok: true, deleted: g.number });
}

// Bulk delete: by numbers list OR by date range + optional platform
async function deletePosts(projectId: string, params: Record<string, unknown>) {
  let where: any;
  if (params.numbers) {
    const nums = String(params.numbers).split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
    where = { projectId, number: { in: nums } };
  } else {
    where = platformWhere(projectId, params);
    if (!where.postDate && !where.socialNetwork) {
      return NextResponse.json({ ok: false, error: "Need numbers or date_from/date_to (+platform)" });
    }
  }
  const groups = await prisma.postGroup.findMany({ where, select: { id: true, number: true } });
  await prisma.postGroup.deleteMany({ where: { id: { in: groups.map((g) => g.id) } } });
  broadcastToProject(projectId, { type: "post_updated", source: "agent" });
  return NextResponse.json({ ok: true, deleted: groups.length, numbers: groups.map((g) => g.number) });
}

// Re-fire image generation, optionally with funnel_params patch (e.g. new palette) or new funnel_slug
async function regenerateImage(projectId: string, params: Record<string, unknown>, telegramChatId = "", telegramBotToken = "") {
  const g = await findByNumberOrId(projectId, params);
  if (!g || !g.items[0]) return NextResponse.json({ ok: false, error: "Post not found" });
  const item = g.items[0];

  const funnelSlug = (params.funnel_slug as string) || item.funnelSlug;
  if (!funnelSlug || funnelSlug === "text_only") {
    return NextResponse.json({ ok: false, error: "Post has no generation funnel; pass funnel_slug" });
  }
  let patch: any = params.funnel_params || {};
  if (typeof patch === "string") { try { patch = JSON.parse(patch); } catch { patch = {}; } }
  let storedParams: any = item.funnelParams || {};
  if (typeof storedParams === "string") { try { storedParams = JSON.parse(storedParams); } catch { storedParams = {}; } }
  const merged = { ...storedParams, ...patch };
  if (params.image_prompt) merged.imagePrompt = String(params.image_prompt);

  await prisma.postItem.update({
    where: { id: item.id },
    data: { funnelSlug, funnelParams: merged, generationStatus: "generating", generationError: null },
  });
  fireGeneration(item.id, g.id, funnelSlug, merged, telegramChatId, telegramBotToken);
  broadcastToProject(projectId, { type: "generation_update", postItemId: item.id, postGroupId: g.id, status: "generating" });
  return NextResponse.json({ ok: true, number: g.number, funnel_slug: funnelSlug, funnel_params: merged });
}

async function listMedia(projectId: string) {
  const items = await prisma.mediaItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    ok: true,
    count: items.length,
    media: items.map((m) => ({ id: m.id, fileName: m.fileName, url: m.filePath, folder: m.folder, aiGenerated: m.aiGenerated })),
  });
}

// Assembled project content rules for AI prompts (per-project, editable in /knowledge UI)
async function getRules(projectId: string, params: Record<string, unknown>) {
  const category = params.category ? String(params.category) : undefined;
  const entries = await prisma.knowledgeEntry.findMany({
    where: { projectId, isActive: true, ...(category ? { category } : {}) },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  const rules = entries.map((e) => `### ${e.title}\n${e.content}`).join("\n\n");
  return NextResponse.json({ ok: true, count: entries.length, rules });
}

async function saveRule(projectId: string, params: Record<string, unknown>) {
  const title = String(params.title || "").trim();
  const content = String(params.content || "").trim();
  if (!title || !content) return NextResponse.json({ ok: false, error: "title and content required" });
  const category = String(params.category || "rule");
  const entry = await prisma.knowledgeEntry.create({
    data: { projectId, category, title, content, addedBy: "bot" },
  });
  return NextResponse.json({ ok: true, id: entry.id, title: entry.title });
}

// Re-send a post's already-generated image(s) directly to the Telegram chat.
async function sendMedia(projectId: string, params: Record<string, unknown>, telegramChatId = "", telegramBotToken = "") {
  if (!telegramChatId || !telegramBotToken) {
    return NextResponse.json({ ok: false, error: "Доступно лише в Telegram-боті (немає chatId)" });
  }
  const g = await findByNumberOrId(projectId, params);
  if (!g) return NextResponse.json({ ok: false, error: "Post not found" });
  const CONTENT2 = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
  let sent = 0;
  const errors: string[] = [];
  for (const item of (g.items || [])) {
    if (!item.imagePath) continue;
    const url = item.imagePath.startsWith("http") ? item.imagePath : CONTENT2 + item.imagePath;
    try {
      const r = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: String(telegramChatId), photo: url }),
      });
      const j: any = await r.json();
      if (j.ok) sent++; else errors.push(j.description || "tg error");
    } catch (e: any) { errors.push(e.message); }
  }
  return NextResponse.json({ ok: sent > 0, number: g.number, sent, errors });
}

const RUBRIC_LABELS: Record<string, string> = {
  galuzi: "Автоматизація по галузях", benefits: "Користь автоматизації", problems: "Проблеми в командах",
  nuances: "Нюанси автоматизації", cases: "Кейси з практики",
  theoretical: "Теоретичні ситуації", heroes: "Цікаві герої", tools: "Інструменти та новини", personal: "Особисте / філософія",
  sales: "Продажі / Продукти (BOFU — заклик до дії)",
};

// Returns topics not used in the last 14 days (never-used topics first), grouped by rubric.
async function getTopics(projectId: string, params: Record<string, unknown>) {
  const limit = Math.min(Number(params.limit || 60), 200);
  const cooldownDays = Number(params.cooldownDays || 14);
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const topics = await prisma.contentTopic.findMany({
    where: {
      projectId, isActive: true,
      OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cooldownCutoff } }],
    },
    orderBy: [{ lastUsedAt: { sort: "asc", nulls: "first" } }, { timesUsed: "asc" }, { sortOrder: "asc" }],
    take: limit,
  });
  const byRubric: Record<string, string[]> = {};
  for (const t of topics) {
    const lbl = RUBRIC_LABELS[t.rubric] || t.rubric;
    (byRubric[lbl] ||= []).push(t.title);
  }
  const text = Object.entries(byRubric).map(([r, list]) => `${r}:\n- ${list.join("\n- ")}`).join("\n\n");
  return NextResponse.json({ ok: true, count: topics.length, topics: topics.map((t) => ({ id: t.id, rubric: t.rubric, title: t.title })), text });
}

// Returns active post structures (content_types) as guidance text.
async function getStructures(projectId: string) {
  const types = await prisma.contentType.findMany({ where: { projectId, isActive: true }, orderBy: [{ sortOrder: "asc" }] });
  const text = types.map((t) => {
    const pl = Array.isArray(t.platforms) ? (t.platforms as string[]).join(", ") : "";
    return `• ${t.name}${pl ? ` [${pl}]` : ""}${t.structure ? `: ${t.structure}` : t.description ? `: ${t.description}` : ""}`;
  }).join("\n");
  return NextResponse.json({ ok: true, count: types.length, text });
}

// Builds the base Telegram deep-link for a lead magnet: t.me/<bot>?start=<param>
function leadMagnetLink(m: { botUsername: string | null; baseStartParam: string | null; funnelSlug: string | null }) {
  if (!m.botUsername) return null;
  const bot = m.botUsername.replace(/^@/, "");
  const param = m.baseStartParam || m.funnelSlug || "";
  return `https://t.me/${bot}${param ? `?start=${param}` : ""}`;
}

// Products we sell — so the content plan is oriented toward selling them.
async function getProducts(projectId: string) {
  const products = await prisma.product.findMany({
    where: { projectId, isActive: true },
    include: { leadMagnets: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }],
  });
  const text = products.map((p) => {
    const head = `• ${p.name}${p.price ? ` (${p.price})` : ""}${p.description ? ` — ${p.description}` : ""}`;
    const mags = p.leadMagnets.map((m) => {
      const link = leadMagnetLink(m);
      return `    ◦ Лід-магніт «${m.name}»${m.description ? `: ${m.description}` : ""}${link ? ` → ${link}` : ""}`;
    }).join("\n");
    return mags ? `${head}\n${mags}` : head;
  }).join("\n");
  return NextResponse.json({
    ok: true,
    count: products.length,
    products: products.map((p) => ({
      id: p.id, name: p.name, price: p.price, description: p.description, audience: p.audience,
      lead_magnets: p.leadMagnets.map((m) => ({
        id: m.id, name: m.name, description: m.description,
        funnel_slug: m.funnelSlug, bot_username: m.botUsername, link: leadMagnetLink(m),
      })),
    })),
    text,
  });
}

// Lead magnets flat list (optionally by productId) with ready-to-use deep-links.
// Content bots use this as the SOURCE OF TRUTH for sales-post links & angles — not the KB.
async function getLeadMagnets(projectId: string, params: Record<string, unknown>) {
  const productId = params.productId ? String(params.productId) : undefined;
  const magnets = await prisma.leadMagnet.findMany({
    where: { projectId, isActive: true, ...(productId ? { productId } : {}) },
    include: { product: true },
    orderBy: [{ sortOrder: "asc" }],
  });
  const text = magnets.map((m) => {
    const link = leadMagnetLink(m);
    return `• «${m.name}» (продукт: ${m.product?.name || "—"})${m.description ? ` — ${m.description}` : ""}${link ? `\n  Посилання: ${link}` : ""}`;
  }).join("\n");
  return NextResponse.json({
    ok: true,
    count: magnets.length,
    lead_magnets: magnets.map((m) => ({
      id: m.id, name: m.name, description: m.description,
      product: m.product?.name || null, product_id: m.productId,
      funnel_slug: m.funnelSlug, bot_username: m.botUsername, link: leadMagnetLink(m),
    })),
    text,
  });
}

// Fires the avatar-Reel scenarist funnel: given a theme, the funnel (Claude) designs a
// multi-scene vertical Reel with the owner's face preserved (Nano Banana Pro) + voice +
// motion + subtitles + music + cover, and delivers it to the Telegram chat. Async — returns
// immediately; the finished video arrives in TG in a few minutes.
async function createAvatarReel(params: Record<string, unknown>, telegramChatId = "", telegramBotToken = "") {
  const theme = String(params.theme || "").trim();
  if (!theme) return NextResponse.json({ ok: false, error: "theme required" });
  const body: any = { theme };
  if (telegramChatId && telegramBotToken) body.deliverTo = { chatId: telegramChatId, botToken: telegramBotToken };
  fetch(`${FLOWS_BASE}/content-avatar-reel-scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
  return NextResponse.json({ ok: true, message: "🎬 Запустив створення відео-Reel з аватаром за твоїм сценарієм. Це займе кілька хвилин — готове відео (і обкладинку) надішлю сюди в чат." });
}

// Marks topics as used (by title match, case-insensitive) — called after generation.
async function markTopicsUsed(projectId: string, params: Record<string, unknown>) {
  const titles = Array.isArray(params.titles) ? (params.titles as string[]) : [];
  if (titles.length === 0) return NextResponse.json({ ok: true, marked: 0 });
  let marked = 0;
  for (const raw of titles) {
    const title = String(raw || "").trim();
    if (!title) continue;
    const res = await prisma.contentTopic.updateMany({
      where: { projectId, title: { equals: title, mode: "insensitive" } },
      data: { status: "used", timesUsed: { increment: 1 }, lastUsedAt: new Date() },
    });
    marked += res.count;
  }
  return NextResponse.json({ ok: true, marked });
}

function fireGeneration(itemId: string, groupId: string, funnelSlug: string, funnelParams: any, telegramChatId = "", telegramBotToken = "") {
  const CONTENT2 = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
  const WH_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";
  let callbackUrl = CONTENT2 + "/api/webhooks/generation-event?token=" + WH_SECRET + "&postItemId=" + itemId;
  if (telegramChatId) callbackUrl += "&telegramChatId=" + encodeURIComponent(telegramChatId);
  if (telegramBotToken) callbackUrl += "&telegramBotToken=" + encodeURIComponent(telegramBotToken);

  // Persist the deliver target on the item so the PLATFORM can always notify the
  // chat on completion/failure/timeout — even if the callback arrives without creds.
  const merged = { ...(funnelParams || {}) };
  if (telegramChatId && telegramBotToken) merged._deliver = { chatId: telegramChatId, botToken: telegramBotToken };
  if (telegramChatId && telegramBotToken) {
    prisma.postItem.update({ where: { id: itemId }, data: { funnelParams: merged as any } }).catch(() => {});
  }

  fetch(`${FLOWS_BASE}/${funnelSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...merged, callbackUrl, postItemId: itemId, postGroupId: groupId }),
  }).catch((err) => {
    prisma.postItem.update({
      where: { id: itemId },
      data: { generationStatus: "failed", generationError: "Webhook trigger failed: " + err.message },
    }).catch(() => {});
    // Platform notifies the chat directly — the funnel was never reached, so no callback will come.
    if (telegramChatId && telegramBotToken) {
      fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChatId, text: `❌ Не вдалося запустити генерацію медіа.\nПричина: ${err.message}` }),
      }).catch(() => {});
    }
  });
}
