import { LandingInteractions } from "@/features/landing/landing-interactions";
import { scopedLandingCss } from "@/features/landing/landing-scoped-css";
import { landingMarkup } from "@/features/landing/landing-source";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Railo – Book train tickets online",
  description:
    "Find a train, pick your seat and get an e-ticket for Vietnam's Reunification Express in under a minute.",
};

export default function Home() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: scopedLandingCss }} />
      <style>{`
        .landing-page { --muted: #666; --accent: #355cff; --card: #f4f4f5; }
        :root[data-theme="dark"] .landing-page { --muted: #a1a1a1; --accent: #8fa7ff; --card: #101010; }
        .landing-page header .nav-cta .account-trigger {
          max-width: 180px;
          border-radius: 8px;
          background: var(--card);
          color: var(--fg);
          font-family: var(--sans);
          font-size: 13px;
          font-weight: 500;
        }
        .landing-page header .nav-cta .account-trigger:hover { background: var(--soft); }
        .landing-page header .nav-cta .account-trigger svg { width: 17px; height: 17px; flex: none; }
        .landing-page header .nav-cta .account-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
      <div
        className="landing-page"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: landingMarkup }}
      />
      <LandingInteractions />
    </>
  );
}
