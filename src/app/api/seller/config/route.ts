import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireProjectAccess, isGateError } from "@/lib/tenant";
import { loadBriefInput } from "@/lib/sellerBriefDb";
import { compileBrief, docMap, DOC } from "@/lib/sellerBrief";
import { sanitizeConfigInput } from "@/lib/sellerConfigInput";

// Налаштування ШІ-продавця експерта: правила продажу + статус запуску. Контент (послуга, кейси, профіль) редагується у своїх розділах.
// GET — будь-хто з доступом до проєкту (бачить стан і готовність). PUT — лише admin/superadmin (запуск продавця — рішення власника).

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const gate = await requireProjectAccess(projectId);
  if (isGateError(gate)) return gate.error;

  const input = await loadBriefInput(projectId!);
  if (!input) return NextResponse.json({ error: "Проєкт не знайдено" }, { status: 404 });
  const brief = compileBrief(input);
  const docs = docMap(input.docs);
  const c = input.config;
  return NextResponse.json({
    exists: !!c,
    config: {
      status: c?.status || "draft", mode: c?.mode || "book_consult",
      sellerName: c?.sellerName || "", sellerTitle: c?.sellerTitle || "",
      primaryProductId: c?.primaryProductId || "", bookingUrl: c?.bookingUrl || "", bookingNote: c?.bookingNote || "",
      handoffTelegramId: c?.handoffTelegramId || "", allowedContacts: c?.allowedContacts || "",
      priceAmount: c?.priceAmount ?? "", currency: c?.currency || "UAH", paymentConnectorId: c?.paymentConnectorId || "",
      monthlyDialogLimit: c?.monthlyDialogLimit ?? "", testAllowlist: Array.isArray(c?.testAllowlist) ? c!.testAllowlist : [],
      texts: c?.texts && typeof c.texts === "object" ? c.texts : {},
      funnelBotId: c?.funnelBotId || "", templateVersion: c?.templateVersion || "", goLiveAt: c?.goLiveAt || null,
    },
    products: input.products.map((p) => ({ id: p.id, name: p.name, price: p.price || "" })),
    readiness: brief.readiness,
    // підказки з онбордингу: що експерт уже сказав (щоб власник переніс у поля)
    hints: { booking: docs[DOC.booking]?.value || "", notify: docs[DOC.notify]?.value || "", name: docs[DOC.name]?.value || "" },
    defaultTexts: brief.texts,
    preview: { offer: brief.blocks.offer, proof: brief.blocks.proof, rules: brief.blocks.rules, tone: brief.blocks.tone, faq: brief.blocks.faq, qualify: brief.blocks.qualify, booking: brief.blocks.booking },
  });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if (isGateError(gate)) return gate.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = String(body.projectId || "").trim();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const input = await loadBriefInput(projectId);
  if (!input) return NextResponse.json({ error: "Проєкт не знайдено" }, { status: 404 });

  const clean = sanitizeConfigInput(body);
  if (!clean.ok) return NextResponse.json({ error: clean.error }, { status: 400 });
  const patch = clean.data;

  // запуск (live) — лише коли бриф готовий: перевіряємо на ЗЛИТТІ старого й нового
  const merged = { ...(input.config || { status: "draft", mode: "book_consult", sellerName: "", sellerTitle: "" }), ...patch } as NonNullable<typeof input.config>;
  const after = compileBrief({ ...input, config: merged });
  if (patch.status === "live" && !after.readiness.ready) {
    return NextResponse.json({ error: "Не можна запустити: " + after.readiness.missing.join("; "), missing: after.readiness.missing }, { status: 400 });
  }
  if (patch.primaryProductId && !input.products.some((p) => p.id === patch.primaryProductId)) {
    return NextResponse.json({ error: "Обраної послуги немає в цьому проєкті" }, { status: 400 });
  }

  const wasLive = input.config?.status === "live";
  const data = { ...patch, ...(patch.status === "live" && !wasLive && !input.config?.goLiveAt ? { goLiveAt: new Date() } : {}) };
  const saved = await prisma.sellerConfig.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, status: saved.status, readiness: after.readiness });
}
