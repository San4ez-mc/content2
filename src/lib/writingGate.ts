// Детермінований гейт стандарту письма (Шар 2 критика). Чистий модуль без залежностей —
// щоб (1) перевикористати в agent-tools, (2) покрити автотестами (F1), (3) не тримати
// логіку всередині монолітних роутів.

export const WBANNED = ["безумовно", "вкрай важливо", "слід зазначити", "варто зазначити", "важливо розуміти", "на сьогоднішній день", "у сучасному світі", "таким чином", "підбиваючи підсумок", "ключовий момент", "це дозволяє", "здійснювати", "багатогранний", "нюансований", "безшовний", "delve", "nuanced", "seamless", "robust", "tapestry", "in conclusion", "розкриємо таємниці", "зануримося у світ", "в наш час", "кожен з нас"];
export const WSUMMARY = ["отже", "таким чином", "підбиваючи підсумок", "на закінчення", "підсумовуючи", "у підсумку", "в цілому"];
export const WGREETING = ["привіт", "друзі", "доброго дня", "сьогодні поговоримо", "хочу поділитися", "давно хотів", "давно хотіла"];

export type Violation = { type: string; detail: string };

// Скан тексту → список порушень (стоп-слова, щільність тире, підсумкові кліше, привітання).
export function scanWriting(text: string): Violation[] {
  const violations: Violation[] = [];
  const low = String(text || "").toLowerCase();
  for (const w of WBANNED) if (low.includes(w)) violations.push({ type: "banned_word", detail: `стоп-слово «${w}»` });
  const paras = String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paras) {
    const dashes = (p.match(/—/g) || []).length;
    if (dashes > 1) violations.push({ type: "dash_overuse", detail: `${dashes} тире в одному абзаці (макс 1)` });
    const pl = p.toLowerCase();
    for (const c of WSUMMARY) if (pl.startsWith(c + " ") || pl.startsWith(c + ",")) violations.push({ type: "summary_cliche", detail: `абзац починається з «${c}»` });
  }
  const start = low.replace(/^\s+/, "").slice(0, 45);
  for (const g of WGREETING) if (start.includes(g)) violations.push({ type: "greeting_start", detail: `привітання на старті «${g}»` });
  return violations;
}
