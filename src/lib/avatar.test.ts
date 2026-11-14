import { describe, it, expect } from "vitest";
import { KIRA_DEFAULT, composePhotoPrompt, pickRefs, avatarBrief, mentionsPhone, PHONE_RULE, type RefPhoto } from "./avatar";

const photo = (id: string, ...tags: string[]): RefPhoto => ({ id, url: `https://x/${id}.jpg`, tags: ["ref", ...tags] });

describe("avatar", () => {
  it("промпт нового фото тримає якір і колір стрічки за рубрикою", () => {
    const p = composePhotoPrompt(KIRA_DEFAULT, { scene: "rooftop at night, string lights", topic: "party", aspect: "9:16" });
    expect(p).toContain("neon violet front lock");
    expect(p).toContain("Flyer ribbon colour: pink");
    expect(p).toContain("Vertical 9:16");
    expect(p).toContain("No paper ticket");
  });

  it("явна стрічка важливіша за рубрику, без нічого — violet", () => {
    expect(composePhotoPrompt(KIRA_DEFAULT, { scene: "x", ribbon: "teal", topic: "party" })).toContain("ribbon colour: teal");
    expect(composePhotoPrompt(KIRA_DEFAULT, { scene: "x" })).toContain("ribbon colour: violet");
  });

  it("власний одяг замінює фірмовий, але пояс і шнурки лишаються в тексті", () => {
    const p = composePhotoPrompt(KIRA_DEFAULT, { scene: "park", outfit: "neon-pink windbreaker and black leggings" });
    expect(p).toContain("neon-pink windbreaker");
    expect(p).toContain("white belt with the flyer");
    expect(p).not.toContain("glossy hot-pink bomber");
  });

  it("референси: основне першим, потім найближчий кадр і повний зріст, без дублів і не більше max", () => {
    const pool = [photo("a", "shot:portrait"), photo("b", "shot:laugh"), photo("c", "shot:fullbody"), photo("d", "shot:profile")];
    const r = pickRefs(pool, ["d"], "laugh", 3).map((p) => p.id);
    expect(r).toEqual(["d", "b", "c"]);
    expect(pickRefs(pool, [], undefined, 2).map((p) => p.id)).toEqual(["a", "c"]);
    expect(pickRefs([], [], "laugh")).toEqual([]);
  });

  it("бриф містить голос і правила й обмежений за довжиною", () => {
    const b = avatarBrief(KIRA_DEFAULT);
    expect(b).toContain("ГОЛОС І ХАРАКТЕР");
    expect(b).toContain("ПРАВИЛА ВІДЕО");
    expect(b.length).toBeLessThan(12000);
  });

  it("правило телефона додається лише коли в сцені є телефон", () => {
    expect(composePhotoPrompt(KIRA_DEFAULT, { scene: "she looks at her smartphone screen, smiling" })).toContain(PHONE_RULE);
    expect(composePhotoPrompt(KIRA_DEFAULT, { scene: "laughing in a park with a coffee" })).not.toContain("PHONE RULE");
    expect(mentionsPhone("свайпає по екрану телефона")).toBe(true);
    expect(KIRA_DEFAULT.photoRules).toContain("Телефон:");
    expect(KIRA_DEFAULT.videoRules).toContain("Телефон у відео");
  });
});
