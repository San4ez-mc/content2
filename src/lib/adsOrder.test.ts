import { describe, it, expect } from "vitest";
import { isAdsOrder, planAdsOrder } from "./adsOrder";

const ORDER = `Зроби 7 рекламних креативів для Facebook/Instagram, картинка 4:5, мережа «Реклама FB/IG» (meta_ads), формат ad_image.
Не став їх у чергу публікації.
Карта автоматизації · A1 · фото
Карта автоматизації · A2 · фото
Карта автоматизації · MAP · фото`;

describe("замовлення реклами", () => {
  it("розпізнає рекламне замовлення за текстом і за явним kind", () => {
    expect(isAdsOrder({ text: ORDER })).toBe(true);
    expect(isAdsOrder({ text: "напиши 2 пости про делегування" })).toBe(false);
    expect(isAdsOrder({ text: "зроби пост у Instagram про CRM" })).toBe(false);
    expect(isAdsOrder({ text: "x", kind: "creatives" })).toBe(true);
    expect(isAdsOrder({ text: "x", funnel: "ads-creative-video" })).toBe(true);
  });
  it("кількість і аспект беруться із замовлення; «фото» веде у воронку з фото автора", () => {
    const p = planAdsOrder({ text: ORDER, projectId: "P1" }, "2026-11-23")!;
    expect(p.funnel).toBe("ads-creative-photo");
    expect(p.params.count).toBe(7);
    expect(p.params.aspects).toEqual(["4:5"]);
    expect(p.params.projectId).toBe("P1");
    expect(p.params.date).toBe("2026-11-23");
    expect(String(p.params.note)).toContain("MAP");
    expect(p.needsPhotos).toBe(true);
  });
  it("без «фото» це воронка з намальованою картинкою, аспекти за замовчуванням 4:5 і 9:16", () => {
    const p = planAdsOrder({ text: "зроби 3 рекламних креативи", projectId: "P" }, "2026-11-23")!;
    expect(p.funnel).toBe("ads-creative-image");
    expect(p.params.count).toBe(3);
    expect(p.params.aspects).toEqual(["4:5", "9:16"]);
  });
  it("явні поля мають пріоритет, кількість обмежена, відео не більше 5", () => {
    const p = planAdsOrder({ text: "реклама FB/IG", projectId: "P", count: 50, aspects: ["1:1"], pains: [{ id: "A1" }], landingUrl: "https://example.com/x", date: "2026-12-01" }, "2026-11-23")!;
    expect(p.params.count).toBe(8);
    expect(p.params.aspects).toEqual(["1:1"]);
    expect(p.params.pains).toEqual([{ id: "A1" }]);
    expect(p.params.landingUrl).toBe("https://example.com/x");
    expect(p.params.date).toBe("2026-12-01");
    const v = planAdsOrder({ text: "зроби 9 відео-креативів ad_video", projectId: "P" }, "2026-11-23")!;
    expect(v.funnel).toBe("ads-creative-video");
    expect(v.params.count).toBe(5);
    expect(v.params.aspects).toBeUndefined();
  });
  it("посилання на фото приймаються лише https", () => {
    const p = planAdsOrder({ text: "креативи реклама FB/IG", projectId: "P", photoUrls: ["https://a/1.jpg", "http://x/2.jpg", "javascript:1"] }, "d")!;
    expect(p.funnel).toBe("ads-creative-photo");
    expect(p.params.photoUrls).toEqual(["https://a/1.jpg"]);
    expect(p.needsPhotos).toBe(false);
  });
  it("не рекламне замовлення дає null", () => {
    expect(planAdsOrder({ text: "розкажи про стратегію", projectId: "P" }, "d")).toBeNull();
  });
});
