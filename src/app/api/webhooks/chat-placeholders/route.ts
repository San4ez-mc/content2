import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastToProject } from "@/lib/sse";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";

// Platform/type maps mirror bulk-import so placeholders match the posts that fill them.
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

const FORMAT_TYPE: Record<string, string> = {
  instagram_stories: "stories",
  instagram_carousel: "carousel",
  threads_chain: "thread_chain",
  instagram_post: "single",
  instagram_reels: "single",
  threads_single: "single",
  linkedin_post: "single",
  telegram_post: "single",
};

/**
 * Creates empty placeholder posts the moment the bot starts generating, so the
 * content plan immediately shows "генерується текст" rows. bulk-import later
 * claims and fills these placeholders instead of creating duplicates.
 *
 * Body: { projectId, tasks: [{ format, platform, count, date }] }
 */
export async function POST(req: NextRequest) {
  const token =
    req.headers.get("x-import-token") || req.nextUrl.searchParams.get("token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, tasks } = body;
  if (!projectId || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: "projectId and tasks required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const networks = await prisma.socialNetwork.findMany({ where: { projectId } });
  const networkByPlatform = new Map(networks.map((n) => [n.platformKey, n]));

  let created = 0;
  for (const t of tasks) {
    const platformKey = PLATFORM_MAP[t.platform] || PLATFORM_MAP[t.format] || t.platform || "instagram_posts";
    let network = networkByPlatform.get(platformKey);
    if (!network) network = networks.find((n) => n.isEnabled) || networks[0];
    if (!network) continue;

    const type = FORMAT_TYPE[t.format] || "single";
    const count = Math.max(1, parseInt(t.count, 10) || 1);
    const postDate = t.date ? new Date(t.date) : new Date();

    for (let i = 0; i < count; i++) {
      await prisma.postGroup.create({
        data: {
          projectId,
          socialNetworkId: network.id,
          postDate,
          type: type as any,
          audience: "cold",
          status: "scheduled",
          items: {
            create: [
              {
                orderIndex: 0,
                content: "",
                generationStatus: "generating_text",
              },
            ],
          },
        },
      });
      created++;
    }
  }

  if (created > 0) {
    broadcastToProject(projectId, {
      type: "post_updated",
      source: "placeholders",
      count: created,
      hasGenerating: true,
      generatingCount: created,
    });
  }

  return NextResponse.json({ ok: true, created });
}
