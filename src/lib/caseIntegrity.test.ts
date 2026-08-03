import { describe, it, expect } from "vitest";
import { resolveCaseIntegrity } from "./caseIntegrity";

const cases = [
  { id: "c1", title: "Паливна компанія: таблиця залишків" },
  { id: "c2", title: "AI-бот для Threads (консультація)" },
];

describe("resolveCaseIntegrity (C2 case integrity)", () => {
  it("реальний кейс за точною назвою → case + caseId", () => {
    expect(resolveCaseIntegrity(cases, "case", "Паливна компанія: таблиця залишків"))
      .toEqual({ evidenceType: "case", caseId: "c1" });
  });

  it("ВИГАДАНИЙ кейс → downgrade у story, без caseId (не видаємо за реальний)", () => {
    expect(resolveCaseIntegrity(cases, "case", "Я втратив 40 тисяч на будівельній бригаді"))
      .toEqual({ evidenceType: "story", caseId: null });
  });

  it("нормалізація прибирає хвостові дужки", () => {
    expect(resolveCaseIntegrity(cases, "case", "AI-бот для Threads"))
      .toEqual({ evidenceType: "case", caseId: "c2" });
  });

  it("evidence != case не чіпаємо", () => {
    expect(resolveCaseIntegrity(cases, "story", "будь-що"))
      .toEqual({ evidenceType: "story", caseId: null });
  });

  it("case без назви → story (нема чим підтвердити)", () => {
    expect(resolveCaseIntegrity(cases, "case", ""))
      .toEqual({ evidenceType: "story", caseId: null });
  });
});
