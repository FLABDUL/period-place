import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeUkPostcode, normaliseUkPostcode } from "@/lib/postcode-search";

afterEach(() => vi.unstubAllGlobals());

describe("postcode proximity search", () => {
  it("normalises complete UK postcodes but ignores ordinary text searches", () => {
    expect(normaliseUkPostcode("g4 9lj")).toBe("G4 9LJ");
    expect(normaliseUkPostcode("G49LJ")).toBe("G4 9LJ");
    expect(normaliseUkPostcode("Glasgow")).toBeNull();
  });

  it("returns coordinates from a successful lookup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { latitude: 55.868191, longitude: -4.262898 } }), { status: 200 })));
    await expect(geocodeUkPostcode("G4 9LJ")).resolves.toEqual({ postcode: "G4 9LJ", latitude: 55.868191, longitude: -4.262898 });
  });

  it("fails safely when postcode lookup is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(geocodeUkPostcode("G4 9LJ")).resolves.toBeNull();
  });
});
