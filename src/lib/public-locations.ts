import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listPublishedLocations } from "@/lib/db";

const cachedPublicLocations = unstable_cache(listPublishedLocations, ["public-locations", process.env.PERIOD_PLACE_ENVIRONMENT || process.env.VERCEL_ENV || "development", process.env.VERCEL_GIT_COMMIT_SHA || "local"], { tags: ["public-locations"], revalidate: 60 });
const loadPublicLocations = () => process.env.PERIOD_PLACE_ENVIRONMENT === "test" ? listPublishedLocations() : cachedPublicLocations();

export const getPublicLocations = cache(loadPublicLocations);

export const getPublicLocation = cache(async (slug: string) => {
  return (await loadPublicLocations()).find((location) => location.slug === slug);
});
