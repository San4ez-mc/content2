import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";
import { injectTrackedLinks } from "@/lib/leadMagnetLinks";
import { rateLimit } from "@/lib/rateLimit";
import { vectorSearch } from "@/lib/vector";
import { scanWriting } from "@/lib/writingGate";
import { resolveCaseIntegrity as resolveCaseIntegrityPure, type CaseRef } from "@/lib/caseIntegrity";
import { normalizeFormat, formatToPostGroupType } from "@/lib/formatKeys";

// Дорогі дії (коштують гроші / зовнішні виклики) — суворіший ліміт.
const EXPENSIVE_ACTIONS = new Set(["create_post", "regenerate_image", "send_media", "create_avatar_reel"]);

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

  // Rate-limit: 120 будь-яких дій/хв на проєкт; дорогі генеративні — 20/хв.
  const general = rateLimit(`at:${projectId}`, 120, 60_000);
  if (!general.ok) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded", retryAfterSec: general.retryAfterSec }, { status: 429 });
  }
  if (EXPENSIVE_ACTIONS.has(action)) {
    const heavy = rateLimit(`at-heavy:${projectId}`, 20, 60_000);
    if (!heavy.ok) {
      return NextResponse.json({ ok: false, error: "Rate limit exceeded (generation)", retryAfterSec: heavy.retryAfterSec }, { status: 429 });
    }
  }

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
      case "get_writing_core": return await getWritingCore();
      case "check_writing": return await checkWriting(params);
      case "query_vector": return await queryVector(projectId, params);
      case "get_personas": return await getPersonas(projectId);
      case "get_cases": return await getCases(projectId);
      case "get_strategy": return await getStrategy(projectId);
      case "save_rule": return await saveRule(projectId, params);
      case "get_topics": return await getTopics(projectId, params);
      case "get_structures": return await getStructures(projectId, params);
      case "get_network_rules": return await getNetworkRules(projectId, params);
      case "get_formats": return await getFormats(projectId, params);
      case "get_top_patterns": return await getTopPatterns(projectId, params);
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
  // C3 hard-gate: детермінований критик відхиляє пост із порушеннями стандарту письма.
  // Не зберігаємо — агент отримує список і має переписати (enforcement, не порада).
  const gateText = String(params.content || "");
  if (gateText.trim()) {
    const gateViolations = scanWriting(gateText);
    if (gateViolations.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "Пост НЕ збережено — не пройшов стандарт письма. Перепиши текст за списком і виклич create_post знову.",
        violations: gateViolations.map((v) => v.detail),
      });
    }
  }

  const platformKey = PLATFORM_MAP[String(params.platform)] || String(params.platform || "instagram_posts");
  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const network = networks.find((n) => n.platformKey === platformKey) || networks.find((n) => n.isEnabled) || networks[0];
  if (!network) return NextResponse.json({ ok: false, error: "No networks in project" });

  const funnelSlug = (params.funnel_slug as string) || null;
  let funnelParams: any = (params.funnel_params as any) || null;
  if (typeof funnelParams === "string") { try { funnelParams = JSON.parse(funnelParams); } catch { funnelParams = null; } }
  const needsGeneration = Boolean(funnelSlug && funnelSlug !== "text_only");

  // #314: якщо палітру явно не задано — обираємо наступну по колу (ротація).
  if (needsGeneration && !(funnelParams && typeof funnelParams === "object" && funnelParams.palette)) {
    funnelParams = { ...(funnelParams || {}), palette: await pickRotatedPalette(projectId) };
  }

  // #248 Конструктор: атоми (структура/хук/доказ/намір) з валідацією id → поля PostGroup.
  const AI = new Set(["educate", "sell", "trust", "storytelling", "entertainment"]);
  const AS = await validStructureKeys(projectId); // DB-driven: усі активні skeletonKey проєкту
  const AE = new Set(["case", "example", "story"]);
  const AH = new Set(["question", "provocation", "stat", "promise", "pain", "story", "counter", "listicle"]);
  const pk = (v: unknown, s: Set<string>) => (typeof v === "string" && s.has(v) ? v : null);
  const atoms: any = {
    intent: pk(params.intent, AI), structureId: pk(params.structure, AS),
    evidenceType: pk(params.evidence_type, AE), hookSelected: pk(params.hook_type, AH),
    ...(params.hook ? { hookA: String(params.hook).slice(0, 500) } : {}),
  };
  // C2: валідуємо кейс проти реальних Case → downgrade у story, якщо вигаданий.
  const ci = await resolveCaseIntegrity(projectId, atoms.evidenceType, params.case_title);
  atoms.evidenceType = ci.evidenceType;
  atoms.caseId = ci.caseId;
  atoms.topic = params.used_topic ? String(params.used_topic).slice(0, 300) : null;

  // Carousel role backfill: LLM часто пише funnel_params.slides без поля role, попри
  // інструкцію в промпті (не гарантія, а рекомендація для моделі). Якщо обрана Structure
  // має slideRoles — підставляємо їх позиційно там, де role відсутнє, замість покладатись
  // лише на fallback-ротацію самого флоу (яка не знає, яку структуру обрав LLM).
  try {
    const { writeFile: __wf } = await import("fs/promises");
    await __wf("/tmp/role_backfill_debug.log",
      `${new Date().toISOString()} funnelSlug=${funnelSlug} hasFunnelParams=${!!funnelParams} slidesIsArray=${Array.isArray(funnelParams?.slides)} structureId=${atoms.structureId} rawParamsStructure=${JSON.stringify(params.structure)} rawFunnelParamsType=${typeof params.funnel_params}\n`,
      { flag: "a" });
  } catch {}
  if (funnelSlug === "content-carousel" && funnelParams && Array.isArray(funnelParams.slides) && atoms.structureId) {
    const structRow = await prisma.structure.findFirst({ where: { projectId, skeletonKey: atoms.structureId }, select: { slideRoles: true } }).catch(() => null);
    const roles = Array.isArray(structRow?.slideRoles) ? (structRow!.slideRoles as string[]) : null;
    try {
      const { writeFile: __wf2 } = await import("fs/promises");
      await __wf2("/tmp/role_backfill_debug.log", `  structRow=${JSON.stringify(structRow)} roles=${JSON.stringify(roles)}\n`, { flag: "a" });
    } catch {}
    if (roles && roles.length) {
      funnelParams = {
        ...funnelParams,
        slides: funnelParams.slides.map((s: any, i: number) => (s && !s.role ? { ...s, role: roles[i % roles.length] } : s)),
      };
    }
  } else {
    try {
      const { writeFile: __wf3 } = await import("fs/promises");
      await __wf3("/tmp/role_backfill_debug.log", `  CONDITION FALSE\n`, { flag: "a" });
    } catch {}
  }

  // Carousel photo fill: ролі, для яких фото суттєво покращує вигляд, але LLM його не дало —
  // підставляємо РЕАЛЬНІ фото проєкту (не AI-згенеровані, не чужий проєкт) з галереї MediaItem,
  // round-robin. Ролі, де фото має бути буквально конкретним (скріншот інтерфейсу) — не чіпаємо.
  const PHOTO_FIELD_BY_ROLE: Record<string, string> = {
    cover: "photoUrl", list: "photoUrl", photo_numbered: "photoUrl", quote: "photoUrl",
    photo_portrait: "photoUrl", photo_cover_personal: "photoUrl", product_photo_cover: "photoUrl",
    circle_photo_frame: "photoUrl", location_card: "photoUrl", native_text_over_photo: "photoUrl",
  };
  if (funnelSlug === "content-carousel" && funnelParams && Array.isArray(funnelParams.slides)) {
    const needsPhoto = funnelParams.slides.some((s: any) => s && PHOTO_FIELD_BY_ROLE[s.role] && !s[PHOTO_FIELD_BY_ROLE[s.role]]);
    if (needsPhoto) {
      const gallery = await prisma.mediaItem.findMany({
        where: { projectId, aiGenerated: false, mimeType: { startsWith: "image/" } },
        orderBy: { createdAt: "desc" }, take: 30, select: { filePath: true },
      }).catch(() => []);
      if (gallery.length) {
        const base = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
        let gi = 0;
        funnelParams = {
          ...funnelParams,
          slides: funnelParams.slides.map((s: any) => {
            const field = s && PHOTO_FIELD_BY_ROLE[s.role];
            if (!field || s[field]) return s;
            const url = base + gallery[gi % gallery.length].filePath;
            gi++;
            return { ...s, [field]: url };
          }),
        };
      }
    }
  }

  const group = await prisma.postGroup.create({
    data: {
      projectId,
      socialNetworkId: network.id,
      postDate: params.date ? new Date(String(params.date)) : new Date(),
      type: formatToPostGroupType(normalizeFormat(params.format ?? params.post_type)) as any,
      formatKey: normalizeFormat(params.format ?? params.post_type),
      audience: String(params.audience || "cold"),
      ...atoms,
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
    // E3 двофазність: наповнення скелета текстом «випускає» його в графік.
    if ((g as any).skeleton) {
      await prisma.postGroup.update({ where: { id: g.id }, data: { skeleton: false, ...(groupData.status ? {} : { status: "scheduled" }) } });
    }
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
  let merged = { ...storedParams, ...patch };
  if (params.image_prompt) merged.imagePrompt = String(params.image_prompt);

  // Той самий backfill, що й у create_post: якщо редагування каруселі принесло слайди
  // без role (LLM забув), підставляємо з slideRoles обраної при створенні структури.
  if (funnelSlug === "content-carousel" && Array.isArray(merged.slides) && (g as any).structureId) {
    const structRow = await prisma.structure.findFirst({ where: { projectId, skeletonKey: (g as any).structureId }, select: { slideRoles: true } }).catch(() => null);
    const roles = Array.isArray(structRow?.slideRoles) ? (structRow!.slideRoles as string[]) : null;
    if (roles && roles.length) {
      merged = { ...merged, slides: merged.slides.map((s: any, i: number) => (s && !s.role ? { ...s, role: roles[i % roles.length] } : s)) };
    }
  }
  if (funnelSlug === "content-carousel" && Array.isArray(merged.slides)) {
    const PHOTO_FIELD_BY_ROLE: Record<string, string> = {
      cover: "photoUrl", list: "photoUrl", photo_numbered: "photoUrl", quote: "photoUrl",
      photo_portrait: "photoUrl", photo_cover_personal: "photoUrl", product_photo_cover: "photoUrl",
      circle_photo_frame: "photoUrl", location_card: "photoUrl", native_text_over_photo: "photoUrl",
    };
    const needsPhoto = merged.slides.some((s: any) => s && PHOTO_FIELD_BY_ROLE[s.role] && !s[PHOTO_FIELD_BY_ROLE[s.role]]);
    if (needsPhoto) {
      const gallery = await prisma.mediaItem.findMany({
        where: { projectId, aiGenerated: false, mimeType: { startsWith: "image/" } },
        orderBy: { createdAt: "desc" }, take: 30, select: { filePath: true },
      }).catch(() => []);
      if (gallery.length) {
        const base = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
        let gi = 0;
        merged = {
          ...merged,
          slides: merged.slides.map((s: any) => {
            const field = s && PHOTO_FIELD_BY_ROLE[s.role];
            if (!field || s[field]) return s;
            const url = base + gallery[gi % gallery.length].filePath;
            gi++;
            return { ...s, [field]: url };
          }),
        };
      }
    }
  }

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

// Assembled project content rules for AI prompts (per-project, editable in /knowledge UI).
// За замовчуванням ВИКЛЮЧАЄ сирі завантажені доки (onboarding-doc*): вони вже розібрані
// в структуру (продукти/персони/кейси) і не мають вивалюватись у промпт гуртом. Якщо
// потрібен конкретний док — передай явну category.
async function getRules(projectId: string, params: Record<string, unknown>) {
  const category = params.category ? String(params.category) : undefined;
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      projectId, isActive: true,
      ...(category ? { category } : { NOT: { category: { startsWith: "onboarding-doc" } } }),
    },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  const rules = entries.map((e) => `### ${e.title}\n${e.content}`).join("\n\n");
  return NextResponse.json({ ok: true, count: entries.length, rules });
}

const short = (v: any, n = 160) => { const s = String(v || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

// ГЛОБАЛЬНЕ ядро правил письма — спільне для ВСІХ проєктів/воронок (не клієнт-специфічне).
// Живе одним записом у службовому проєкті "__GLOBAL_RULES__" (category=writing-core),
// редагується в одному місці. Завжди інжектиться в промпт генерації (Шар 1 стандарту письма).
const GLOBAL_RULES_PROJECT = "__GLOBAL_RULES__";
async function getWritingCore() {
  const proj = await prisma.project.findFirst({ where: { name: GLOBAL_RULES_PROJECT }, select: { id: true } });
  if (!proj) return NextResponse.json({ ok: true, text: "" });
  const e = await prisma.knowledgeEntry.findFirst({
    where: { projectId: proj.id, category: "writing-core", isActive: true },
    orderBy: { updatedAt: "desc" }, select: { content: true },
  });
  return NextResponse.json({ ok: true, text: e?.content || "" });
}

// Семантичний пошук по базі знань компанії (живий вектор-мікросервіс) — замінює
// мертві NLM/openai-kb. Контент (стиль автора, правила по мережах) уже у static-колекції.
async function queryVector(projectId: string, params: Record<string, unknown>) {
  const query = String(params.query || params.question || "").trim();
  if (!query) return NextResponse.json({ ok: true, text: "", count: 0 });
  const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { vectorToken: true } });
  if (!proj?.vectorToken) return NextResponse.json({ ok: true, text: "", count: 0, note: "no vector token" });
  const results = await vectorSearch(proj.vectorToken, query, { collections: ["static", "global"], limit: 6 });
  const text = (results || []).map((r: any) => String(r.content || r.text || "")).filter(Boolean).join("\n---\n");
  return NextResponse.json({ ok: true, text, answer: text, count: (results || []).length });
}

// Шар 2 — детермінований grep-gate. Логіку винесено в @/lib/writingGate (тестовано).
async function checkWriting(params: Record<string, unknown>) {
  const text = String(params.text || "");
  if (!text.trim()) return NextResponse.json({ ok: true, pass: true, count: 0, violations: [], text: "Порожній текст." });
  const violations = scanWriting(text);
  const summary = violations.length
    ? "Порушення стандарту письма:\n" + violations.map((v) => `• ${v.detail}`).join("\n")
    : "Стандарт письма пройдено, порушень немає.";
  return NextResponse.json({ ok: true, pass: violations.length === 0, count: violations.length, violations, text: summary });
}

// Персони (ЦА) — кому і як говоримо. Канонічний документ №2 бази контент-плану.
async function getPersonas(projectId: string) {
  const personas = await prisma.persona.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  const text = personas.map((p) => {
    const parts = [
      p.pains ? `болі — ${short(p.pains)}` : "", p.triggers ? `тригери — ${short(p.triggers)}` : "",
      p.objections ? `заперечення — ${short(p.objections)}` : "", p.tone ? `тон — ${short(p.tone, 80)}` : "",
      p.forbiddenWords ? `уникати — ${short(p.forbiddenWords, 80)}` : "",
    ].filter(Boolean).join("; ");
    return `• ${p.name}${p.type ? ` (${p.type})` : ""}: ${parts}`;
  }).join("\n");
  return NextResponse.json({
    ok: true, count: personas.length, text,
    personas: personas.map((p) => ({
      id: p.id, name: p.name, type: p.type, pains: p.pains, goals: p.goals,
      triggers: p.triggers, objections: p.objections, language: p.language,
      tone: p.tone, forbiddenWords: p.forbiddenWords,
    })),
  });
}

// Кейси / доказова база — BOFU + довіра. allowedClaims = дозволені формулювання (case integrity).
async function getCases(projectId: string) {
  const cases = await prisma.case.findMany({
    where: { projectId }, orderBy: { createdAt: "asc" },
    include: { product: { select: { name: true } } },
  });
  const text = cases.map((c) => {
    const m = c.metrics && typeof c.metrics === "object" ? Object.entries(c.metrics as any).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    const parts = [
      c.problem ? `проблема — ${short(c.problem)}` : "", c.solution ? `рішення — ${short(c.solution)}` : "",
      m ? `результат — ${short(m, 120)}` : "", c.allowedClaims ? `можна казати — ${short(c.allowedClaims, 120)}` : "",
    ].filter(Boolean).join("; ");
    return `• «${c.title}»${c.niche ? ` [${c.niche}]` : ""}${c.product?.name ? ` (продукт: ${c.product.name})` : ""}: ${parts}`;
  }).join("\n");
  return NextResponse.json({
    ok: true, count: cases.length, text,
    cases: cases.map((c) => ({
      id: c.id, title: c.title, product: c.product?.name || null, niche: c.niche,
      problem: c.problem, solution: c.solution, metrics: c.metrics, allowedClaims: c.allowedClaims,
    })),
  });
}

// SMM-стратегія — скелет плану: контент-стовпи (рубрики) + розподіл інтенту.
async function getStrategy(projectId: string) {
  const s = await prisma.smmStrategy.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  if (!s) return NextResponse.json({ ok: true, strategy: null, text: "" });
  const pillars = Array.isArray(s.contentPillars) ? (s.contentPillars as any[]).join(", ") : "";
  const intent = s.intentDistribution && typeof s.intentDistribution === "object"
    ? Object.entries(s.intentDistribution as any).map(([k, v]) => `${k} ${v}`).join(", ") : "";
  const text = [pillars ? `Контент-стовпи: ${pillars}.` : "", intent ? `Баланс цілей: ${intent}.` : ""].filter(Boolean).join(" ");
  return NextResponse.json({
    ok: true, text,
    strategy: { version: s.version, contentPillars: s.contentPillars, intentDistribution: s.intentDistribution },
  });
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
    // Тема, позначена схемою допису (content_type) і/або дотиком циклу (cycle_position) —
    // помічаємо прямо в тексті, щоб пишучий агент бачив підказку і не мусив вигадувати.
    const tag = [t.contentType, t.cyclePosition].filter(Boolean).join("/");
    (byRubric[lbl] ||= []).push(tag ? `${t.title} [${tag}]` : t.title);
  }
  const text = Object.entries(byRubric).map(([r, list]) => `${r}:\n- ${list.join("\n- ")}`).join("\n\n");
  return NextResponse.json({
    ok: true, count: topics.length,
    topics: topics.map((t) => ({ id: t.id, rubric: t.rubric, title: t.title, contentType: t.contentType, cyclePosition: t.cyclePosition })),
    text,
  });
}

// Returns active post structures (content_types) as guidance text.
// Структури постів (скелети) — з тегами мереж/форматів/хуків. Опційний platform фільтрує
// (структура доступна мережі, якщо її platforms порожні або містять цю мережу).
async function getStructures(projectId: string, params: Record<string, unknown> = {}) {
  const platform = params.platform ? String(params.platform) : "";
  let types = await prisma.structure.findMany({ where: { projectId, isActive: true }, orderBy: [{ sortOrder: "asc" }] });
  if (platform) types = types.filter((t) => { const pl = Array.isArray(t.platforms) ? (t.platforms as string[]) : []; return pl.length === 0 || pl.includes(platform); });
  const arr = (v: any) => (Array.isArray(v) ? (v as string[]) : []);
  const text = types.map((t) => {
    const pl = arr(t.platforms).join(", ") || "всі";
    const pt = arr(t.postTypes).join("/") || "-";
    const hk = arr(t.hookTypes).join(", ");
    const len = t.minLen || t.maxLen ? ` ${t.minLen ?? "?"}-${t.maxLen ?? "?"}симв.` : "";
    const sr = arr(t.slideRoles);
    return `• ${t.name} [мережі: ${pl}; формати: ${pt}${len}; key=${t.skeletonKey || "-"}${hk ? `; хуки: ${hk}` : ""}]: ${t.structure || ""}${t.rules ? ` ПРАВИЛА ФОРМАТУ: ${t.rules}` : ""}${sr.length ? ` РОЛІ СЛАЙДІВ КАРУСЕЛІ (використай як каркас funnel_params.slides): ${sr.join(" → ")}` : ""}`;
  }).join("\n");
  return NextResponse.json({ ok: true, count: types.length, text, structures: types.map((t) => ({ key: t.skeletonKey, name: t.name, platforms: t.platforms, postTypes: t.postTypes, slideRoles: arr(t.slideRoles) })) });
}

// Правила соцмереж (тон/довжина/хештеги/алгоритм) + куди йде CTA-лінк (linkPlacement).
async function getNetworkRules(projectId: string, params: Record<string, unknown> = {}) {
  const platform = params.platform ? String(params.platform) : "";
  const nets = await prisma.socialNetwork.findMany({ where: { projectId, isEnabled: true, ...(platform ? { platformKey: platform } : {}) }, orderBy: { sortOrder: "asc" } });
  const LINK_TXT: Record<string, string> = { comment: "у перший коментар", inline: "прямо в тексті", bio: "у шапку профілю (в пості лінк неактивний)", description: "в опис" };
  const text = nets.filter((n) => n.rules || n.linkPlacement).map((n) => {
    const link = n.linkPlacement ? ` Посилання (CTA): ${LINK_TXT[n.linkPlacement] || n.linkPlacement}.` : "";
    return `[${n.platformKey}] ${n.rules || ""}${link}`;
  }).join("\n\n");
  return NextResponse.json({ ok: true, count: nets.length, text });
}

// Формати по мережах (контейнер + дозволені медіа-типи + aspect). Опційний platform.
async function getFormats(projectId: string, params: Record<string, unknown> = {}) {
  const platform = params.platform ? String(params.platform) : "";
  const nets = await prisma.socialNetwork.findMany({ where: { projectId, isEnabled: true, ...(platform ? { platformKey: platform } : {}) }, select: { id: true, platformKey: true } });
  const netById = new Map(nets.map((n) => [n.id, n.platformKey]));
  const formats = await prisma.format.findMany({ where: { projectId, isActive: true, socialNetworkId: { in: nets.map((n) => n.id) } }, orderBy: { sortOrder: "asc" } });
  const text = formats.map((f) => {
    const mt = Array.isArray(f.mediaTypes) ? (f.mediaTypes as string[]).join(", ") : "";
    return `• ${netById.get(f.socialNetworkId)} → ${f.key} (${f.name}) [aspect ${f.aspect || "-"}; медіа: ${mt}]`;
  }).join("\n");
  return NextResponse.json({ ok: true, count: formats.length, text, formats: formats.map((f) => ({ platform: netById.get(f.socialNetworkId), key: f.key, name: f.name, mediaTypes: f.mediaTypes, aspect: f.aspect })) });
}

// E2 скоринг: що працює найкраще (з реальних балів реакцій) — по атомах, опційно по мережі.
// Віддає генератору підказку «для LinkedIn краще hook=stat». Поріг вибірки MIN_PATTERN_SAMPLE.
const MIN_PATTERN_SAMPLE = 3;
async function getTopPatterns(projectId: string, params: Record<string, unknown> = {}) {
  const platform = params.platform ? String(params.platform) : "";
  const groups = await prisma.postGroup.findMany({
    where: { projectId, ...(platform ? { socialNetwork: { platformKey: platform } } : {}) },
    select: { intent: true, structureId: true, hookSelected: true, evidenceType: true, scores: true },
  });
  const elements: Record<string, string> = { intent: "intent", structure: "structureId", hook: "hookSelected", evidence: "evidenceType" };
  const acc: Record<string, Record<string, { sum: number; n: number }>> = { intent: {}, structure: {}, hook: {}, evidence: {} };
  let scored = 0;
  for (const g of groups) {
    const sc = g.scores as any;
    const total = sc && typeof sc === "object" && typeof sc.total === "number" ? sc.total : null;
    if (total == null || total === 0) continue;
    scored++;
    for (const [label, field] of Object.entries(elements)) {
      const v = (g as any)[field] as string | null;
      if (!v) continue;
      const b = (acc[label][v] ||= { sum: 0, n: 0 });
      b.sum += total; b.n += 1;
    }
  }
  const best: string[] = [];
  for (const [label, vals] of Object.entries(acc)) {
    let top: { v: string; avg: number; n: number } | null = null;
    for (const [v, b] of Object.entries(vals)) {
      if (b.n < MIN_PATTERN_SAMPLE) continue;
      const avg = b.sum / b.n;
      if (!top || avg > top.avg) top = { v, avg: Math.round(avg * 10) / 10, n: b.n };
    }
    if (top) best.push(`${label}=${top.v} (бал ${top.avg}, n=${top.n})`);
  }
  const text = best.length ? `Що працює найкраще${platform ? " для " + platform : ""} (з реальних результатів): ${best.join("; ")}. Віддавай перевагу цим елементам, якщо доречно темі.` : "";
  return NextResponse.json({ ok: true, text, scoredPosts: scored });
}

// Дозволені skeletonKey проєкту (для валідації structureId з генератора).
async function validStructureKeys(projectId: string): Promise<Set<string>> {
  const rows = await prisma.structure.findMany({ where: { projectId, isActive: true, skeletonKey: { not: null } }, select: { skeletonKey: true } });
  return new Set(rows.map((r) => r.skeletonKey as string));
}

// C2 case integrity: заявлений «кейс» приймаємо, ТІЛЬКИ якщо він збігається з реальним
// записом Case (за точною назвою). Інакше — downgrade у story, щоб вигадка не видавалась
// за реальний кейс. Захищає й від D4 (нема КБ → нема реальних кейсів → усе в story).
async function resolveCaseIntegrity(projectId: string, evidenceType: string | null, caseTitle: unknown): Promise<{ evidenceType: string | null; caseId: string | null }> {
  if (evidenceType !== "case") return { evidenceType, caseId: null };
  const cases = await prisma.case.findMany({ where: { projectId }, select: { id: true, title: true } });
  return resolveCaseIntegrityPure(cases as CaseRef[], evidenceType, caseTitle); // чиста логіка з @/lib/caseIntegrity
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

// #314 (В4) — ротація візуальних палітр із памʼяттю про попередні візуали.
// Палітри є, але завжди бралася одна. Тут беремо останні використані у проєкті
// й обираємо НАСТУПНУ по колу, щоб візуали не повторювались.
const PALETTES = ["DARK_CINEMATIC", "MINIMAL_WHITE", "ENERGY_ORANGE", "TRUST_BLUE", "PREMIUM_PURPLE"];

async function pickRotatedPalette(projectId: string): Promise<string> {
  const recent = await prisma.postItem.findMany({
    where: { group: { projectId } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { funnelParams: true },
  }).catch(() => [] as { funnelParams: any }[]);
  const used = recent
    .map((r) => (r.funnelParams && typeof r.funnelParams === "object" ? (r.funnelParams as any).palette : null))
    .filter((p): p is string => typeof p === "string" && PALETTES.includes(p));
  const last = used[0];
  if (!last) return PALETTES[0];
  const idx = PALETTES.indexOf(last);
  return PALETTES[(idx + 1) % PALETTES.length];
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
