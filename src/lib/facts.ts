// Факти з датами: "що актуально зараз" проти "що вже застаріло".
// Факт = запис бази знань з category="fact" + період дії (validFrom/validUntil) + тема (topic).
// Новий факт тієї ж теми автоматично замінює попередній (див. supersedeTopic в agent-tools).
// Вся логіка статусів — тут, чиста (без БД), щоб покрити тестами.

export type FactStatus = "active" | "scheduled" | "outdated";

export interface FactLike {
  id?: string;
  topic?: string | null;
  title: string;
  content: string;
  isActive: boolean;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  supersededAt?: Date | string | null;
  staleMarkers?: string | null;
}

/** Сьогоднішня дата в Києві як YYYY-MM-DD (сервер живе в UTC). */
export function todayKyiv(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Date | ISO-рядок | null → "YYYY-MM-DD" | null. */
export function dayOf(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
}

/** Приймає YYYY-MM-DD або DD.MM.YY(YY) → YYYY-MM-DD, інакше null. */
export function parseDay(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** YYYY-MM-DD → DD.MM.YY (єдиний формат дат для людей). */
export function fmtDay(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y.slice(2)}`;
}

export function dayBefore(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export function factStatus(f: FactLike, today: string = todayKyiv()): FactStatus {
  if (!f.isActive || f.supersededAt) return "outdated";
  const from = dayOf(f.validFrom);
  const until = dayOf(f.validUntil);
  if (until && until < today) return "outdated";
  if (from && from > today) return "scheduled";
  return "active";
}

export function sameTopic(a?: string | null, b?: string | null): boolean {
  const n = (x?: string | null) => String(x || "").trim().toLowerCase();
  return !!n(a) && n(a) === n(b);
}

export function splitMarkers(s?: string | null): string[] {
  return String(s || "").split(/[\n;|]+/).map((x) => x.trim()).filter((x) => x.length >= 3);
}

/** Які маркери старого формулювання присутні в тексті (регістр не важливий). */
export function findStaleMarkers(text: string, markers: string[]): string[] {
  const t = String(text || "").toLowerCase();
  return markers.filter((m) => t.includes(m.toLowerCase()));
}

/** Блок для промпту генерації: тільки те, що дійсно діє СЬОГОДНІ (+ анонси на майбутнє). */
export function factsPromptBlock(facts: FactLike[], today: string = todayKyiv()): string {
  const active = facts.filter((f) => factStatus(f, today) === "active");
  const upcoming = facts.filter((f) => factStatus(f, today) === "scheduled");
  const line = (f: FactLike) => {
    const from = dayOf(f.validFrom);
    const until = dayOf(f.validUntil);
    const span = from || until ? ` [${from ? "з " + fmtDay(from) : ""}${from && until ? " " : ""}${until ? "до " + fmtDay(until) : ""}]` : "";
    return `- ${f.title}${span}: ${f.content}`;
  };
  const out: string[] = [];
  out.push(`АКТУАЛЬНІ ФАКТИ (станом на ${fmtDay(today)}). Це єдина правда про поточний стан продукту/компанії. Якщо щось у цьому блоці суперечить решті бази знань, кейсам чи старим постам — вірним є цей блок.`);
  out.push(active.length ? active.map(line).join("\n") : "(актуальних фактів немає)");
  if (upcoming.length) out.push(`\nЗАПЛАНОВАНО НА МАЙБУТНЄ (говорити як про те, що ще лише буде, не як про вже наявне):\n${upcoming.map(line).join("\n")}`);
  return out.join("\n");
}

/**
 * Автоматичні маркери застарілого: числові звороти зі СТАРИХ фактів («10 тестувальників», «останніх 5»), яких уже нема в діючих.
 * Бот сам добирає stale_markers нерівно (на KIRO пропустив «останніх 5» і «вже 10» у 7 постах), тому детермінований
 * шар додатково бере з вичерпаного факту все, що виглядає як число + слово, і шукає це в запланованих постах.
 */
export function derivedStaleMarkers(outdated: { title: string; content: string }[], currentText: string): string[] {
  const keep = String(currentText || "").toLowerCase();
  const out = new Set<string>();
  // RegExp(...) а не літерал: tsconfig target < es6 не знає прапорця u, а Node (runtime) знає
  const re = new RegExp("(?:останн\p{L}*\s+)?(?<![\d.])\d{1,3}\s+\p{L}{3,}", "giu");
  for (const f of outdated) {
    const text = `${f.title}\n${f.content}`;
    for (const m of Array.from(text.matchAll(re))) {
      const phrase = m[0].toLowerCase().replace(/\s+/g, " ").trim();
      if (!keep.includes(phrase)) out.add(phrase);
    }
  }
  return Array.from(out);
}
