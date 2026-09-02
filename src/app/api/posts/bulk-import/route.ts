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
  const skeletonMode = body.skeleton === true; // E3: план-скелети без текстів/медіа

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

  // Карусель: роль-бекап + фото з галереї (та сама логіка, що й у agent-tools createPost() —
  // ЦЕЙ ендпоінт, а не create_post, є реальним шляхом, яким content-manager-v2 зберігає пости
  // з пакетної генерації плану, тому дублюємо тут). Кеш galleryCache — один запит на весь батч.
  // ФІКС (2026-09-01): "list" і "quote" прибрані звідси — фото для них опційне (LLM додає
  // сам, якщо доречно), а тут раніше АВТОМАТИЧНО чіплялось до кожного list/quote-слайду без
  // фото. "list" — найчастіша роль у карусельних структурах, тож майже КОЖЕН слайд-список у
  // майже КОЖНІЙ каруселі виходив з однаковою "фото в білій полароїд-рамці" — саме це
  // користувач і побачив як "одні й ті самі фрейми". Без примусового фото ці ролі лишаються
  // текстовими (як у більшості референсів), і реальна різноманітність макетів стає видимою.
  const PHOTO_FIELD_BY_ROLE: Record<string, string> = {
    cover: "photoUrl", photo_numbered: "photoUrl",
    photo_portrait: "photoUrl", photo_cover_personal: "photoUrl", product_photo_cover: "photoUrl",
    circle_photo_frame: "photoUrl", location_card: "photoUrl", native_text_over_photo: "photoUrl",
    collage_cutout_headline: "photoUrl", starburst_cta_badge: "photoUrl", product_callout_diagram: "photoUrl",
    press_feature_mockup: "photoUrl",
  };
  let galleryCache: { filePath: string }[] | null = null;
  // ФІКС (2026-09-01): galleryIdx завжди стартував з 0 в межах ЦЬОГО HTTP-запиту — а кожен
  // окремий пост із пакетної генерації (LLM викликає create_post по одному, не масивом)
  // це ОКРЕМИЙ виклик bulk-import, отже ОКРЕМий свіжий galleryIdx=0. Наслідок: перше фото-слайд
  // (найчастіше cover) у КОЖНОМУ пості брав рівно те саме перше фото галереї (orderBy
  // createdAt desc — детерміновано однаковий результат) — картинки різних постів виглядали
  // майже однаково. Рандомний старт розкидає перше фото по різних постах, лишаючи послідовний
  // round-robin для слайдів УСЕРЕДИНІ одного посту.
  let galleryIdx = Math.floor(Math.random() * 1000);
  const slideRolesCache = new Map<string, string[] | null>();
  // LLM здебільшого досі пише лише {text, subText} на слайд, навіть коли role вже
  // проставлено (бекфілом вище чи саме LLM) — ролі, яким потрібен items[]/quote,
  // без цього рендеряться майже порожніми. Синтезуємо розумний дефолт із subText,
  // це не заміна повноцінних даних від LLM, а страховка, щоб слайд не був голим.
  const ITEMS_ROLES = new Set(["list", "photo_numbered", "feature_card", "spec_stack", "price_table", "offer_card", "recap_checklist", "audience_grid"]);
  const QUOTE_ROLES = new Set(["quote", "manifesto"]);
  function fillMissingFields(s: any): any {
    if (!s || typeof s !== "object") return s;
    const role = s.role;
    if (ITEMS_ROLES.has(role) && !s.items && s.subText) {
      return { ...s, items: [s.subText] };
    }
    if (QUOTE_ROLES.has(role) && !s.quote && (s.subText || s.text)) {
      return { ...s, quote: s.quote || s.subText || s.text };
    }
    if (role === "case_study" && !s.items && !s.items2 && !s.body && s.subText) {
      return { ...s, body: s.subText };
    }
    return s;
  }
  async function applyCarouselBackfill(fp: Record<string, unknown> | null, structureId: string | null): Promise<Record<string, unknown> | null> {
    if (!fp || !Array.isArray((fp as any).slides)) return fp;
    let out: any = fp;
    if (structureId) {
      if (!slideRolesCache.has(structureId)) {
        const row = await prisma.structure.findFirst({ where: { projectId, skeletonKey: structureId }, select: { slideRoles: true } }).catch(() => null);
        slideRolesCache.set(structureId, Array.isArray(row?.slideRoles) ? (row!.slideRoles as string[]) : null);
      }
      const roles = slideRolesCache.get(structureId);
      if (roles && roles.length) {
        out = { ...out, slides: out.slides.map((s: any, i: number) => (s && !s.role ? { ...s, role: roles[i % roles.length] } : s)) };
      }
    }
    out = { ...out, slides: out.slides.map(fillMissingFields) };
    const needsPhoto = out.slides.some((s: any) => s && PHOTO_FIELD_BY_ROLE[s.role] && !s[PHOTO_FIELD_BY_ROLE[s.role]]);
    if (needsPhoto) {
      if (galleryCache === null) {
        galleryCache = await prisma.mediaItem.findMany({
          where: { projectId, aiGenerated: false, mimeType: { startsWith: "image/" } },
          orderBy: { createdAt: "desc" }, take: 30, select: { filePath: true },
        }).catch(() => []);
        // ФІКС (2026-09-01): galleryIdx завжди стартував з 0 — а він живе в межах ОДНОГО
        // HTTP-запиту bulk-import. Коли пости зі спільної теми/плану приходять пакетом
        // (кожен окремим запитом), слайд-обкладинка (перший фото-слайд) у КОЖНОГО поста
        // брав galleryCache[0] — той самий перший файл щоразу. Різні пости виглядали
        // ідентично на обкладинці, хоч палітра/текст і відрізнялись. Випадковий старт
        // розкидає, яке фото дістанеться слайду-обкладинці різних постів.
        if (galleryCache.length) galleryIdx = Math.floor(Math.random() * galleryCache.length);
      }
      if (galleryCache.length) {
        const base = process.env.NEXTAUTH_URL || "https://content2.fineko.space";
        out = {
          ...out,
          slides: out.slides.map((s: any) => {
            const field = s && PHOTO_FIELD_BY_ROLE[s.role];
            if (!field || s[field]) return s;
            const url = base + galleryCache![galleryIdx % galleryCache!.length].filePath;
            galleryIdx++;
            return { ...s, [field]: url };
          }),
        };
      }
    }
    return out;
  }

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
    // Скелет — завжди draft (текст напишеться на фазі J-2); інакше critic вирішує.
    const groupStatus = skeletonMode ? "draft" : (scanWriting(String(p.content || "")).length > 0 ? "draft" : "scheduled");

    // funnel_slug + funnel_params from new bot format
    const funnelSlug: string | null = p.funnel_slug || null;
    let funnelParams: Record<string, unknown> | null = p.funnel_params || null;

    // Backward compat: if no funnel_slug but has media_type, derive funnel_slug
    const derivedFunnelSlug = funnelSlug || deriveSlugFromMediaType(p.media_type);

    if (derivedFunnelSlug === "content-carousel") {
      funnelParams = await applyCarouselBackfill(funnelParams, atomData.structureId);
    }

    // Determine if image generation is needed (скелети медіа не генерують).
    const needsGeneration = !skeletonMode && Boolean(derivedFunnelSlug && derivedFunnelSlug !== "text_only");

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
          skeleton: skeletonMode,
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
