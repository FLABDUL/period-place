import Link from "next/link";
export default function NotFound(){return <div className="page-shell"><p className="eyebrow">404</p><h1>That location is not on the map.</h1><p>It may have moved, or it might be one we should add.</p><Link className="primary-button" href="/">Return to the finder</Link></div>}
