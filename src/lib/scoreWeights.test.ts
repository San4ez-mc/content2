import { describe, it, expect } from "vitest";
import { computeScore, buildScores } from "./scoreWeights";

describe("computeScore (E2 скоринг)", () => {
  it("зважує реакції правильно", () => {
    // 10 лайків*1 + 3 коменти*2 + 2 збереження*3 + 1 продаж*10 = 10+6+6+10 = 32
    expect(computeScore({ likes: 10, comments: 3, saves: 2, sales: 1 })).toBe(32);
  });
  it("порожні реакції → 0", () => {
    expect(computeScore({})).toBe(0);
  });
  it("buildScores містить усі ключі + total", () => {
    const s = buildScores({ likes: 5, sales: 2 });
    expect(s.total).toBe(25); // 5*1 + 2*10
    expect(s.likes).toBe(5);
    expect(s.comments).toBe(0);
  });
});
