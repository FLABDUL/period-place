import type { Metadata } from "next";
import Link from "next/link";
import { sourcePacks } from "@/data/source-packs";
import { logoutAdmin, setCheckInStatus, setContactRequestStatus, setFeedbackMetricsStatus, setLocationVisibility, setSubmissionStatus } from "@/app/actions";
import { AdminSignOut } from "@/components/admin-sign-out";
import { requireAdmin, usesClerkAuth } from "@/lib/auth";
import { summariseBetaFeedback } from "@/lib/beta-reporting";
import { listAllFeedback, listAuditEvents, listCheckIns, listContactRequests, listDrafts, listSubmissions, possibleDuplicates } from "@/lib/db";

export const metadata:Metadata={title:"Administration"};
const reportLabels={new_location:"New location",correction:"Correction",stock_update:"Stock or brand update",closure:"Closure or unavailable"} as const;
const availabilityLabels={available:"Available and stocked",low_stock:"Running low",out_of_stock:"Reported empty",could_not_find:"Could not find products",location_unavailable:"Location unavailable"} as const;
const contactLabels={general:"General",sponsorship:"Sponsorship",privacy_deletion:"Privacy or deletion"} as const;
export default async function AdminPage(){
  const admin=await requireAdmin();
  const [items,locations,audit,allFeedback,checkIns,contactRequests]=await Promise.all([listSubmissions(),listDrafts(),listAuditEvents(50),listAllFeedback(),listCheckIns(),listContactRequests()]);
  const feedback=allFeedback.slice(0,100);
  const duplicateGroups=await Promise.all(items.map((item)=>possibleDuplicates(item,locations)));
  const pending=items.filter((item)=>item.status==="pending").length;
  const pendingCheckIns=checkIns.filter((item)=>item.status==="pending").length;
  const openRevisions=locations.filter((item)=>item.status==="draft"||item.hasPendingRevision).length;
  const active=locations.filter((item)=>item.status==="published"&&!item.archivedAt).length;
  const needsRecheck=locations.filter((item)=>item.status==="published"&&!item.archivedAt&&item.needsRecheck);
  const betaSummary=summariseBetaFeedback(allFeedback);
  return <div className="page-shell admin-page">
    <div className="admin-toolbar"><div><p className="eyebrow">Protected administration</p><h1>Manage the map.</h1><small>Signed in as {admin.label}</small></div><div className="record-actions"><Link href="/admin/testing">Manual test guide →</Link>{usesClerkAuth()?<AdminSignOut/>:<form action={logoutAdmin}><button className="secondary-button" type="submit">Sign out</button></form>}</div></div>
    <p>Official and community locations now share one database-backed workflow. Changes remain private revisions until publication, and archiving never deletes their history.</p>
    <section className="panel"><h2>How beta moderation works</h2><ol><li>Testers use <Link href="/contribute">Report a change</Link> for locations and the visit form on each location page for stock or access observations.</li><li>New items appear below in <strong>Incoming reports</strong> or <strong>Community visit moderation</strong>. Nothing is public at this point.</li><li>Reject tests, duplicates, sensitive comments and claims without enough detail. Approving a new location creates a private draft; it still requires evidence and a separate publish action.</li><li>Approved visits update the public availability summary. Review genuine beta reports within 48 hours.</li></ol></section>
    <div className="admin-stats"><p><strong>{pending}</strong><span>location reports</span></p><p><strong>{pendingCheckIns}</strong><span>visits to review</span></p><p><strong>{openRevisions}</strong><span>open revisions</span></p><p><strong>{active}</strong><span>active locations</span></p><p><strong>{needsRecheck.length}</strong><span>need rechecking</span></p></div>

    <section className="panel"><h2>Official source packs</h2><p>Versioned imports make national growth repeatable and auditable. Packs requiring permission are available in previews but automatically excluded from production.</p><ul className="source-list">{sourcePacks.map((pack)=><li key={pack.id}><div className="card-heading"><div><strong>{pack.title}</strong><small>{pack.id} · checked {new Date(pack.checkedAt).toLocaleDateString("en-GB")}</small></div><span className={`confidence ${pack.productionStatus==="cleared"?"venue-confirmed":"scheme-confirmed"}`}>{pack.productionStatus==="cleared"?`${pack.locations.length} · production cleared`:`${pack.locations.length} · preview only`}</span></div><p>{pack.licenceReview}</p><small>{pack.attribution}</small></li>)}</ul></section>

    <section className="panel"><h2>Incoming reports</h2>{items.length===0?<p>No community reports yet.</p>:<ul className="source-list">{items.map((item,index)=>{const duplicates=duplicateGroups[index];return <li key={item.id}>
      <div className="card-heading"><div><strong>{item.place}</strong> · {item.city}, {item.nation} {item.postcode}<small>{reportLabels[item.reportKind]}</small></div><span className={`confidence ${item.status==="pending"?"scheme-confirmed":"venue-confirmed"}`}>{item.status}</span></div>
      <p>{item.products} · Brand: {item.brand||"unknown"}</p><small>{item.notes||"No notes"}{item.seenAt?` · Seen ${item.seenAt}`:""}</small>
      {item.targetSlug?<p><Link href={`/location/${item.targetSlug}`}>View the existing public location →</Link></p>:null}
      {duplicates.length?<div className="duplicate-warning"><strong>Possible duplicate</strong>{duplicates.map(match=><Link key={match.id} href={`/admin/drafts/${match.id}`}>{match.name} · {match.postcode}</Link>)}</div>:null}
      {item.status==="pending"?<form className="moderation-actions" action={setSubmissionStatus}><input type="hidden" name="id" value={item.id}/><button className="approve-button" name="status" value="approved" type="submit">{item.reportKind==="new_location"?"Approve into draft":"Mark reviewed"}</button><button className="reject-button" name="status" value="rejected" type="submit">Reject</button></form>:null}
    </li>})}</ul>}</section>

    <section className="panel"><h2>Community visit moderation</h2><p>Availability is structured and comments are optional. Only approved visits contribute to public summaries.</p>{checkIns.length===0?<p>No community visits yet.</p>:<ul className="source-list">{checkIns.map(item=><li key={item.id}>
      <div className="card-heading"><div><strong>{item.locationName}</strong><small>Visited {new Date(item.observedAt).toLocaleDateString("en-GB")} · signed-in member</small></div><span className={`confidence ${item.status==="pending"?"scheme-confirmed":"venue-confirmed"}`}>{item.status}</span></div>
      <p><strong>{availabilityLabels[item.availability]}</strong>{item.comment?` · ${item.comment}`:" · no comment"}</p>
      <small>Accuracy {item.accuracyRating?`${item.accuracyRating}/5`:"not rated"} · Access {item.accessRating?`${item.accessRating}/5`:"not rated"} · Privacy {item.privacyRating?`${item.privacyRating}/5`:"not rated"}</small>
      <form className="moderation-actions" action={setCheckInStatus}><input type="hidden" name="id" value={item.id}/>{item.status!=="approved"?<button className="approve-button" name="status" value="approved" type="submit">Approve visit</button>:null}{item.status!=="rejected"?<button className="reject-button" name="status" value="rejected" type="submit">Reject</button>:null}</form>
    </li>)}</ul>}</section>

    <section className="panel"><h2>Managed locations</h2><ul className="source-list">{locations.map(location=><li key={location.id} className={location.archivedAt?"archived-record":undefined}>
      <div className="card-heading"><div><strong>{location.name}</strong> · {location.city}, {location.nation}<small>{location.origin} · revision {location.currentRevision}{location.hasPendingRevision?" + unpublished revision":""}</small></div><span className={`confidence ${location.archivedAt?"scheme-confirmed":location.origin==="community"?"community-reported":"venue-confirmed"}`}>{location.archivedAt?"archived":location.status}</span></div>
      <small>{location.address} · Verified {new Date(location.lastVerifiedAt).toLocaleDateString("en-GB")}</small>
      <div className="record-actions"><Link href={`/admin/drafts/${location.id}`}>{location.status==="draft"||location.hasPendingRevision?"Continue editing":"Manage revisions"} →</Link>
        {location.status==="published"?<form action={setLocationVisibility}><input type="hidden" name="id" value={location.id}/><button name="intent" value={location.archivedAt?"restore":"archive"} type="submit">{location.archivedAt?"Restore to map":"Archive from map"}</button></form>:null}
        {location.status==="published"&&!location.archivedAt?<Link href={`/location/${location.slug}`}>Public page →</Link>:null}
      </div>
    </li>)}</ul></section>

    {needsRecheck.length?<section className="panel"><h2>Verification queue</h2><p>These published records have not been verified for more than six months. Start a revision to update the evidence without changing the public record until publication.</p><ul className="source-list">{needsRecheck.map(location=><li key={location.id}><strong>{location.name}</strong><small>{location.city} · last verified {new Date(location.lastVerifiedAt).toLocaleDateString("en-GB")}</small><div className="record-actions"><Link href={`/admin/drafts/${location.id}`}>Review evidence →</Link><Link href={`/location/${location.slug}`}>Open public page →</Link></div></li>)}</ul></section>:null}

    <section className="panel"><div className="card-heading"><div><p className="eyebrow">Private beta</p><h2>Beta review summary</h2></div><a className="secondary-button inline-button" href="/admin/feedback/export">Download private CSV</a></div><p>{betaSummary.total>=5?"The first review point has been reached. Group repeated blockers before changing the public beta.":`${betaSummary.total} of 5 included responses collected for the first review point.`}</p><div className="admin-stats"><p><strong>{betaSummary.total}</strong><span>included responses</span></p><p><strong>{betaSummary.excluded}</strong><span>excluded responses</span></p><p><strong>{betaSummary.averageUsefulness===null?"—":`${betaSummary.averageUsefulness}/5`}</strong><span>average usefulness</span></p><p><strong>{betaSummary.foundWhatNeededPercent===null?"—":`${betaSummary.foundWhatNeededPercent}%`}</strong><span>found it fully or partly</span></p><p><strong>{betaSummary.trustedResultsPercent===null?"—":`${betaSummary.trustedResultsPercent}%`}</strong><span>trusted it fully or partly</span></p><p><strong>{betaSummary.wouldUseAgainPercent===null?"—":`${betaSummary.wouldUseAgainPercent}%`}</strong><span>would use it or might</span></p></div></section>

    <section className="panel"><h2>Private user feedback</h2><p>Exclude test or duplicate responses from summary metrics without deleting them. The private CSV retains every response and its inclusion status.</p>{feedback.length?<ul className="source-list">{feedback.map(item=><li key={item.id} className={item.excludedAt?"archived-record":undefined}><div className="card-heading"><strong>Usefulness {item.usefulness}/5</strong><span className="confidence">{item.excludedAt?"Excluded from metrics":`Found it: ${item.foundWhatNeeded}`}</span></div><p className="feedback-signals">Trusted it: {item.trustedResults} · Reported an update: {item.submittedUpdate.replace("_", " ")} · Use again: {item.wouldUseAgain}</p><p>{item.comments}</p><small>{new Date(item.createdAt).toLocaleString("en-GB")}{item.excludedAt?` · excluded ${new Date(item.excludedAt).toLocaleString("en-GB")} by ${item.excludedBy||"administrator"}`:""}</small><form className="moderation-actions" action={setFeedbackMetricsStatus}><input type="hidden" name="id" value={item.id}/><button className={item.excludedAt?"approve-button":"reject-button"} name="intent" value={item.excludedAt?"include":"exclude"} type="submit">{item.excludedAt?"Include in metrics":"Exclude from metrics"}</button></form></li>)}</ul>:<p>No user feedback yet.</p>}</section>

    <section className="panel"><h2>Private contact requests</h2>{contactRequests.length?<ul className="source-list">{contactRequests.map(item=><li key={item.id} className={item.resolvedAt?"archived-record":undefined}><div className="card-heading"><strong>{contactLabels[item.kind]}</strong><span className={`confidence ${item.resolvedAt?"scheme-confirmed":"venue-confirmed"}`}>{item.resolvedAt?"resolved":"open"}</span></div><p><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></p><p>{item.message}</p><small>Received {new Date(item.createdAt).toLocaleString("en-GB")}{item.resolvedAt?` · resolved ${new Date(item.resolvedAt).toLocaleString("en-GB")}`:""}</small>{!item.resolvedAt?<form className="moderation-actions" action={setContactRequestStatus}><input type="hidden" name="id" value={item.id}/><button className="approve-button" type="submit">Mark resolved</button></form>:null}</li>)}</ul>:<p>No private contact requests yet.</p>}</section>

    <section className="panel"><h2>Audit history</h2><ol className="audit-list">{audit.map(event=><li key={event.id}><span className="audit-dot" aria-hidden="true"/><div><strong>{event.action.replaceAll("_"," ")}</strong><small>{event.entityType} · {event.actorLabel||event.actor} · {new Date(event.occurredAt).toLocaleString("en-GB")}</small></div></li>)}</ol></section>
  </div>
}
