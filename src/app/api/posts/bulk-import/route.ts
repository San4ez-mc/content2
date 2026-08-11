import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";
import { injectTrackedLinks } from "@/lib/leadMagnetLinks";
import { normalizeFormat, formatToPostGroupType } from "@/lib/formatKeys";
import { scanWriting } from "@/lib/writingGate";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";
const FLOWS_BASE = process.env.FLOWS_WEBHOOK_BASE || "https://flows.fineko.space/webhook/bot";
const CONTENT2_URL = process.env.NEXTAUTH_URL || "https://content2.fineko.space";

// Called by flows bot after generating posts
export async function POST(req: NextRequest) {
  const token =
    req.headers.get("x-import-token") ||
    req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, posts, deliverTo } = body;

  if (!projectId || !Array.isArray(posts) || posts.length === 0) {
    return NextResponse.json({ error: "projectId and posts required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const networkByPlatform = new Map(networks.map((n) => [n.platformKey, n]));

  const PLATFORM_MAP: Record<string, string> = {
    threads: "threads",
    instagram: "instagram_posts",
    instagram_post: "instagram_posts",
    stories: "instagram_stories",
    instagram_stories: "instagram_stories",
    reels: "instagram_reels",
    instagram_reels: "instagram_reels",
    carousel: "instagram_posts",
    instagram_carousel: "instagram_posts",
    linkedin: "linkedin",
    tiktok: "tiktok",
    telegram: "telegram",
    telegram_post: "telegram",
  };

  const AUDIENCE_VALID = new Set(["cold", "warm1", "warm2", "hot1", "hot2"]);

  type InsertedPost = { groupId: string; itemId: string; number: number; funnelSlug: string | null; funnelParams: Record<string, unknown> | null; content: string; platform: string };
  const insertedPosts: InsertedPost[] = [];
  // Placeholder rows created at generation start (status generating_text) get
  // claimed and filled here instead of creating duplicate posts.
  const claimedIds = new Set<string>();

  // #248 Конструктор: атоми, які емітить генератор. Валідуємо id за канонічними наборами
  // (postConstructor.ts) — сміття від LLM не пишемо. Далі йдуть у скоринг WinningPattern.
  const A_INTENT = new Set(["educate", "sell", "trust", "storytelling", "entertainment"]);
  const A_STRUCT = new Set((await prisma.structure.findMany({ where: { projectId, isActive: true, skeletonKey: { not: null } }, select: { skeletonKey: true } })).map((t) => t.skeletonKey as string));
  const A_EVID = new Set(["case", "example", "story"]);
  // C2 case integrity: мапа реальних кейсів (нормалізована назва → id). Заявлений «кейс»,
  // якого нема в базі, буде знижено у story (не видаємо вигадку за реальний кейс).
  const normCase = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const caseByTitle = new Map((await prisma.case.findMany({ where: { projectId }, select: { id: true, title: true } })).map((c) => [normCase(c.title), c.id]));
  const A_HOOK = new Set(["question", "provocation", "stat", "promise", "pain", "story", "counter", "listicle"]);
  const pick = (v: unknown, set: Set<string>) => (typeof v === "string" && set.has(v) ? v : null);

  for (const p of posts) {
    const platformKey = PLATFORM_MAP[p.platform] || p.platform || "instagram_posts";
    let network = networkByPlatform.get(platformKey);
    if (!network) network = networks.find((n) => n.isEnabled) || networks[0];
    if (!network) continue;

    // Єдиний словник форматів: нормалізуємо будь-який post_type/format → канон, enum деривуємо.
    const formatKey = normalizeFormat(p.format ?? p.post_type);
    const postType = formatToPostGroupType(formatKey);
    const audience = AUDIENCE_VALID.has(p.audience) ? p.audience : "cold";
    const postDate = p.date ? new Date(p.date) : new Date();

    // Атоми конструктора (структура/хук/доказ/намір) → поля PostGroup для скорингу.
    const atomData: any = {
      intent: pick(p.intent, A_INTENT),
      structureId: pick(p.structure, A_STRUCT),
      evidenceType: pick(p.evidence_type, A_EVID),
      hookSelected: pick(p.hook_type, A_HOOK),
      caseId: null,
      topic: p.used_topic ? String(p.used_topic).slice(0, 300) : null,
      ...(p.hook ? { hookA: String(p.hook).slice(0, 500) } : {}),
    };
    // C2: кейс валідний лише якщо збігається з реальним Case, інакше — story.
    if (atomData.evidenceType === "case") {
      const cid = caseByTitle.get(normCase(String(p.case_title || "")));
      if (cid) atomData.caseId = cid;
      else atomData.evidenceType = "story";
    }
    // C3 батч-критик: пост із порушеннями стандарту письма НЕ йде в графік —
    // тримаємо як draft (на перевірку), а не «scheduled» (авто-публікація).
    const groupStatus = scanWriting(String(p.content || "")).length > 0 ? "draft" : "scheduled";

    // funnel_slug + funnel_params from new bot format
    const funnelSlug: string | null = p.funnel_slug || null;
    const funnelParams: Record<string, unknown> | null = p.funnel_params || null;

    // Backward compat: if no funnel_slug but has media_type, derive funnel_slug
    const derivedFunnelSlug = funnelSlug || deriveSlugFromMediaType(p.media_type);

    // Determine if image generation is needed
    const needsGeneration = Boolean(derivedFunnelSlug && derivedFunnelSlug !== "text_only");

    const itemData = {
      content: p.content || "",
      imagePrompt: p.image_prompt || (funnelParams as any)?.imagePrompt || (funnelParams as any)?.prompt || null,
      imageType: p.media_type || funnelSlug || null,
      funnelSlug: derivedFunnelSlug,
      funnelParams: funnelParams as any,
      generationStatus: (needsGeneration ? "pending" : "done") as "pending" | "done",
    };

    // Try to claim a placeholder created at generation start (same slot).
    const placeholder = await prisma.postItem.findFirst({
      where: {
        generationStatus: "generating_text",
        content: "",
        id: { notIn: Array.from(claimedIds) },
        group: { is: { projectId, postDate, socialNetworkId: network.id, type: postType as any } },
      },
      orderBy: { createdAt: "asc" },
      include: { group: true },
    });

    let groupId: string;
    let itemId: string;
    let number: number;

    if (placeholder) {
      claimedIds.add(placeholder.id);
      const updatedItem = await prisma.postItem.update({
        where: { id: placeholder.id },
        data: itemData,
      });
      await prisma.postGroup.update({ where: { id: placeholder.groupId }, data: { audience, formatKey, status: groupStatus as any, ...atomData } });
      groupId = placeholder.groupId;
      itemId = updatedItem.id;
      number = (placeholder.group as any).number;
    } else {
      const group = await prisma.postGroup.create({
        data: {
          projectId,
          socialNetworkId: network.id,
          postDate,
          type: postType as any,
          formatKey,
          audience,
          ...atomData,
          status: groupStatus as any,
          items: { create: [{ orderIndex: 0, ...itemData }] },
        },
        include: { items: true },
      });
      groupId = group.id;
      itemId = group.items[0].id;
      number = (group as any).number;
    }

    insertedPosts.push({
      groupId,
      itemId,
      number,
      funnelSlug: derivedFunnelSlug,
      funnelParams: funnelParams || buildParamsFromLegacy(p),
      content: p.content || "",
      platform: platformKey,
    });
  }

  // Per-post deep-link tracking: swap any lead-magnet base link for a unique
  // tracked link keyed to this post (best-effort, no-op if no magnets match).
  for (const ins of insertedPosts) {
    const tracked = await injectTrackedLinks({
      projectId, postItemId: ins.itemId, postGroupId: ins.groupId, postNumber: ins.number, platform: ins.platform, content: ins.content,
    });
    if (tracked !== ins.content) {
      ins.content = tracked;
      await prisma.postItem.update({ where: { id: ins.itemId }, data: { content: tracked } }).catch(() => {});
    }
  }

  // Notify calendar/UI clients so the page refreshes without reload
  if (insertedPosts.length > 0) {
    const hasGenerating = insertedPosts.some((p) => p.funnelSlug && p.funnelSlug !== "text_only");
    const generatingCount = insertedPosts.filter((p) => p.funnelSlug && p.funnelSlug !== "text_only").length;
    broadcastToProject(projectId, {
      type: "post_updated",
      source: "bulk_import",
      count: insertedPosts.length,
      hasGenerating,
      generatingCount,
    });
  }

  // Fire generation for each post that needs it (fire-and-forget).
  // The PLATFORM (generation-event webhook) is the single notifier: it delivers the
  // finished media + "✅ Готово" or "❌ помилка + текст" to the chat. We therefore
  // route the chat creds through the callbackUrl and store them on the item (_deliver),
  // and DO NOT ask the funnel to deliver directly (no more deliverTo) — that avoids
  // double-delivery and the "done but never delivered" gap.
  const deliver = (deliverTo?.botToken && deliverTo?.chatId)
    ? { chatId: String(deliverTo.chatId), botToken: String(deliverTo.botToken) }
    : null;

  for (const ins of insertedPosts) {
    if (!ins.funnelSlug || ins.funnelSlug === "text_only") continue;

    let callbackUrl = `${CONTENT2_URL}/api/webhooks/generation-event?token=${WEBHOOK_SECRET}&postItemId=${ins.itemId}`;
    if (deliver) callbackUrl += `&telegramChatId=${encodeURIComponent(deliver.chatId)}&telegramBotToken=${encodeURIComponent(deliver.botToken)}`;
    const webhookUrl = `${FLOWS_BASE}/${ins.funnelSlug}`;
    const mergedParams: any = { ...(ins.funnelParams || {}) };
    if (deliver) mergedParams._deliver = deliver;
    const payload = {
      ...mergedParams,
      callbackUrl,
      postItemId: ins.itemId,
      postGroupId: ins.groupId,
    };

    // Mark as generating + persist deliver target so the platform can always notify.
    prisma.postItem.update({
      where: { id: ins.itemId },
      data: { generationStatus: "generating", ...(deliver ? { funnelParams: mergedParams } : {}) },
    }).catch(() => {});

    // Fire generation webhook (fire-and-forget)
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error(`[bulk-import] Failed to trigger ${ins.funnelSlug}:`, err.message);
      prisma.postItem.update({
        where: { id: ins.itemId },
        data: { generationStatus: "failed", generationError: "Webhook trigger failed: " + err.message },
      }).catch(() => {});
      if (deliver) {
        fetch(`https://api.telegram.org/bot${deliver.botToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: deliver.chatId, text: `❌ Не вдалося запустити генерацію медіа.\nПричина: ${err.message}` }),
        }).catch(() => {});
      }
    });
  }

  return NextResponse.json({
    ok: true,
    inserted: insertedPosts.length,
    insertedIds: insertedPosts.map((p) => ({
      id: p.groupId,
      itemId: p.itemId,
      number: p.number,
      media_type: p.funnelSlug,
    })),
  });
}

function deriveSlugFromMediaType(mediaType: string | undefined): string | null {
  const MAP: Record<string, string> = {
    ai_flux: "content-ai-bg",
    ai_flux_pro: "content-ai-bg-pro",
    ai_ideogram: "content-ideogram",
    ai_recraft: "content-recraft",
    stories_photo: "content-stories-generator",
    carousel: "content-carousel",
    template: "content-image-template",
    broll: "content-video-broll",
    text_only: "text_only",
  };
  if (!mediaType) return null;
  return MAP[mediaType] || null;
}

function buildParamsFromLegacy(p: any): Record<string, unknown> | null {
  if (!p.image_prompt && !p.media_type) return null;
  return {
    imagePrompt: p.image_prompt || null,
    prompt: p.image_prompt || null,
  };
}
