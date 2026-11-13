import type { SourcePack, SourcePackStatus } from "@/lib/source-pack-schema";
import type { PeriodLocation } from "@/types/location";
// Historical council datasets are excluded from the public source edition.
export const sourcePacks: SourcePack[] = [];
export function packsForEnvironment(environment: string | undefined, packs: SourcePack[] = sourcePacks) {
  const allowed = (status: SourcePackStatus) => status === "cleared" || (environment !== "production" && status === "preview-only");
  return packs.filter(pack => allowed(pack.productionStatus));
}
export const activeSourcePacks = packsForEnvironment(process.env.PERIOD_PLACE_ENVIRONMENT || process.env.VERCEL_ENV);
export const activeSourcePackIds: ReadonlySet<string> = new Set(activeSourcePacks.map(pack => pack.id));
export const importedLocations: PeriodLocation[] = [];
export const retiredOfficialSlugs: string[] = [];
