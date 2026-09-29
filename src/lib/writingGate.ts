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
    // Списки (буліт «— пункт» ЧИ нумерований «1. Назва — опис») законно несуть одне
    // тире-роздільник на кожен рядок — це не стилістичне зловживання тире в реченні
    // (те, що правило й мало ловити), а структура списку. Без цього звичайний список
    // із 2-5 пунктів відхилявся як «забагато тире», хоча жодного em-dash overuse в
    // прозі немає (виявлено 2026-09-30 на реальних постах KIRO — гейт мовчки ховав у
    // чернетки цілком якісні пости). Другий/зайвий дефіс У ТОМУ Ж рядку списку —
    // і будь-яке накопичення тире у звичайному абзаці — досі ловиться.
    const lines = p.split("\n");
    const isListy = lines.filter((l) => /^\s*(—|[0-9]+[.)]|[-*•])\s/.test(l)).length >= 2;
    let dashes;
    if (isListy) {
      dashes = lines.reduce((sum, l) => {
        const lineDashes = (l.match(/—/g) || []).length;
        const isListLine = /^\s*(—|[0-9]+[.)]|[-*•])\s/.test(l);
        return sum + (isListLine ? Math.max(0, lineDashes - 1) : lineDashes);
      }, 0);
    } else {
      dashes = (p.match(/—/g) || []).length;
    }
    if (dashes > 1) violations.push({ type: "dash_overuse", detail: `${dashes} тире в одному абзаці (макс 1)` });
    const pl = p.toLowerCase();
    for (const c of WSUMMARY) if (pl.startsWith(c + " ") || pl.startsWith(c + ",")) violations.push({ type: "summary_cliche", detail: `абзац починається з «${c}»` });
  }
  const start = low.replace(/^\s+/, "").slice(0, 45);
  for (const g of WGREETING) if (start.includes(g)) violations.push({ type: "greeting_start", detail: `привітання на старті «${g}»` });
  return violations;
}
