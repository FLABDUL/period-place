import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publishLocationDraft, saveLocationDraft, startLocationRevision } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getDraft } from "@/lib/db";
import { absorbencies, productAttributes, productTypes, venueTypes } from "@/lib/draft-schema";
import { ukNations } from "@/types/location";

export const metadata:Metadata={title:"Manage location"};

export default async function DraftPage({params,searchParams}:PageProps<"/admin/drafts/[id]">){
  await requireAdmin();
  const [{id},query]=await Promise.all([params,searchParams]);
  const draft=await getDraft(id);
  if(!draft)notFound();
  const editable=draft.status==="draft"||draft.hasPendingRevision;
  return <div className="page-shell">
    <Link className="text-link" href="/admin">← Back to administration</Link>
    <p className="eyebrow">{draft.origin} · revision {draft.hasPendingRevision?draft.currentRevision+1:draft.currentRevision} · {draft.archivedAt?"archived":draft.hasPendingRevision?"private revision":draft.status}</p>
    <h1>{draft.name}</h1>
    {query.saved?<p className="action-message success">Revision saved. The public location has not changed.</p>:null}
    {query.published?<p className="action-message success">Published successfully. The revised record is now public.</p>:null}
    {query.error==="validation"?<p className="action-message error">Not saved. Complete every required field and check the coordinates and verification date.</p>:null}
    {query.error==="not-ready"?<p className="action-message error">This revision is not ready to publish.</p>:null}

    {!editable?<section className="panel revision-start">
      <div><h2>{draft.archivedAt?"Archived location":"Published location"}</h2><p>Create a revision to change this record without altering the live version until you explicitly publish.</p></div>
      {!draft.archivedAt?<form action={startLocationRevision}><input type="hidden" name="id" value={draft.id}/><button className="primary-button" type="submit">Create revision</button></form>:null}
      {!draft.archivedAt?<Link className="text-link" href={`/location/${draft.slug}`}>Open public location →</Link>:null}
    </section>:<>
      <form className="panel form-grid draft-form" action={saveLocationDraft}>
        <input type="hidden" name="id" value={draft.id}/>
        <label>Public name<input required name="name" maxLength={120} defaultValue={draft.name}/></label>
        <label>Town or city<input required name="city" maxLength={120} defaultValue={draft.city}/></label>
        <label>UK nation<select required name="nation" defaultValue={draft.nation}>{ukNations.map(nation=><option key={nation}>{nation}</option>)}</select></label>
        <label>Council area<input name="adminArea" maxLength={120} defaultValue={draft.adminArea}/></label>
        <label>Venue type<select required name="venueType" defaultValue={draft.venueType}>{venueTypes.map(type=><option key={type}>{type}</option>)}</select></label>
        <label>Postcode<input required name="postcode" maxLength={10} defaultValue={draft.postcode}/></label>
        <label className="full-field">Street address<input required name="address" maxLength={200} defaultValue={draft.address}/></label>
        <label>Latitude<input required name="latitude" type="number" step="any" defaultValue={draft.latitude??""}/></label>
        <label>Longitude<input required name="longitude" type="number" step="any" defaultValue={draft.longitude??""}/></label>
        <label>Last verified<input required name="lastVerifiedAt" type="date" defaultValue={draft.lastVerifiedAt}/></label>
        <span />
        {draft.origin==="official"?<div className="full-field protected-evidence"><strong>Official product evidence is protected</strong><p>Venue revisions preserve the existing product and source records. Product evidence will get its own structured editor later.</p>{draft.productTypes.map(type=><input key={type} type="hidden" name="productTypes" value={type}/>)}<input type="hidden" name="brand" value={draft.brand}/>{draft.attributes.map(attribute=><input key={attribute} type="hidden" name="attributes" value={attribute}/>)}{draft.absorbencies.map(value=><input key={value} type="hidden" name="absorbencies" value={value}/>)}</div>:<>
          <fieldset className="full-field product-fieldset"><legend>Products available</legend>{productTypes.map(type=><label key={type}><input type="checkbox" name="productTypes" value={type} defaultChecked={draft.productTypes.includes(type)}/>{type}</label>)}</fieldset>
          <label>Brand, if confirmed<input name="brand" maxLength={120} defaultValue={draft.brand}/></label>
          <fieldset className="full-field product-fieldset"><legend>Materials and product properties</legend>{productAttributes.map(attribute=><label key={attribute}><input type="checkbox" name="attributes" value={attribute} defaultChecked={draft.attributes.includes(attribute)}/>{attribute}</label>)}</fieldset>
          <fieldset className="full-field product-fieldset"><legend>Flow / absorbency</legend>{absorbencies.map(value=><label key={value}><input type="checkbox" name="absorbencies" value={value} defaultChecked={draft.absorbencies.includes(value)}/>{value}</label>)}</fieldset>
        </>}
        <label className="full-field">Access information<textarea required name="access" maxLength={300} rows={3} defaultValue={draft.access}/></label>
        <label className="full-field">Verification note<textarea required name="evidence" minLength={10} maxLength={500} rows={4} defaultValue={draft.evidence}/></label>
        <button className="primary-button" type="submit">Save revision</button>
        <p className="form-note">Saving never changes the public finder.</p>
      </form>
      <section className="publish-panel"><div><h2>{draft.status==="draft"?"Publish location?":"Publish revision?"}</h2><p>This replaces the public version and records the decision in the audit history.</p></div><form action={publishLocationDraft}><input type="hidden" name="id" value={draft.id}/><button className="publish-button" type="submit">{draft.status==="draft"?"Publish location":"Publish revision"}</button></form></section>
    </>}
  </div>
}
