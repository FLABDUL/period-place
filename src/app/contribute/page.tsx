import type { Metadata } from "next";
import { ContributionForm } from "@/components/contribution-form";
import { getPublicLocations } from "@/lib/public-locations";
import { createPageMetadata } from "@/lib/site-metadata";
export const metadata:Metadata=createPageMetadata({title:"Suggest a location",description:"Suggest a new free period product location, correction, stock update or closure for Period Place review.",path:"/contribute"});
export const dynamic="force-dynamic";
const reportKinds=["new_location","correction","stock_update","closure"] as const;
export default async function ContributePage({searchParams}:PageProps<"/contribute">){
  const params=await searchParams;
  const requestedKind=typeof params.kind==="string"?params.kind:"";
  const initialKind=reportKinds.find((kind)=>kind===requestedKind)||"new_location";
  const requestedLocation=typeof params.location==="string"?params.location:"";
  const locations=(await getPublicLocations()).map(({slug,name,city,nation,adminArea,postcode})=>({slug,name,city,nation,adminArea,postcode}));
  const initialTargetSlug=locations.some((location)=>location.slug===requestedLocation)?requestedLocation:"";
  return <div className="page-shell"><p className="eyebrow">Community evidence across the UK</p><h1>Tell us what you found.</h1><p>Add a new place anywhere in the UK, correct a listing, or tell us when its brands, stock or access have changed. Please report only what you saw.</p><ContributionForm locations={locations} initialKind={initialKind} initialTargetSlug={initialTargetSlug} /></div>
}
