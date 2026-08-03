import { describe, it, expect } from "vitest";
import { scanWriting } from "./writingGate";

describe("scanWriting (C3 grep-gate)", () => {
  it("ловить стоп-слова, щільність тире й привітання", () => {
    const bad = "Друзі, сьогодні поговоримо. Таким чином, це — важливо — і корисно — тут. Безумовно, у сучасному світі кожен з нас це знає.";
    const v = scanWriting(bad);
    const types = new Set(v.map((x) => x.type));
    expect(v.length).toBeGreaterThan(0);
    expect(types.has("banned_word")).toBe(true);
    expect(types.has("dash_overuse")).toBe(true);
    expect(types.has("greeting_start")).toBe(true);
  });

  it("пропускає чистий людський текст (0 порушень)", () => {
    const good = "Заявка прийшла о 14:38.\n\nВласник дізнався о 19:00. Клієнт уже купив в іншого.";
    expect(scanWriting(good)).toEqual([]);
  });

  it("одне тире в абзаці — ок, два — порушення", () => {
    expect(scanWriting("Це нормально — одне тире на абзац.")).toEqual([]);
    expect(scanWriting("Це — забагато — тире в абзаці.").some((x) => x.type === "dash_overuse")).toBe(true);
  });
});
