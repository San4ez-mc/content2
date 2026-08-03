// C2 case integrity — чиста логіка: заявлений «кейс» приймаємо лише якщо він збігається
// з реальним записом Case (за нормалізованою назвою), інакше downgrade у story.
// Винесено окремо, щоб покрити тестами й перевикористати у createPost та bulk-import.

export const normCase = (s: string) =>
  String(s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*\([^)]*\)\s*$/, "").trim();

export type CaseRef = { id: string; title: string };

// Повертає підтверджений evidenceType + caseId. Якщо evidence=case, але реального кейса
// з такою назвою нема — знижуємо у story (вигадку не видаємо за реальний кейс).
export function resolveCaseIntegrity(
  cases: CaseRef[],
  evidenceType: string | null,
  caseTitle: unknown,
): { evidenceType: string | null; caseId: string | null } {
  if (evidenceType !== "case") return { evidenceType, caseId: null };
  const t = normCase(String(caseTitle || ""));
  if (t) {
    const hit = cases.find((c) => normCase(c.title) === t);
    if (hit) return { evidenceType: "case", caseId: hit.id };
  }
  return { evidenceType: "story", caseId: null };
}
