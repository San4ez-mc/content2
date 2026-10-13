import { describe, it, expect } from "vitest";
import { kyivOffsetMinutes } from "./utils";

describe("kyivOffsetMinutes (літній/зимовий час)", () => {
  it("влітку UTC+3", () => {
    expect(kyivOffsetMinutes(new Date("2026-10-24T12:00:00Z"))).toBe(180);
    expect(kyivOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(180);
  });
  it("взимку UTC+2 (після переходу 25.10.2026)", () => {
    expect(kyivOffsetMinutes(new Date("2026-10-26T12:00:00Z"))).toBe(120);
    expect(kyivOffsetMinutes(new Date("2026-12-15T12:00:00Z"))).toBe(120);
  });
});
