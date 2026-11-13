import type { PeriodLocation, UkNation } from "@/types/location";

export type CoverageArea = { nation: UkNation; adminArea: string; locations: number; withNamedBrand: number };

export function summariseCoverage(locations: PeriodLocation[]) {
  const areas = new Map<string, CoverageArea>();
  let withNamedBrand = 0;
  let withSpecificProductType = 0;

  for (const location of locations) {
    const namedBrand = location.products.some((product) => product.brand);
    const specificType = location.products.some((product) => product.type !== "Product type not specified");
    if (namedBrand) withNamedBrand += 1;
    if (specificType) withSpecificProductType += 1;
    const key = `${location.nation}:${location.adminArea}`;
    const current = areas.get(key) || { nation: location.nation, adminArea: location.adminArea, locations: 0, withNamedBrand: 0 };
    current.locations += 1;
    current.withNamedBrand += namedBrand ? 1 : 0;
    areas.set(key, current);
  }

  return {
    total: locations.length,
    coveredNations: new Set(locations.map((location) => location.nation)).size,
    coverageAreas: areas.size,
    withNamedBrand,
    withSpecificProductType,
    areas: [...areas.values()].sort((a, b) => b.locations - a.locations || a.adminArea.localeCompare(b.adminArea)),
  };
}
