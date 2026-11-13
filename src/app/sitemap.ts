import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-metadata";

const publicRoutes = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/find", changeFrequency: "weekly", priority: 0.9 },
  { path: "/coverage", changeFrequency: "weekly", priority: 0.8 },
  { path: "/contribute", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/support", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/feedback", changeFrequency: "yearly", priority: 0.4 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ path, ...entry }) => ({ url: `${siteUrl}${path}`, ...entry }));
}
