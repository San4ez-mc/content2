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
  { key: "aida", name: "AIDA-lite", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], minLen: 500, maxLen: 1800, hookTypes: ["pain", "promise", "question"], structure: "Гачок (біль) → Цінність (рішення) → Доказ (кейс) → CTA." },
  { key: "pas", name: "PAS", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], minLen: 500, maxLen: 1800, hookTypes: ["pain", "provocation"], structure: "Проблема → Підсилення болю → Рішення → CTA." },
  { key: "case", name: "Кейс", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], minLen: 500, maxLen: 2000, hookTypes: ["stat", "story", "promise"], structure: "Результат (цифра) → Було → Що зробили → Стало → CTA. Кейси й цифри — тільки реальні." },
  { key: "insight", name: "Інсайт / думка", platforms: ["threads", "linkedin"], postTypes: ["post", "thread"], minLen: 300, maxLen: 1500, hookTypes: ["provocation", "counter", "question"], structure: "Теза → Контекст → Несподіваний поворот → Обговорення." },
  { key: "listicle", name: "Лістикл", platforms: ["linkedin", "telegram", "instagram"], postTypes: ["post", "carousel"], minLen: 400, maxLen: 2000, hookTypes: ["listicle", "promise"], structure: "«N способів…» → пункти (кожен = мікро-цінність) → Збережи." },
  { key: "provocation", name: "Провокація", platforms: ["threads", "linkedin"], postTypes: ["post", "thread"], minLen: 200, maxLen: 1500, hookTypes: ["provocation", "counter"], structure: "Непопулярна думка → Аргумент → Нюанс/баланс → CTA (згоден?)." },

  // ── Threads: короткі формати ──
  { key: "short_thought", name: "Коротка думка", platforms: ["threads"], postTypes: ["post"], minLen: 30, maxLen: 100, hookTypes: ["provocation", "counter"], structure: "Одна гостра теза без вступу. 30-100 символів." },
  { key: "question", name: "Питання", platforms: ["threads"], postTypes: ["post"], minLen: 20, maxLen: 80, hookTypes: ["question"], structure: "Одне гостре питання без крапки. 20-80 символів." },
  { key: "thread_chain", name: "Тред-ланцюг", platforms: ["threads"], postTypes: ["thread"], minLen: 300, maxLen: 2500, hookTypes: ["promise", "story"], structure: "3-5 частин через ---, нумерація 1/N. Перша частина = хук." },
  { key: "long_story", name: "Довга історія", platforms: ["threads", "telegram"], postTypes: ["post"], minLen: 150, maxLen: 400, hookTypes: ["story", "pain"], structure: "Сцена з практики: ситуація → напруга → момент правди → наслідок. Жива деталь." },

  // ── LinkedIn ──
  { key: "analysis", name: "Аналітичний розбір", platforms: ["linkedin"], postTypes: ["post"], minLen: 800, maxLen: 2000, hookTypes: ["stat", "promise"], structure: "B2B-кут: теза → структуровано з цифрами → висновок. Експертно." },

  // ── Візуальні формати (окремі структури + правила) ──
  { key: "carousel", name: "Карусель", platforms: ["instagram", "linkedin"], postTypes: ["carousel"], hookTypes: ["promise", "listicle", "pain"], structure: "Слайд 1 = хук-обкладинка (обіцянка). Слайди 2..N-1 = по одному кроку. Слайд N = доказ + CTA.", rules: "4-6 слайдів; слайд 1 — обкладинка-обіцянка (хук); один слайд = одна думка; останній = CTA або доказ. Підпис допису окремо." },
  { key: "reels", name: "Рілс", platforms: ["instagram"], postTypes: ["reel"], hookTypes: ["pain", "promise", "counter"], structure: "Hook (3с, візуальний + вербальний) → швидка обіцянка → 3 биті цінності → CTA.", rules: "Перші 3 секунди вирішують; хук візуальний і вербальний одночасно; патерн-інтеррапти (зміна кадру/тексту) кожні 2-3с; субтитри ЗАВЖДИ; вертикаль 9:16." },
  { key: "stories", name: "Сторіз", platforms: ["instagram"], postTypes: ["story"], minLen: 0, maxLen: 120, hookTypes: ["question", "pain"], structure: "Хук-стікер (питання/опитування) → 1 думка → свайп/CTA.", rules: "Мікроформат; текст на фото; дуже коротко; без хештегів. Title 3-7 слів + підзаголовок одне речення." },

  // ── 25 схем допису маркетолога (розпарсено з методологічних docx, 2026-08-22) ──
  // Ті самі схеми дублюються у вектор-базі (kind=post_scheme, колекція global) для
  // семантичного пошуку — тут вони йдуть як РЕАЛЬНІ вибирані структури get_structures(),
  // щоб конструктор постів міг реально їх застосувати, а не лише "знати про них".
  { key: "ps_oporna_tochka", name: "Опорна точка — пояснення", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["promise", "question"], structure: "Заголовок → короткий вступ → 3-5 аргументів → висновок → заклик або питання.", rules: "Коли застосовувати: треба щось логічно пояснити, довести або розкласти по поличках." },
  { key: "ps_za_lashtunkamy", name: "За лаштунками", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["provocation", "counter"], structure: "Популярний страх, міф або паніка → «що думаю я» → кілька пунктів переосмислення → висновок → підводка до рішення або продукту.", rules: "Коли застосовувати: поширена думка, страх або переконання можуть бути хибними." },
  { key: "ps_intryga", name: "Інтрига", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["question", "story"], structure: "Інтрига в початку → знайомі труднощі → чесний погляд → мотиваційний або логічний розворот → заклик до дії.", rules: "Коли застосовувати: треба швидко втягнути людину в текст через напругу, невизначеність або особистий момент." },
  { key: "ps_bazhanyi_rezultat", name: "Бажаний результат", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["promise", "pain"], structure: "Провокація → корисний факт → пояснення → підводка до продукту → заклик.", rules: "Коли застосовувати: треба намалювати привабливу картинку результату." },
  { key: "ps_fakt", name: "Факт", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["stat"], structure: "Сильний факт → пояснення → аргументи → що це означає для читача → продаж або м'який перехід.", rules: "Коли застосовувати: треба побудувати довіру через конкретний факт." },
  { key: "ps_10_prychyn", name: "10 причин «за»", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "carousel"], hookTypes: ["listicle", "promise"], structure: "Назва пропозиції → 5-10 причин → короткий підсумок → заклик.", rules: "Коли застосовувати: продукт уже зрозумілий і треба підсилити рішення через перелік причин." },
  { key: "ps_pomylka", name: "Помилка", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["pain", "counter"], structure: "Назва або опис помилки → чому це помилка → як правильно → чим допомагає ваш продукт або підхід → заклик.", rules: "Коли застосовувати: треба показати типову помилку і дати правильний напрямок." },
  { key: "ps_strakh", name: "Страх", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["pain"], structure: "Страх у заголовку або перших рядках → деталізація внутрішнього стану → пояснення → формула рішення → м'який або прямий заклик.", rules: "Коли застосовувати: людину стримує тривога, сором або відчуття безсилля." },
  { key: "ps_keis_priklad", name: "Кейс або приклад", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["story", "stat"], structure: "Заголовок → коротка зав'язка → що було → що зроблено → що стало → підсумок.", rules: "Коли застосовувати: треба показати шлях клієнта або типовий приклад. Кейси й цифри — тільки реальні." },
  { key: "ps_prodazh_cherez_navchannya", name: "Продаж через навчання", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["promise"], structure: "Корисна теза → кроки або поради → короткий висновок → що можна отримати глибше в продукті → заклик.", rules: "Коли застосовувати: треба дати користь і нативно підвести до продукту." },
  { key: "ps_pidbirka", name: "Підбірка", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "carousel"], hookTypes: ["listicle"], structure: "Тема добірки → список пунктів → короткий коментар до кожного → роль автора → м'який перехід до співпраці.", rules: "Коли застосовувати: треба мотивувати зберегти допис і дати добірку рішень, ідей або інструментів." },
  { key: "ps_nevdalyi_dosvid", name: "Невдалий досвід", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["pain", "story"], structure: "Серія питань або впізнаваних фраз → називання застою → пояснення, що вихід існує → запрошення довіритись фахівцю → заклик.", rules: "Коли застосовувати: треба нагадати людині її попередні безрезультатні спроби і показати, що інакший шлях можливий." },
  { key: "ps_standartni_zaperechennya", name: "Стандартні заперечення", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["counter"], structure: "Заперечення або коментар → ваша реакція → кілька тез, які змінюють кут погляду → пояснення, чому продукт має сенс → заклик.", rules: "Коли застосовувати: треба логічно і спокійно закрити популярні сумніви." },
  { key: "ps_defitsyt", name: "Дефіцит", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["promise"], structure: "Що обмежене → чому це цінно → що входить → чому зараз → заклик.", rules: "Коли застосовувати: є обмежена пропозиція, дедлайн, мала кількість місць або спецумови." },
  { key: "ps_do_pislya_mist", name: "До — після — міст", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["story", "promise"], structure: "Було → стало → що стало мостом між цими точками → висновок → перехід до пропозиції.", rules: "Коли застосовувати: треба показати різницю між стартом і результатом та пояснити, за рахунок чого стався перехід." },
  { key: "ps_ya_produkt_svogo_produktu", name: "Я продукт свого продукту", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["story"], structure: "Що в мені або в моєму житті стало доказом → як я до цього прийшла → чому це важливо для клієнта → м'яка прив'язка до продукту.", rules: "Коли застосовувати: автор сам є прикладом результату свого підходу." },
  { key: "ps_obgruntuvannya_vartosti", name: "Обґрунтування вартості", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["counter", "promise"], structure: "Що входить → чому це коштує саме так → що людина реально отримує → чому це вигідно → заклик.", rules: "Коли застосовувати: треба пояснити ціну, цінність або наповнення." },
  { key: "ps_viddil_prodazhu", name: "Відділ продажу", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["provocation"], structure: "Сильна теза → пояснення ролі контенту → приклад або аргументи → висновок → перехід до продукту.", rules: "Коли застосовувати: треба показати, що контент виконує функцію продажу і цю функцію не можна ігнорувати." },
  { key: "ps_ya_zavazhayu_sobi", name: "Я заважаю собі сама", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["pain", "story"], structure: "Симптом → типова поведінка → що за цим стоїть → що можна зробити інакше → м'який висновок.", rules: "Коли застосовувати: треба показати самосаботаж, внутрішні бар'єри або звичні патерни, які зупиняють людину." },
  { key: "ps_meni_mozhna", name: "Мені можна", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["pain"], structure: "Внутрішнє обмеження → перелік того, що «мені можна» → емоційний розворот → висновок або запрошення.", rules: "Коли застосовувати: треба дати дозвіл, підтримку або зняти внутрішню заборону." },
  { key: "ps_mizh_ryadkiv", name: "Те, що між рядків", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["provocation", "question"], structure: "Зовнішня ситуація → що люди зазвичай бачать → що насправді відбувається → висновок.", rules: "Коли застосовувати: треба показати прихований зміст ситуації, справжню причину або невидиму логіку." },
  { key: "ps_kontrast", name: "Контраст", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["story", "counter"], structure: "Сценарій 1 → сценарій 2 → різниця → висновок → перехід до рішення.", rules: "Коли застосовувати: треба показати різницю між двома сценаріями, підходами або станами." },
  { key: "ps_rozvinchuvannya_romantyzatsii", name: "Розвінчування романтизації", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["provocation", "counter"], structure: "Популярна романтизована ідея → що в ній не так → що реально працює → висновок.", rules: "Коли застосовувати: треба забрати ілюзію, красиву, але хибну картинку." },
  { key: "ps_tryger_istorii", name: "Тригер історії", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["story"], structure: "Герой → зав'язка → ускладнення → перелом → результат → висновок.", rules: "Коли застосовувати: треба посилити залучення і дочитування через сюжет." },
  { key: "ps_eksklyuzyvnist", name: "Ексклюзивність", platforms: ["threads", "instagram", "linkedin", "telegram"], postTypes: ["post", "thread"], hookTypes: ["promise"], structure: "Що саме ексклюзивне → чому це рідкість → що дає → кому підходить → заклик.", rules: "Коли застосовувати: треба показати особливу пропозицію, особливий доступ, унікальний склад або рідкісний формат." },

  // ── Карусель-наратив "визнання → продукт" (розібрано з реального прикладу в Instagram, 2026-08-30) ──
  { key: "carousel_vyznannya_do_produktu", name: "Карусель: визнання/новина → продукт (reveal-арка)", platforms: ["instagram", "linkedin"], postTypes: ["carousel"], hookTypes: ["story", "promise"], structure: "Слайд 1 = анонс-обкладинка (особисте визнання/новина: грант, нагорода, подія) з фото автора. Слайд 2 = рутина/біль, яку це визнання нарешті дозволяє вирішити (буллет-список + фото-доказ). Слайд 3 = підтвердження компетентності в темі (ми вже це робимо). Слайд 4 = «що вже працює» — нумерований список [1]-[5] поверх затемненого групового фото. Слайд 5 = розгорнута ідея/продукт суцільним абзацом + виділений блок-цитата з ключовим уточненням + фото-метафора. Слайд 6 = особисте «і саме це мене зараз…» (портрет), речення обривається і йде далі хвилястою лінією-конектором. Слайд 7 = продовження речення через лінію-конектор + «що нам потрібно зараз» (буллети-прохання: прискорити, зібрати команду) + місток до підтримки/гранту. Слайд 8 = «кому це буде корисно» — сегменти аудиторії в 2 колонки з іконками. Слайд 9 = фінальний маніфест у рамці-цитаті (жирний ключовий виділений фрагмент) + подяка за підтримку.", rules: "Коли застосовувати: є привід (грант, нагорода, визнання, помітна подія), який можна розгорнути в анонс продукту чи великої ініціативи — особиста новина плавно переростає в презентацію рішення. Дизайн: rounded pill-бейдж з назвою етапу у верх-лівому куті на кожному сюжетному слайді; хвиляста лінія-конектор — наскрізний елемент, що переносить кінець речення з одного слайду на інший (не обривай думку в межах слайду без цього прийому); нумеровані пункти в квадратних дужках [1]-[5] розкидані по затемненому груповому фото для блоку «що вже є»; полароїд-фото з рукописним підписом для емоційного акценту; фото-метафора (напр. подарунок) для абстрактної ідеї; текстова рамка (border-only box) для ключової цитати/маніфесту в фіналі; приглушена консистентна палітра (оливково-зелений/бежевий) на всю карусель; дрібний юзернейм-ватермарк по центру текстових слайдів. 8-9 слайдів; підпис допису — окремим текстом, не дублює слайди." },
];

