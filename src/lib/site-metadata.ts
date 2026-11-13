import type { Metadata } from "next";

export const siteName = "Period Place";
export const siteUrl = "https://periodplace.org";
export const siteDescription = "Find free period products by type, brand, materials and recent community evidence across the UK.";

const socialImage = {
  url: "/period-place-share-card.png",
  width: 1200,
  height: 630,
  alt: "Period Place — find free period products near you",
};

export function createPageMetadata({ title, description = siteDescription, path }: { title: string; description?: string; path: string }): Metadata {
  const socialTitle = title === siteName ? siteName : `${title} · ${siteName}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName,
      title: socialTitle,
      description,
      url: path,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage],
    },
  };
}
