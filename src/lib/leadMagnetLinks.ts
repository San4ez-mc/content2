import { prisma } from "@/lib/prisma";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "fnk_wh_2026_x9mK4pLqR7vNsT1eYcJdBuAw";
const FLOWS_API = process.env.FLOWS_API_BASE || "https://flows.fineko.space";

// Swaps any lead-magnet BASE deep-link found in `content` for a unique tracked
// link minted in flows and keyed to THIS post — so clicks are attributed per post.
// Best-effort: if there are no matching magnets or minting fails, content is returned
// unchanged (the base link, if any, is kept).
export async function injectTrackedLinks(opts: {
  projectId: string;
  postItemId: string;
  postGroupId?: string | null;
  postNumber?: number | null;
  platform?: string | null;
  content: string;
}): Promise<string> {
  let content = opts.content || "";
  if (!content) return content;

  const magnets = await prisma.leadMagnet.findMany({
    where: { projectId: opts.projectId, isActive: true, botUsername: { not: null } },
  });
  if (magnets.length === 0) return content;

  for (const m of magnets) {
    const bot = (m.botUsername || "").replace(/^@/, "");
    const param = m.baseStartParam || m.funnelSlug || "";
    if (!bot || !param) continue;
    const base = `https://t.me/${bot}?start=${param}`;
    if (!content.includes(base)) continue;
    try {
      const r = await fetch(`${FLOWS_API}/api/tracked-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Import-Token": WEBHOOK_SECRET },
        body: JSON.stringify({
          projectId: opts.projectId,
          leadMagnetId: m.id,
          funnelSlug: m.funnelSlug || param,
          botUsername: bot,
          postItemId: opts.postItemId,
          postGroupId: opts.postGroupId || null,
          postNumber: opts.postNumber ?? null,
          platform: opts.platform || null,
          baseParam: param,
        }),
      });
      const j = await r.json();
      if (j?.ok && j.url) content = content.split(base).join(j.url);
    } catch {
      // keep base link on failure
    }
  }
  return content;
}