// Правила кожної мережі (тон, довжина, хештеги, лінки, алгоритм). Ключ = platformKey.
export const DEFAULT_NETWORK_RULES: Record<string, string> = {
  threads: "Тон: «ти», невимушено. Хук у перших 5-7 словах. Обрізка ~500 символів — найважливіше на початку. Без хештегів (максимум 1). Посилання окремим рядком «🔗 …». Формати: короткі й середні тексти, ланцюги. Каруселі/рілси/сторіз — не для Threads.",
  instagram: "Тон: живий, візуал вирішує. Підпис 300-1500 символів. Хук у першому рядку (обрізка ~125 символів). Хештеги 4-5 окремим блоком у кінці. Головні формати: карусель, рілс, сторіз, пост-кейс. Дуже короткі думки/питання — не сюди.",
  linkedin: "Тон: «Ви», експертно, B2B, з цифрами. 800-2000 символів. Хук з першого рядка. Хештеги 3-5. Посилання ТІЛЬКИ в перший коментар, не в тіло поста (алгоритм знижує охоплення постів із зовнішніми лінками). Тільки реальні кейси, без вигаданих історій.",
  telegram: "Тон: особистий, «Ви/ти». Довжина довільна. 2-4 emoji. Без хештегів. Посилання inline — ок.",
  tiktok: "Відео. Перші 3 секунди вирішують. Субтитри завжди. Тренди й актуальні звуки. Вертикаль 9:16.",
  youtube: "Відео Shorts. Перші 3 секунди вирішують. Субтитри завжди. Вертикаль 9:16. Посилання — в опис.",
};

