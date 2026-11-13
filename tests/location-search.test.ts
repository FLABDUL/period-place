import { describe, expect, it } from "vitest";
import { locations } from "@/data/locations";
import { getLocationFacets, searchLocations } from "@/lib/location-search";
describe("fictional demo search", () => {
  it("finds venues by name and combines product constraints", () => {
    expect(searchLocations(locations, { query: "Riverside" }).items.map(v => v.slug)).toEqual(["demo-riverside"]);
    expect(searchLocations(locations, { query: "Riverside", types: ["Reusable pads"] }).totalMatches).toBe(0);
  });
  it("only exposes products with supporting sample records", () => {
    expect(getLocationFacets(locations).types).toContain("Pads");
    expect(getLocationFacets(locations).types).not.toContain("Menstrual discs");
    expect(searchLocations(locations, { types: ["Reusable pads"] }).items.map(v => v.slug)).toEqual(["demo-meadow"]);
  });
});
