import { prisma } from "@/lib/prisma";

// Канонічний набір структур постів (скелетів). Per-project, засівається при створенні
// проєкту (щоб не було порожньо). platforms = яким мережам, postTypes = яким форматам.
// skeletonKey = стабільний id для скорингу WinningPattern.
export type StructureSeed = {
  key: string; name: string; platforms: string[]; postTypes: string[];
  minLen?: number; maxLen?: number; hookTypes: string[]; structure: string; rules?: string;
};

export const DEFAULT_STRUCTURES: StructureSeed[] = [
  // ── Універсальні текстові скелети ──
  { key: "aida", name: "AIDA-lite", platforms: ["threads", "instagram_posts", "linkedin", "telegram"], postTypes: ["post", "thread"], minLen: 500, maxLen: 1800, hookTypes: ["pain", "promise", "question"], structure: "Гачок (біль) → Цінність (рішення) → Доказ (кейс) → CTA." },
  { key: "pas", name: "PAS", platforms: ["threads", "instagram_posts", "linkedin", "telegram"], postTypes: ["post", "thread"], minLen: 500, maxLen: 1800, hookTypes: ["pain", "provocation"], structure: "Проблема → Підсилення болю → Рішення → CTA." },
  { key: "case", name: "Кейс", platforms: ["threads", "instagram_posts", "linkedin", "telegram"], postTypes: ["post", "thread"], minLen: 500, maxLen: 2000, hookTypes: ["stat", "story", "promise"], structure: "Результат (цифра) → Було → Що зробили → Стало → CTA. Кейси й цифри — тільки реальні." },
  { key: "insight", name: "Інсайт / думка", platforms: ["threads", "linkedin"], postTypes: ["post", "thread"], minLen: 300, maxLen: 1500, hookTypes: ["provocation", "counter", "question"], structure: "Теза → Контекст → Несподіваний поворот → Обговорення." },
  { key: "listicle", name: "Лістикл", platforms: ["linkedin", "telegram", "instagram_posts"], postTypes: ["post", "carousel"], minLen: 400, maxLen: 2000, hookTypes: ["listicle", "promise"], structure: "«N способів…» → пункти (кожен = мікро-цінність) → Збережи." },
  { key: "provocation", name: "Провокація", platforms: ["threads", "linkedin"], postTypes: ["post", "thread"], minLen: 200, maxLen: 1500, hookTypes: ["provocation", "counter"], structure: "Непопулярна думка → Аргумент → Нюанс/баланс → CTA (згоден?)." },

  // ── Threads: короткі формати ──
  { key: "short_thought", name: "Коротка думка", platforms: ["threads"], postTypes: ["post"], minLen: 30, maxLen: 100, hookTypes: ["provocation", "counter"], structure: "Одна гостра теза без вступу. 30-100 символів." },
  { key: "question", name: "Питання", platforms: ["threads"], postTypes: ["post"], minLen: 20, maxLen: 80, hookTypes: ["question"], structure: "Одне гостре питання без крапки. 20-80 символів." },
  { key: "thread_chain", name: "Тред-ланцюг", platforms: ["threads"], postTypes: ["thread"], minLen: 300, maxLen: 2500, hookTypes: ["promise", "story"], structure: "3-5 частин через ---, нумерація 1/N. Перша частина = хук." },
  { key: "long_story", name: "Довга історія", platforms: ["threads", "telegram"], postTypes: ["post"], minLen: 150, maxLen: 400, hookTypes: ["story", "pain"], structure: "Сцена з практики: ситуація → напруга → момент правди → наслідок. Жива деталь." },

  // ── LinkedIn ──
  { key: "analysis", name: "Аналітичний розбір", platforms: ["linkedin"], postTypes: ["post"], minLen: 800, maxLen: 2000, hookTypes: ["stat", "promise"], structure: "B2B-кут: теза → структуровано з цифрами → висновок. Експертно." },

  // ── Візуальні формати (окремі структури + правила) ──
  { key: "carousel", name: "Карусель", platforms: ["instagram_posts", "linkedin"], postTypes: ["carousel"], hookTypes: ["promise", "listicle", "pain"], structure: "Слайд 1 = хук-обкладинка (обіцянка). Слайди 2..N-1 = по одному кроку. Слайд N = доказ + CTA.", rules: "4-6 слайдів; слайд 1 — обкладинка-обіцянка (хук); один слайд = одна думка; останній = CTA або доказ. Підпис допису окремо." },
  { key: "reels", name: "Рілс", platforms: ["instagram_posts"], postTypes: ["reel"], hookTypes: ["pain", "promise", "counter"], structure: "Hook (3с, візуальний + вербальний) → швидка обіцянка → 3 биті цінності → CTA.", rules: "Перші 3 секунди вирішують; хук візуальний і вербальний одночасно; патерн-інтеррапти (зміна кадру/тексту) кожні 2-3с; субтитри ЗАВЖДИ; вертикаль 9:16." },
  { key: "stories", name: "Сторіз", platforms: ["instagram_posts"], postTypes: ["story"], minLen: 0, maxLen: 120, hookTypes: ["question", "pain"], structure: "Хук-стікер (питання/опитування) → 1 думка → свайп/CTA.", rules: "Мікроформат; текст на фото; дуже коротко; без хештегів. Title 3-7 слів + підзаголовок одне речення." },
];

