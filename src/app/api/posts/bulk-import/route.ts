import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by flows bot after generating posts
// Accepts same format as old content.fineko.space/import-content-plan.php
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-import-token") || req.nextUrl.searchParams.get("token");
  if (token !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, posts } = body;

  if (!projectId || !Array.isArray(posts) || posts.length === 0) {
    return NextResponse.json({ error: "projectId and posts required" }, { status: 400 });
  }

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Map platform keys to social networks
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

  const insertedIds: string[] = [];

  for (const p of posts) {
    // Resolve social network
    const platformKey = PLATFORM_MAP[p.platform] || p.platform || "instagram_posts";
    let network = networkByPlatform.get(platformKey);
    if (!network) {
      // Fallback: find any enabled network
      network = networks.find((n) => n.isEnabled) || networks[0];
    }
    if (!network) continue;

    const postType = POST_TYPE_MAP[p.post_type] || "single";
    const audience = AUDIENCE_VALID.has(p.audience) ? p.audience : "cold";
    const postDate = p.date ? new Date(p.date) : new Date();

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
              imagePrompt: p.image_prompt || null,
              imageType: p.media_type || null,
              generationStatus: p.image_prompt ? "pending" : "done",
            },
          ],
        },
      },
    });
    insertedIds.push(group.id);
  }

  return NextResponse.json({ ok: true, inserted: insertedIds.length, insertedIds });
}
