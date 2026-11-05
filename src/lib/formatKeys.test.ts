import { describe, it, expect } from "vitest";
import { normalizeFormat, formatToPostGroupType } from "./formatKeys";

describe("normalizeFormat (єдиний словник форматів)", () => {
  it("зводить генераторні варіанти до канону", () => {
    expect(normalizeFormat("stories")).toBe("story");
    expect(normalizeFormat("reels")).toBe("reel");
    expect(normalizeFormat("thread_chain")).toBe("thread");
    expect(normalizeFormat("thread_short")).toBe("thread");
    expect(normalizeFormat("single")).toBe("post");
  });
  it("канонічні лишає як є", () => {
    for (const k of ["post", "story", "reel", "carousel", "thread", "short", "slideshow", "ad_image", "ad_story", "ad_carousel", "ad_video"]) {
      expect(normalizeFormat(k)).toBe(k);
    }
  });
  it("рекламні формати Meta не зводяться в post", () => {
    expect(normalizeFormat("ad_feed")).toBe("ad_image");
    expect(normalizeFormat("ad_reel")).toBe("ad_video");
  });
  it("невідоме/порожнє → post", () => {
    expect(normalizeFormat("xyz")).toBe("post");
    expect(normalizeFormat("")).toBe("post");
    expect(normalizeFormat(null)).toBe("post");
  });
});

describe("formatToPostGroupType (сумісність із legacy enum)", () => {
  it("мапить формат у enum", () => {
    expect(formatToPostGroupType("carousel")).toBe("carousel");
    expect(formatToPostGroupType("thread")).toBe("thread_chain");
    expect(formatToPostGroupType("reel")).toBe("stories");
    expect(formatToPostGroupType("post")).toBe("single");
    expect(formatToPostGroupType("ad_carousel")).toBe("carousel");
    expect(formatToPostGroupType("ad_image")).toBe("single");
    expect(formatToPostGroupType("ad_video")).toBe("stories");
  });
});
