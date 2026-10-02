import { describe, it, expect } from "vitest";
import { factStatus, factsPromptBlock, parseDay, fmtDay, dayBefore, todayKyiv, sameTopic, splitMarkers, findStaleMarkers } from "./facts";

const base = { title: "T", content: "C", isActive: true };

describe("factStatus", () => {
  it("діючий без дат — active", () => expect(factStatus({ ...base }, "2026-10-02")).toBe("active"));
  it("validUntil вчора — outdated, сьогодні — ще active", () => {
    expect(factStatus({ ...base, validUntil: "2026-10-01" }, "2026-10-02")).toBe("outdated");
    expect(factStatus({ ...base, validUntil: "2026-10-02" }, "2026-10-02")).toBe("active");
  });
  it("validFrom у майбутньому — scheduled, сьогодні — active", () => {
    expect(factStatus({ ...base, validFrom: "2026-10-03" }, "2026-10-02")).toBe("scheduled");
    expect(factStatus({ ...base, validFrom: "2026-10-02" }, "2026-10-02")).toBe("active");
  });
  it("superseded або вимкнений — outdated", () => {
    expect(factStatus({ ...base, supersededAt: new Date() }, "2026-10-02")).toBe("outdated");
    expect(factStatus({ ...base, isActive: false }, "2026-10-02")).toBe("outdated");
  });
  it("приймає Date з бази", () => {
    expect(factStatus({ ...base, validUntil: new Date("2026-10-01T00:00:00Z") }, "2026-10-02")).toBe("outdated");
  });
});

describe("дати", () => {
  it("parseDay: ISO та DD.MM.YY", () => {
    expect(parseDay("2026-10-02")).toBe("2026-10-02");
    expect(parseDay("02.10.26")).toBe("2026-10-02");
    expect(parseDay("2.10.2026")).toBe("2026-10-02");
    expect(parseDay("вчора")).toBeNull();
    expect(parseDay("")).toBeNull();
  });
  it("fmtDay → DD.MM.YY", () => expect(fmtDay("2026-10-02")).toBe("02.10.26"));
  it("dayBefore переходить через місяць/рік", () => {
    expect(dayBefore("2026-10-01")).toBe("2026-09-30");
    expect(dayBefore("2026-01-01")).toBe("2025-12-31");
  });
  it("todayKyiv: 21:30 UTC 1 жовтня вже 2 жовтня в Києві", () => {
    expect(todayKyiv(new Date("2026-10-01T21:30:00Z"))).toBe("2026-10-02");
    expect(todayKyiv(new Date("2026-10-01T10:00:00Z"))).toBe("2026-10-01");
  });
});

describe("теми та маркери", () => {
  it("sameTopic ігнорує регістр/пробіли, порожні теми не збігаються", () => {
    expect(sameTopic(" Тестування ", "тестування")).toBe(true);
    expect(sameTopic("", "")).toBe(false);
    expect(sameTopic(null, "x")).toBe(false);
  });
  it("splitMarkers + findStaleMarkers", () => {
    const m = splitMarkers("15 тестувальників; ще не можна завантажити\nxx");
    expect(m).toEqual(["15 тестувальників", "ще не можна завантажити"]);
    expect(findStaleMarkers("Потрібно 15 ТЕСТУВАЛЬНИКІВ у Play", m)).toEqual(["15 тестувальників"]);
    expect(findStaleMarkers("Нас уже 10", m)).toEqual([]);
  });
});

describe("factsPromptBlock", () => {
  it("містить лише актуальні та анонси, без застарілих", () => {
    const block = factsPromptBlock([
      { ...base, title: "Старий", content: "потрібно 15 тестувальників", supersededAt: new Date() },
      { ...base, title: "Новий", content: "вже 10 тестувальників" },
      { ...base, title: "iOS", content: "вийде при 100 користувачах", validFrom: "2026-12-01" },
    ], "2026-10-02");
    expect(block).toContain("вже 10 тестувальників");
    expect(block).toContain("02.10.26");
    expect(block).toContain("ЗАПЛАНОВАНО");
    expect(block).not.toContain("15 тестувальників");
  });
});
