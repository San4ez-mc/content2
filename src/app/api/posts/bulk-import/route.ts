import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

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
  const { projectId, posts } = body;

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

  const POST_TYPE_MAP: Record<string, string> = {
    post: "single",
    carousel: "carousel",
    stories: "stories",
    reels: "single",
    thread_chain: "thread_chain",
    thread_single: "single",
    threads_chain: "thread_chain",
  };

  const AUDIENCE_VALID = new Set(["cold", "warm1", "warm2", "hot1", "hot2"]);

  type InsertedPost = { groupId: string; itemId: string; number: number; funnelSlug: string | null; funnelParams: Record<string, unknown> | null };
  const insertedPosts: InsertedPost[] = [];

  for (const p of posts) {
    const platformKey = PLATFORM_MAP[p.platform] || p.platform || "instagram_posts";
    let network = networkByPlatform.get(platformKey);
    if (!network) network = networks.find((n) => n.isEnabled) || networks[0];
    if (!network) continue;

    const postType = POST_TYPE_MAP[p.post_type] || "single";
    const audience = AUDIENCE_VALID.has(p.audience) ? p.audience : "cold";
    const postDate = p.date ? new Date(p.date) : new Date();

    // funnel_slug + funnel_params from new bot format
    const funnelSlug: string | null = p.funnel_slug || null;
    const funnelParams: Record<string, unknown> | null = p.funnel_params || null;

    // Backward compat: if no funnel_slug but has media_type, derive funnel_slug
    const derivedFunnelSlug = funnelSlug || deriveSlugFromMediaType(p.media_type);

    // Determine if image generation is needed
    const needsGeneration = Boolean(derivedFunnelSlug && derivedFunnelSlug !== "text_only");

    const group = await prisma.postGroup.create({
      data: {
        projectId,
        socialNetworkId: network.id,
        postDate,
        type: postType as any,
        audience,
        status: "scheduled",
        items: {
          create: [
            {
              orderIndex: 0,
              content: p.content || "",
              imagePrompt: p.image_prompt || (funnelParams as any)?.imagePrompt || (funnelParams as any)?.prompt || null,
              imageType: p.media_type || funnelSlug || null,
              funnelSlug: derivedFunnelSlug,
              funnelParams: funnelParams as any,
              generationStatus: needsGeneration ? "pending" : "done",
            },
          ],
        },
      },
      include: { items: true },
    });

    const item = group.items[0];
    insertedPosts.push({
      groupId: group.id,
      itemId: item.id,
      number: (group as any).number,
      funnelSlug: derivedFunnelSlug,
      funnelParams: funnelParams || buildParamsFromLegacy(p),
    });
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

  // Fire generation for each post that needs it (fire-and-forget)
  for (const ins of insertedPosts) {
    if (!ins.funnelSlug || ins.funnelSlug === "text_only") continue;

    const callbackUrl = `${CONTENT2_URL}/api/webhooks/generation-event?token=${WEBHOOK_SECRET}&postItemId=${ins.itemId}`;
    const webhookUrl = `${FLOWS_BASE}/${ins.funnelSlug}`;
    const payload = {
      ...(ins.funnelParams || {}),
      callbackUrl,
      postItemId: ins.itemId,
      postGroupId: ins.groupId,
    };

    // Mark as generating
    prisma.postItem.update({
      where: { id: ins.itemId },
      data: { generationStatus: "generating" },
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
