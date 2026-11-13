import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { DM_Sans, Fraunces } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { usesClerkAuth } from "@/lib/auth";
import { SupportPrompt } from "@/components/support-prompt";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteDescription } from "@/lib/site-metadata";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  metadataBase: new URL("https://periodplace.org"),
  title: { default: "Period Place", template: "%s · Period Place" },
  description: siteDescription,
  icons: {
    icon: [{ url: "/brand/period-place-icon.svg", type: "image/svg+xml" }],
    shortcut: "/brand/period-place-icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content=<>
    <p style={{ padding: "1rem", background: "#f5dfb4", color: "#25372f", textAlign: "center" }}>Public source demo: all listed venues are fictional. The original service is retired. Do not travel to these sample locations.</p>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><Image src="/brand/period-place-mark.svg" alt="" width={34} height={40} unoptimized priority /></span><span>Period Place</span></Link><nav className="desktop-nav" aria-label="Main navigation"><Link href="/find">Find products</Link><Link href="/coverage">Coverage</Link><Link href="/contribute">Report a change</Link><Link href="/feedback">Give feedback</Link><Link href="/about">About</Link><Link href="/support">Support</Link></nav><ThemeToggle /><details className="nav-menu"><summary>Menu</summary><nav aria-label="Mobile navigation"><Link href="/find">Find products</Link><Link href="/coverage">Coverage</Link><Link href="/contribute">Report a change</Link><Link href="/feedback">Give feedback</Link><Link href="/about">About</Link><Link href="/support">Support</Link></nav></details></header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <SupportPrompt />
    <footer><p><strong>Period Place</strong> is an independent community project created by <a href="https://madebyhakim.com/" target="_blank" rel="noreferrer">Hakim</a>.</p><p>Finding products will remain free. Product availability can change. <Link href="/coverage">Coverage</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/contact">Contact</Link> · <Link href="/support">Support the project</Link></p></footer>
  </>;
  return <html lang="en-GB" data-scroll-behavior="smooth" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}><body><Script id="period-place-theme" strategy="beforeInteractive">{`try{var t=localStorage.getItem('period-place-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`}</Script><AnalyticsProvider />{usesClerkAuth()?<ClerkProvider>{content}</ClerkProvider>:content}</body></html>;
}
