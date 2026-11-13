import type { Metadata } from "next";
import Link from "next/link";
import { SupportOutboundLink } from "@/components/support-outbound-link";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata:Metadata=createPageMetadata({title:"Support Period Place",description:"Support Period Place hosting, data verification and accessibility work without affecting listings or rankings.",path:"/support"});

export default function SupportPage(){
  const supportUrl=process.env.NEXT_PUBLIC_SUPPORT_URL || "https://buymeacoffee.com/madebyhakim";
  return <div className="page-shell narrow-page"><p className="eyebrow">Support the project</p><h1>Help keep useful access free.</h1><p>Period Place will not put location search, product details or community corrections behind a paywall.</p>
    <div className="panel"><h2>Individual support</h2><p>Optional contributions help cover hosting, data verification and accessibility work. They never affect which products or locations appear.</p>{supportUrl?<SupportOutboundLink href={supportUrl}/>:<p className="action-message">The contribution link is being prepared. The project can still be shared and improved through location reports.</p>}</div>
    <div className="panel"><h2>Responsible sponsorship</h2><p>Future partners may fund geographic coverage or verification work, but cannot buy rankings, remove criticism or turn supplier claims into independent evidence.</p><Link className="text-link" href="/contact?kind=sponsorship">Contact Hakim privately about responsible sponsorship →</Link></div>
  </div>;
}
