import { describe, it, expect } from "vitest";
import { resolvePlatformKey, networkKeyCandidates, pickNetwork } from "./platformKeys";

const nets = (...keys: string[]) => keys.map((platformKey) => ({ platformKey }));

describe("platformKeys", () => {
  it("youtube/shorts/tiktok_video мапляться на свої мережі", () => {
    expect(resolvePlatformKey("shorts")).toBe("youtube");
    expect(resolvePlatformKey("youtube_short")).toBe("youtube");
    expect(resolvePlatformKey("tiktok_video")).toBe("tiktok");
    expect(resolvePlatformKey("TikTok")).toBe("tiktok");
  });
  it("порожнє → instagram_posts (як і раніше)", () => {
    expect(resolvePlatformKey("")).toBe("instagram_posts");
    expect(resolvePlatformKey(undefined)).toBe("instagram_posts");
  });
  it("консолідована мережа instagram знаходиться за reels і за posts", () => {
    const n = nets("threads", "instagram", "tiktok");
    expect(pickNetwork(n, "reels")?.platformKey).toBe("instagram");
    expect(pickNetwork(n, "instagram")?.platformKey).toBe("instagram");
    expect(pickNetwork(n, "stories")?.platformKey).toBe("instagram");
  });
  it("старий стиль (окремі instagram_reels) має пріоритет над консолідованим", () => {
    const n = nets("instagram", "instagram_reels");
    expect(pickNetwork(n, "reels")?.platformKey).toBe("instagram_reels");
  });
  it("відсутня мережа → undefined, а не перша-ліпша", () => {
    expect(pickNetwork(nets("threads", "instagram"), "youtube")).toBeUndefined();
    expect(pickNetwork(nets("threads"), "tiktok")).toBeUndefined();
  });
  it("кандидати без дублікатів", () => {
    expect(networkKeyCandidates("threads")).toEqual(["threads"]);
    expect(networkKeyCandidates("reels")).toEqual(["instagram_reels", "instagram", "reels"]);
  });
});