// Правила кожної мережі (тон, довжина, хештеги, лінки, алгоритм). Ключ = platformKey.
export const DEFAULT_NETWORK_RULES: Record<string, string> = {
  threads: "Тон: «ти», невимушено. Хук у перших 5-7 словах. Обрізка ~500 символів — найважливіше на початку. Без хештегів (максимум 1). Посилання окремим рядком «🔗 …». Формати: короткі й середні тексти, ланцюги. Каруселі/рілси/сторіз — не для Threads.",
  instagram_posts: "Тон: живий, візуал вирішує. Підпис 300-1500 символів. Хук у першому рядку (обрізка ~125 символів). Хештеги 4-5 окремим блоком у кінці. Головні формати: карусель, рілс, сторіз, пост-кейс. Дуже короткі думки/питання — не сюди.",
  linkedin: "Тон: «Ви», експертно, B2B, з цифрами. 800-2000 символів. Хук з першого рядка. Хештеги 3-5. Посилання ТІЛЬКИ в перший коментар, не в тіло поста (алгоритм знижує охоплення постів із зовнішніми лінками). Тільки реальні кейси, без вигаданих історій.",
  telegram: "Тон: особистий, «Ви/ти». Довжина довільна. 2-4 emoji. Без хештегів. Посилання inline — ок.",
  tiktok: "Відео. Перші 3 секунди вирішують. Субтитри завжди. Тренди й актуальні звуки. Вертикаль 9:16.",
};

export async function seedDefaultStructures(projectId: string): Promise<{ created: number; updated: number }> {
  const existing = await prisma.contentType.findMany({ where: { projectId }, select: { id: true, skeletonKey: true, name: true } });
  const byKey = new Map(existing.filter((e) => e.skeletonKey).map((e) => [e.skeletonKey as string, e.id]));
  const byName = new Map(existing.map((e) => [e.name.toLowerCase().trim(), e.id]));
  let created = 0, updated = 0;
  for (let i = 0; i < DEFAULT_STRUCTURES.length; i++) {
    const s = DEFAULT_STRUCTURES[i];
    const data = {
      name: s.name, structure: s.structure, platforms: s.platforms as any, postTypes: s.postTypes as any,
      hookTypes: s.hookTypes as any, skeletonKey: s.key, minLen: s.minLen ?? null, maxLen: s.maxLen ?? null,
      rules: s.rules ?? null, sortOrder: i,
    };
    const id = byKey.get(s.key) || byName.get(s.name.toLowerCase().trim());
    if (id) { await prisma.contentType.update({ where: { id }, data }); updated++; }
    else { await prisma.contentType.create({ data: { projectId, prompt: "", ...data } }); created++; }
  }
  return { created, updated };
}

export async function seedDefaultNetworkRules(projectId: string): Promise<{ updated: number }> {
  const networks = await prisma.socialNetwork.findMany({ where: { projectId }, select: { id: true, platformKey: true, rules: true } });
  let updated = 0;
  for (const n of networks) {
    const rule = DEFAULT_NETWORK_RULES[n.platformKey];
    if (rule && !n.rules) { await prisma.socialNetwork.update({ where: { id: n.id }, data: { rules: rule } }); updated++; }
  }
  return { updated };
}
