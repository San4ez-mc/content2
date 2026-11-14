import { describe, it, expect } from "vitest";
import { mapKiroEvent, eventsText, isKiroEventCard } from "./kiroEvents";

const ev = (o: any = {}) => ({
  id: "e1", title: "«Іздрик» — поетичний вечір", startsAt: "2026-11-20T16:30:00.000Z", slug: "izdryk-abc",
  city: { nameUk: "Київ" }, addressText: "Будинок кіно, вул. Саксаганського, 6, Київ", priceType: "PAID", price: "390", category: { nameUk: "Культура" }, ...o,
});

describe("kiroEvents", () => {
  it("дата й час за київським часом, ціна «від», посилання з utm і картка сторіз", () => {
    const e = mapKiroEvent(ev());
    expect(e.date).toBe("20.11");
    expect(e.time).toBe("18:30");
    expect(e.priceText).toBe("від 390 грн");
    expect(e.link).toBe("https://kiro.fineko.space/events/izdryk-abc?utm_source=instagram&utm_medium=story");
    expect(e.storyImage).toBe("https://kiro.fineko.space/api/v1/events/e1/share-image?variant=1");
    expect(e.place).toBe("Будинок кіно, вул. Саксаганського");
  });

  it("безкоштовна подія", () => {
    expect(mapKiroEvent(ev({ priceType: "FREE", price: null })).priceText).toBe("безкоштовно");
  });

  it("лише картка події KIRO дозволена як зовнішня картинка", () => {
    expect(isKiroEventCard("https://kiro.fineko.space/api/v1/events/e1/share-image?variant=1")).toBe(true);
    expect(isKiroEventCard("https://evil.example/api/v1/events/e1/share-image")).toBe(false);
    expect(isKiroEventCard("/uploads/media/x.png")).toBe(false);
  });

  it("текст для промпта: порожньо без подій, інакше рядок на подію з id, ціною й карткою", () => {
    expect(eventsText([])).toBe("");
    const t = eventsText([mapKiroEvent(ev())]);
    expect(t).toContain("[e1] 20.11 18:30 · Київ");
    expect(t).toContain("від 390 грн");
    expect(t).toContain("картка сторіз:");
  });
});
