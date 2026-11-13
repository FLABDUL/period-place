import { NextResponse, type NextRequest } from "next/server";
import { searchLocations } from "@/lib/location-search";
import { getPublicLocations } from "@/lib/public-locations";
import { geocodeUkPostcode } from "@/lib/postcode-search";
import { absorbencies, type Absorbency, type AvailabilityStatus } from "@/types/location";

const allowedAvailability = new Set<AvailabilityStatus>(["available", "low_stock", "out_of_stock", "could_not_find", "location_unavailable"]);
const allowedAbsorbencies = new Set<Absorbency>(absorbencies);
function finiteNumber(value: string | null) { const parsed = Number(value); return value && Number.isFinite(parsed) ? parsed : undefined; }

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locations = await getPublicLocations();
  const query = (params.get("q") || "").slice(0, 120);
  const postcode = await geocodeUkPostcode(query);
  const availability = params.getAll("availability").filter((value): value is AvailabilityStatus => allowedAvailability.has(value as AvailabilityStatus));
  const selectedAbsorbencies = params.getAll("absorbency").filter((value): value is Absorbency => allowedAbsorbencies.has(value as Absorbency));
  const result = searchLocations(locations, {
    query: postcode ? undefined : query, types: params.getAll("type"), brands: params.getAll("brand"), attributes: params.getAll("attribute"), absorbencies: selectedAbsorbencies, availability,
    latitude: postcode?.latitude ?? finiteNumber(params.get("lat")), longitude: postcode?.longitude ?? finiteNumber(params.get("lng")), radiusKm: postcode ? 25 : undefined, limit: finiteNumber(params.get("limit")),
  });
  if (postcode) result.proximityLabel = `Nearest verified locations within 25 km of ${postcode.postcode}.`;
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
