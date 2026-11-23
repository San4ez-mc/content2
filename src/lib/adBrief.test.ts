import { describe, it, expect } from "vitest";
import { AD_BRIEF_CATEGORY, AD_PAIN_CATEGORY, AD_BRIEF_SECTIONS, briefReadiness, parsePain, parsePains, pickPains, painForFunnel, briefText, type BriefEntry, type Pain } from "./adBrief";
import { scanAd } from "./adRules";

const section = (title: string, content = "Достатньо довгий текст розділу, щоб пройти перевірку мінімальної довжини.") => ({ category: AD_BRIEF_CATEGORY, title, content, isActive: true } as BriefEntry);
const pain = (id: string, extra: Record<string, unknown> = {}) => ({
  category: AD_PAIN_CATEGORY, title: id, isActive: true,
  content: JSON.stringify({ id, title: "Біль " + id, scene: "Кінець місяця, менеджер копіює дані з таблиці в шаблон.", hooks: ["Акт: 20 хвилин → 30 секунд"], evidence: "hypothesis", ...extra }),
} as BriefEntry);
const fullBrief = () => AD_BRIEF_SECTIONS.map((s) => section(s.title));
const fivePains = () => ["P01", "P02", "P03", "P04", "P05"].map((id) => pain(id));

describe("briefReadiness", () => {
  it("порожня база: не готово, названо всі розділи й банк болів з питаннями", () => {
    const r = briefReadiness([]);
    expect(r.ready).toBe(false);
    expect(r.missing.length).toBe(AD_BRIEF_SECTIONS.length + 1);
    expect(r.missing.every((m) => m.questions.length > 0)).toBe(true);
    expect(r.missing.map((m) => m.key)).toContain("pains");
  });
  it("повний бриф і 5 болів: готово", () => {
    const r = briefReadiness([...fullBrief(), ...fivePains()]);
    expect(r.ready).toBe(true);
    expect(r.painCount).toBe(5);
  });
  it("надто короткий розділ вважається порожнім", () => {
    const entries = [...fullBrief().filter((e) => e.title !== "Бриф: хто наш клієнт"), section("Бриф: хто наш клієнт", "так"), ...fivePains()];
    const r = briefReadiness(entries);
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.key)).toEqual(["icp"]);
  });
  it("неактивний розділ і битий біль не рахуються", () => {
    const entries = [...fullBrief().map((e) => (e.title === "Бриф: тон, мова, межі" ? { ...e, isActive: false } : e)), ...fivePains().slice(0, 4), { category: AD_PAIN_CATEGORY, title: "bad", content: "не json", isActive: true }];
    const r = briefReadiness(entries);
    expect(r.missing.map((m) => m.key).sort()).toEqual(["pains", "tone"]);
  });
});

describe("parsePain", () => {
  it("без сцени або заголовків це не біль", () => {
    expect(parsePain(pain("X", { scene: "" }))).toBeNull();
    expect(parsePain(pain("X", { hooks: [] }))).toBeNull();
  });
  it("evidence за замовчуванням hypothesis, case лише якщо вказано явно", () => {
    expect(parsePain(pain("X"))!.evidence).toBe("hypothesis");
    expect(parsePain(pain("X", { evidence: "case", proof: "30 секунд замість 20 хвилин" }))!.evidence).toBe("case");
  });
  it("чужа категорія ігнорується", () => {
    expect(parsePains([{ ...pain("X"), category: "rule" }])).toHaveLength(0);
  });
});

describe("pickPains", () => {
  const bank = ["A", "B", "C", "D", "E"].map((id, i) => ({ id, title: id, segment: "", scene: "s", hooks: ["h"], evidence: "hypothesis", angle: i < 3 ? "pain" : "outcome" } as Pain));
  it("найменш використані спершу, порядок банку зберігається", () => {
    const r = pickPains(bank, [{ pain: "A" }, { pain: "A" }, { pain: "B" }], 5);
    expect(r).toHaveLength(5);
    expect(r[0].id).not.toBe("A");
    expect(r[r.length - 1].id).toBe("A");
  });
  it("не більше 2 однакових кутів поспіль, поки є інші", () => {
    const r = pickPains(bank, [], 4);
    const pains = r.filter((p) => p.angle === "pain").length;
    expect(pains).toBeLessThanOrEqual(2);
  });
  it("count більший за банк віддає весь банк", () => {
    expect(pickPains(bank, [], 99)).toHaveLength(5);
  });
});

describe("painForFunnel / briefText", () => {
  it("для гіпотези proof порожній, для кейсу повний; hook ротується", () => {
    const p = parsePain(pain("P", { hooks: ["a", "b"], evidence: "case", proof: "дозволено так" }))!;
    expect(painForFunnel(p, 0).hook).toBe("a");
    expect(painForFunnel(p, 1).hook).toBe("b");
    expect(painForFunnel(p).proof).toBe("дозволено так");
    expect(painForFunnel({ ...p, evidence: "hypothesis" }).proof).toBe("");
  });
  it("текст брифу містить розділи за порядком", () => {
    const t = briefText(fullBrief());
    expect(t.startsWith("РЕКЛАМНИЙ БРИФ")).toBe(true);
    expect(t.indexOf("ХТО НАШ КЛІЄНТ")).toBeLessThan(t.indexOf("ТОН, МОВА, МЕЖІ"));
    expect(briefText([])).toBe("");
  });
});

describe("scanAd: «зачіпає?»", () => {
  const base = { primary: "Один акт у документах займає 20 хвилин.\n\nПокажу, як це робиться за 30 секунд.", headline: "Акт за 30 секунд", cta: "Записатися" };
  it("абстрактний заголовок без числа ловиться", () => {
    const v = scanAd({ ...base, overlayTitle: "Рутина з'їдає час команди" });
    expect(v.some((x) => x.type === "weak_hook")).toBe(true);
  });
  it("той самий заголовок із числом проходить", () => {
    const v = scanAd({ ...base, overlayTitle: "Рутина: 40 годин на місяць у менеджера" });
    expect(v.some((x) => x.type === "weak_hook")).toBe(false);
  });
  it("конкретна ситуація без абстракцій проходить", () => {
    const v = scanAd({ ...base, overlayTitle: "Менеджер захворів, а заявки в його чатах" });
    expect(v.some((x) => x.type === "weak_hook")).toBe(false);
  });
  it("загальна плашка «для власників і керівників бізнесу» ловиться, конкретна ні", () => {
    expect(scanAd({ ...base, audience: "Для власників і керівників бізнесу" }).some((x) => x.type === "weak_audience")).toBe(true);
    expect(scanAd({ ...base, audience: "Для команд від 7 людей" }).some((x) => x.type === "weak_audience")).toBe(false);
  });
});
