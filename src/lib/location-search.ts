import type { Absorbency, AvailabilityStatus, PeriodLocation } from "@/types/location";

export const finderPageSize = 30;
export type LocationMapItem = Pick<PeriodLocation, "slug" | "name" | "city" | "nation" | "latitude" | "longitude">;
export type LocationFacets = { brands: string[]; types: string[]; attributes: string[]; absorbencies: Absorbency[]; availability: AvailabilityStatus[] };
export type LocationSearchFilters = { query?: string; types?: string[]; brands?: string[]; attributes?: string[]; absorbencies?: Absorbency[]; availability?: AvailabilityStatus[]; latitude?: number; longitude?: number; radiusKm?: number; limit?: number };
export type LocationSearchResult = { items: PeriodLocation[]; mapItems: LocationMapItem[]; totalMatches: number; totalLocations: number; hasMore: boolean; proximityLabel?: string };

const unknownBrand = "Brand not confirmed";

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function getLocationFacets(locations: PeriodLocation[]): LocationFacets {
  const products = locations.flatMap((location) => location.products);
  return {
    brands: [...new Set(products.map((product) => product.brand || unknownBrand))].sort(),
    types: [...new Set(products.map((product) => product.type))].sort(),
    attributes: [...new Set(products.flatMap((product) => product.attributes))].sort(),
    absorbencies: [...new Set(products.flatMap((product) => product.absorbencies || []))].sort(),
    availability: [...new Set(locations.flatMap((location) => location.communityVerification?.latestAvailability || []))],
  };
}

export function searchLocations(locations: PeriodLocation[], filters: LocationSearchFilters = {}): LocationSearchResult {
  const term = filters.query?.trim().toLowerCase() || "";
  const types = filters.types || [];
  const brands = filters.brands || [];
  const attributes = filters.attributes || [];
  const absorbencies = filters.absorbencies || [];
  const availability = filters.availability || [];
  const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : finderPageSize;
  const limit = Math.min(1_000, Math.max(finderPageSize, requestedLimit));
  const hasPosition = Number.isFinite(filters.latitude) && Number.isFinite(filters.longitude);
  const position = hasPosition ? { latitude: Number(filters.latitude), longitude: Number(filters.longitude) } : null;
  const matches = locations.filter((location) => {
    const products = location.products;
    const searchable = `${location.name} ${location.city} ${location.nation} ${location.adminArea} ${location.postcode} ${location.address} ${products.map((product) => `${product.type} ${product.brand || ""} ${product.attributes.join(" ")} ${(product.absorbencies || []).join(" ")}`).join(" ")}`.toLowerCase();
    return (!term || searchable.includes(term))
      && (!types.length || types.some((type) => products.some((product) => product.type === type)))
      && (!brands.length || brands.some((brand) => products.some((product) => (product.brand || unknownBrand) === brand)))
      && (!attributes.length || attributes.every((attribute) => products.some((product) => product.attributes.includes(attribute))))
      && (!absorbencies.length || absorbencies.some((absorbency) => products.some((product) => product.absorbencies?.includes(absorbency))))
      && (!availability.length || (location.communityVerification?.latestAvailability ? availability.includes(location.communityVerification.latestAvailability) : false))
      && (!position || !filters.radiusKm || distanceKm(position, location) <= filters.radiusKm);
  });
  if (position) {
    matches.sort((a, b) => distanceKm(position, a) - distanceKm(position, b));
  }
  return {
    items: matches.slice(0, limit),
    mapItems: matches.map(({ slug, name, city, nation, latitude, longitude }) => ({ slug, name, city, nation, latitude, longitude })),
    totalMatches: matches.length,
    totalLocations: locations.length,
    hasMore: matches.length > limit,
  };
}
