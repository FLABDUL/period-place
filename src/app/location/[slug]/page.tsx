import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckInForm } from "@/components/check-in-form";
import { LocationOpenTracker } from "@/components/location-open-tracker";
import { getCommunityIdentity, usesClerkAuth } from "@/lib/auth";
import { getPublicLocation } from "@/lib/public-locations";
import { getConfidencePresentation } from "@/lib/evidence-presentation";
import { createPageMetadata } from "@/lib/site-metadata";
import type { AvailabilityStatus } from "@/types/location";

const availabilityLabels: Record<AvailabilityStatus,string> = {
  available: "Available and stocked",
  low_stock: "Running low",
  out_of_stock: "Reported empty",
  could_not_find: "Could not be found",
  location_unavailable: "Location unavailable",
};

function Rating({ label, value }: { label: string; value: number | null }) {
  return <p><strong>{value === null ? "—" : `${value}/5`}</strong><span>{label}</span></p>;
}

export async function generateMetadata({params}:PageProps<"/location/[slug]">):Promise<Metadata>{
  const {slug}=await params;
  const location=await getPublicLocation(slug);
  if(!location)return {title:"Location not found"};
  const productTypes=[...new Set(location.products.map((product)=>product.type))].join(", ");
  const description=`Find free ${productTypes.toLowerCase()} at ${location.name} in ${location.city}. Check brand, access and recent community evidence before travelling.`;
  return createPageMetadata({title:`${location.name} free period products`,description,path:`/location/${location.slug}`});
}

export default async function LocationPage({params}:PageProps<"/location/[slug]">){
  const {slug}=await params;
  const [location,identity]=await Promise.all([getPublicLocation(slug),getCommunityIdentity()]);
  if(!location)notFound();
  const community=location.communityVerification;
  const evidence=getConfidencePresentation(location.confidence);
  return <div className="page-shell">
    <LocationOpenTracker />
    <Link className="text-link" href="/find">← Back to finder</Link>
    <p className="eyebrow">{location.city}, {location.nation} · {evidence.shortLabel}</p>
    <h1>{location.name}</h1>
    <p>{evidence.explanation}</p>
    <p>{location.address}, {location.postcode}{location.adminArea?` · ${location.adminArea}`:""}</p>
    {location.lastVerifiedAt?<p className={location.needsRecheck?"action-message error":"action-message success"}>{location.needsRecheck?"This information needs rechecking.":"Information verified"} {new Date(location.lastVerifiedAt).toLocaleDateString("en-GB")}.</p>:null}
    <a className="primary-button inline-button" href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Get directions ↗</a>

    <section className="panel"><h2>What you may find</h2><ul className="product-list">{location.products.map((product,index)=><li key={`${product.type}-${product.brand}-${index}`}><p className="product-summary"><strong>{product.type}</strong> · {product.brand??"Brand not confirmed"}{product.attributes.length?` · ${product.attributes.join(" · ")}`:""}{product.absorbencies?.length?` · ${product.absorbencies.join(" · ")}`:""}</p><small>{product.evidence}{product.attributes.length?null:<><br />No material claims available</>}{product.absorbencies?.length?<><br />Flow: {product.absorbencies.join(", ")}</>:null}</small></li>)}</ul></section>

    <section className="panel community-panel">
      <p className="eyebrow">Recent community evidence</p>
      <h2>{community?.approvedCount?`${community.approvedCount} moderated visit${community.approvedCount===1?"":"s"}`:"No moderated visits yet"}</h2>
      {community?.latestAvailability?<p className={`availability-banner availability-${community.latestAvailability}`}><strong>{availabilityLabels[community.latestAvailability]}</strong>{community.lastObservedAt?` · last reported ${new Date(community.lastObservedAt).toLocaleDateString("en-GB")}`:""}</p>:<p>Be the first person to report whether these products are currently available.</p>}
      {community?.approvedCount?<div className="rating-grid"><Rating label="Listing accuracy" value={community.averageAccuracy}/><Rating label="Ease of access" value={community.averageAccess}/><Rating label="Privacy and dignity" value={community.averagePrivacy}/></div>:null}
      {community?.comments.length?<div className="community-comments"><h3>Recent comments</h3><ul className="source-list">{community.comments.map(comment=><li key={comment.id}><strong>{availabilityLabels[comment.availability]}</strong><p>{comment.comment}</p><small>Visited {new Date(comment.observedAt).toLocaleDateString("en-GB")} · Anonymous community member</small></li>)}</ul></div>:null}
    </section>

    <section className="panel"><p className="eyebrow">Share a visit</p><h2>Help the next person know what to expect.</h2>{identity?<CheckInForm locationSlug={location.slug}/>:usesClerkAuth()?<div className="sign-in-callout"><p>Sign in before sharing availability, ratings or an optional comment. Your name is not displayed publicly.</p><Link className="primary-button inline-button" href={`/sign-in?redirect_url=${encodeURIComponent(`/location/${location.slug}`)}`}>Sign in to report a visit</Link></div>:<p>Community accounts are not configured in this environment yet.</p>}</section>

    <section className="panel"><h2>Why we show this</h2><ul className="source-list">{location.sources.map(source=><li key={source.url}>{source.url.startsWith("/")?<Link href={source.url}><strong>{source.label} →</strong></Link>:<a href={source.url} target="_blank" rel="noreferrer"><strong>{source.label} ↗</strong></a>}<small>{source.scope}<br />Checked {source.checked}</small></li>)}</ul></section>
    <p><strong>Access:</strong> {location.access.replace(/\.$/, "")}. Stock can change, so please <Link href={`/contribute?kind=correction&location=${encodeURIComponent(location.slug)}`}>suggest a correction</Link> if the map is wrong.</p>
  </div>;
}