export async function seedDefaultStructures(projectId: string): Promise<{ created: number; updated: number }> {
  const existing = await prisma.structure.findMany({ where: { projectId }, select: { id: true, skeletonKey: true, name: true } });
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
    if (id) { await prisma.structure.update({ where: { id }, data }); updated++; }
    else { await prisma.structure.create({ data: { projectId, prompt: "", ...data } }); created++; }
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

// Дефолтні канали — 4 основні текстові мережі. Без цього generate/bulk-import мовчки
// пропускає КОЖЕН пост (networkByPlatform.get(platform) === undefined → continue),
// і новий клієнт після повного онбордингу отримує "Збережено 0 пост(ів)" без пояснення.
// Клієнт може вимкнути/додати мережі вручну в /networks — це лише стартовий набір.
const DEFAULT_SOCIAL_NETWORKS: { platformKey: string; name: string; icon: string; color: string; linkPlacement: string }[] = [
  { platformKey: "threads", name: "Threads Posts", icon: "🧵", color: "#9333ea", linkPlacement: "comment" },
  { platformKey: "instagram", name: "Instagram", icon: "📸", color: "#ec4899", linkPlacement: "bio" },
  { platformKey: "linkedin", name: "LinkedIn", icon: "💼", color: "#3b82f6", linkPlacement: "comment" },
  { platformKey: "telegram", name: "Telegram", icon: "", color: "#229ED9", linkPlacement: "inline" },
];

export async function seedDefaultSocialNetworks(projectId: string): Promise<{ created: number }> {
  const existing = await prisma.socialNetwork.findMany({ where: { projectId }, select: { platformKey: true } });
  const have = new Set(existing.map((n) => n.platformKey));
  let created = 0;
  for (let i = 0; i < DEFAULT_SOCIAL_NETWORKS.length; i++) {
    const n = DEFAULT_SOCIAL_NETWORKS[i];
    if (have.has(n.platformKey)) continue;
    await prisma.socialNetwork.create({
      data: {
        projectId, name: n.name, platformKey: n.platformKey, icon: n.icon || null, color: n.color,
        isEnabled: true, sortOrder: i, linkPlacement: n.linkPlacement,
        rules: DEFAULT_NETWORK_RULES[n.platformKey] || null,
      },
    });
    created++;
  }
  return { created };
}
