export type Confidence = "venue-confirmed" | "scheme-confirmed" | "community-reported";

export const productTypes = [
  "Pads",
  "Pantyliners",
  "Tampons",
  "Period pants",
  "Reusable pads",
  "Menstrual cups",
  "Menstrual discs",
  "Product type not specified",
  "Other / specialist",
] as const;

export const productAttributes = [
  "Disposable",
  "Reusable",
  "Organic cotton",
  "Plant-based",
  "Plastic-free product",
  "Plastic-free packaging",
  "Fragrance-free",
  "Vegan",
  "Latex-free",
  "Applicator",
  "Non-applicator",
] as const;

export const absorbencies = ["Light", "Regular", "Heavy", "Night / extra-heavy"] as const;

export const ukNations = ["England", "Scotland", "Wales", "Northern Ireland"] as const;

export type ProductType = (typeof productTypes)[number];
export type ProductAttribute = (typeof productAttributes)[number];
export type Absorbency = (typeof absorbencies)[number];
export type UkNation = (typeof ukNations)[number];
export type AvailabilityStatus = "available" | "low_stock" | "out_of_stock" | "could_not_find" | "location_unavailable";

export type ProductOffering = {
  type: ProductType;
  brand: string | null;
  attributes: string[];
  absorbencies?: Absorbency[];
  evidence: string;
};

export type PublicCheckIn = {
  id: string;
  availability: AvailabilityStatus;
  observedAt: string;
  comment: string;
  createdAt: string;
};

export type CommunityVerification = {
  approvedCount: number;
  lastObservedAt: string | null;
  latestAvailability: AvailabilityStatus | null;
  availabilityCounts: Partial<Record<AvailabilityStatus, number>>;
  averageAccuracy: number | null;
  averageAccess: number | null;
  averagePrivacy: number | null;
  comments: PublicCheckIn[];
};

export type EvidenceSource = {
  label: string;
  url: string;
  checked: string;
  scope: string;
};

export type PeriodLocation = {
  slug: string;
  name: string;
  city: string;
  nation: UkNation;
  adminArea: string;
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  venueType: "Library" | "Community centre" | "Public venue" | "School or college" | "Health venue" | "Food bank" | "Workplace" | "Other";
  access: string;
  confidence: Confidence;
  products: ProductOffering[];
  sources: EvidenceSource[];
  lastVerifiedAt?: string;
  needsRecheck?: boolean;
  communityVerification?: CommunityVerification;
};
