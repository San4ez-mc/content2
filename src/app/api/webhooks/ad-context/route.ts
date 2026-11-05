import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listFactsCore } from "@/lib/factsDb";
import { seedAdsNetwork } from "@/lib/seedStructures";
import { AD_PLATFORM_KEY, AD_NETWORK_RULES, AD_CTA_BUTTONS, AD_LIMITS, AD_ASPECTS } from "@/lib/adRules";

// Контекст для воронок рекламних креативів Meta (FB/IG): усе, що креатив має знати про експерта, продукт і ЦА.
// Єдине джерело правди — content2 (воронка нічого про експерта не зберігає і не вигадує).
// Auth: x-webhook-secret === WEBHOOK_SECRET.  Body: { projectId, productId?, productName?, ensureNetwork? }
export const dynamic = "force-dynamic";

const clip = (s: unknown, n = 600) => String(s ?? "").trim().slice(0, n);

export async function POST(req: NextRequest) {
  if (req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { projectId?: string; productId?: string; productName?: string; ensureNetwork?: boolean };
  const projectId = body.projectId;
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId обовʼязковий" }, { status: 400 });
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) return NextResponse.json({ ok: false, error: "Проєкт не знайдено" }, { status: 404 });

  // Мережа рекламних креативів: за запитом створюємо (ідемпотентно), інакше лише повідомляємо, що її нема.
  let network = await prisma.socialNetwork.findFirst({ where: { projectId, platformKey: AD_PLATFORM_KEY } });
  if (!network && body.ensureNetwork) {
    await seedAdsNetwork(projectId);
    network = await prisma.socialNetwork.findFirst({ where: { projectId, platformKey: AD_PLATFORM_KEY } });
  }

  const products = await prisma.product.findMany({ where: { projectId, isActive: true }, orderBy: { priority: "asc" }, include: { leadMagnets: { where: { isActive: true } } } });
  const wanted = body.productId
    ? products.find((p) => p.id === body.productId)
    : body.productName
      ? products.find((p) => p.name.toLowerCase().includes(String(body.productName).toLowerCase()))
      : products[0];

  const [personas, cases, founder, facts, brand, existing] = await Promise.all([
    prisma.persona.findMany({ where: { projectId } }),
    prisma.case.findMany({ where: { projectId, ...(wanted ? { OR: [{ productId: wanted.id }, { productId: null }] } : {}) } }),
    prisma.founderProfile.findUnique({ where: { projectId } }),
    listFactsCore(projectId, "active"),
    prisma.knowledgeEntry.findMany({ where: { projectId, category: "brand", isActive: true } }),
    network
      ? prisma.postGroup.findMany({
          where: { projectId, socialNetworkId: network.id },
          orderBy: { createdAt: "desc" }, take: 40,
          include: { items: { select: { funnelParams: true }, take: 1 } },
        })
      : Promise.resolve([] as any[]),
  ]);

  const mapMagnet = (m: any) => {
    const bot = String(m.botUsername || "").replace(/^@/, "");
    const param = m.baseStartParam || m.funnelSlug || "";
    return { id: m.id, name: m.name, description: clip(m.description, 500), link: bot && param ? `https://t.me/${bot}?start=${param}` : null };
  };

  const offer = wanted
    ? {
        id: wanted.id, name: wanted.name, description: clip(wanted.description), price: wanted.price,
        audience: clip(wanted.audience), pains: clip(wanted.pains, 900), transformation: clip(wanted.transformation), benefits: clip(wanted.benefits),
        leadMagnets: wanted.leadMagnets.map(mapMagnet),
      }
    : null;

  const prevAds = (existing as any[]).map((g) => {
    const ad = (g.items?.[0]?.funnelParams as any)?.ad || {};
    return { number: g.number, angle: ad.angle || null, headline: ad.headline || null };
  }).filter((a) => a.headline);

  const text = [
    `КОМПАНІЯ/ЕКСПЕРТ: ${project.name}`,
    founder ? `ЕКСПЕРТ (ядро): ${clip(founder.core, 500)}\nСИЛЬНІ СТОРОНИ: ${JSON.stringify(founder.strengths).slice(0, 600)}\nВІДМІННОСТІ: ${JSON.stringify(founder.differentiators).slice(0, 600)}` : "ЕКСПЕРТ: профілю нема",
    offer
      ? `ПРОПОЗИЦІЯ: ${offer.name}${offer.price ? ` (ціна у базі: ${offer.price})` : ""}\nОпис: ${offer.description}\nДля кого: ${offer.audience}\nБолі: ${offer.pains}\nЩо зміниться: ${offer.transformation}\nПереваги: ${offer.benefits}`
      : "ПРОПОЗИЦІЯ: продукт не знайдено",
    `ПЕРСОНИ (ЦА):\n${personas.map((p) => `• ${p.name}: болі — ${clip(p.pains, 300)}; тригери — ${clip(p.triggers, 200)}; заперечення — ${clip(p.objections, 300)}; як говорить — ${clip(p.language, 200)}; заборонені слова — ${clip(p.forbiddenWords, 150)}`).join("\n") || "—"}`,
    `КЕЙСИ (лише реальні; цифри тільки з «можна»):\n${cases.map((c) => `• [${c.id}] ${c.title}${c.niche ? ` (${c.niche})` : ""}: ${clip(c.problem, 160)} → ${clip(c.solution, 160)}; можна: ${clip(c.allowedClaims, 200) || "не задано, цифр не використовувати"}`).join("\n") || "— (кейсів нема: кут «доказ» не використовувати)"}`,
    `ТОН:\n${brand.map((b) => clip(b.content, 400)).join("\n") || "—"}`,
    facts.text,
  ].join("\n\n");

  return NextResponse.json({
    ok: true,
    project: { id: project.id, name: project.name },
    networkId: network?.id || null,
    networkExists: !!network,
    rules: network?.rules || AD_NETWORK_RULES,
    limits: AD_LIMITS,
    ctaButtons: AD_CTA_BUTTONS,
    aspects: AD_ASPECTS,
    offer,
    allProducts: products.map((p) => ({ id: p.id, name: p.name })),
    cases: cases.map((c) => ({ id: c.id, title: c.title, allowedClaims: c.allowedClaims })),
    previousAds: prevAds,
    text,
  }, { headers: { "Cache-Control": "no-store" } });
}
