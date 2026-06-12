import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

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

  try {
    switch (action) {
      case "list_posts": return await listPosts(projectId, params);
      case "get_post": return await getPost(projectId, params);
      case "create_post": return await createPost(projectId, params);
      case "edit_post": return await editPost(projectId, params);
      case "delete_post": return await deletePost(projectId, params);
      case "delete_posts": return await deletePosts(projectId, params);
      case "regenerate_image": return await regenerateImage(projectId, params);
      case "list_media": return await listMedia(projectId);
      case "get_rules": return await getRules(projectId, params);
      case "save_rule": return await saveRule(projectId, params);
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

async function createPost(projectId: string, params: Record<string, unknown>) {
  const platformKey = PLATFORM_MAP[String(params.platform)] || String(params.platform || "instagram_posts");
  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const network = networks.find((n) => n.platformKey === platformKey) || networks.find((n) => n.isEnabled) || networks[0];
  if (!network) return NextResponse.json({ ok: false, error: "No networks in project" });

  const funnelSlug = (params.funnel_slug as string) || null;
  const funnelParams = (params.funnel_params as any) || null;
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

  if (needsGeneration) fireGeneration(group.items[0].id, group.id, funnelSlug!, funnelParams);
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
async function regenerateImage(projectId: string, params: Record<string, unknown>) {
  const g = await findByNumberOrId(projectId, params);
  if (!g || !g.items[0]) return NextResponse.json({ ok: false, error: "Post not found" });
  const item = g.items[0];

  const funnelSlug = (params.funnel_slug as string) || item.funnelSlug;
  if (!funnelSlug || funnelSlug === "text_only") {
    return NextResponse.json({ ok: false, error: "Post has no generation funnel; pass funnel_slug" });
  }
  let patch: any = params.funnel_params || {};
  if (typeof patch === "string") { try { patch = JSON.parse(patch); } catch { patch = {}; } }
  const merged = { ...(item.funnelParams as any || {}), ...patch };
  if (params.image_prompt) merged.imagePrompt = String(params.image_prompt);

  await prisma.postItem.update({
    where: { id: item.id },
    data: { funnelSlug, funnelParams: merged, generationStatus: "generating", generationError: null },
  });
  fireGeneration(item.id, g.id, funnelSlug, merged);
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

function fireGeneration(itemId: string, groupId: string, funnelSlug: string, funnelParams: any) {
  const callbackUrl = `${CONTENT2_URL}/api/webhooks/generation-event?token=${WEBHOOK_SECRET}&postItemId=${itemId}`;
  fetch(`${FLOWS_BASE}/${funnelSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(funnelParams || {}), callbackUrl, postItemId: itemId, postGroupId: groupId }),
  }).catch((err) => {
    prisma.postItem.update({
      where: { id: itemId },
      data: { generationStatus: "failed", generationError: "Webhook trigger failed: " + err.message },
    }).catch(() => {});
  });
}
