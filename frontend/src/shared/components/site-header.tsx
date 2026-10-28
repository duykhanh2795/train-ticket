"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentUser } from "@/features/auth/api";
import { LandingAccountMenu } from "@/features/landing/landing-account-menu";
import { ThemeToggle } from "./theme-toggle";

const sections = [
  ["Features", "features"],
  ["Seats", "seats"],
  ["Fares", "fares"],
  ["Reviews", "reviews"],
  ["FAQ", "faq"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const auth = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    enabled: pathname !== "/",
    retry: false,
  });

  if (pathname === "/") return null;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-logo" aria-label="Railo home">
          <img src="/Golang%20Logo.svg" alt="" width="54" height="20" />
          Railo
        </Link>
        <nav className="site-header-links" aria-label="Landing sections">
          {sections.map(([label, id]) => <Link key={id} href={`/#${id}`}>{label}</Link>)}
        </nav>
        <div className="site-header-actions">
          <ThemeToggle />
          {auth.data?.user && !auth.isError ? (
            <LandingAccountMenu user={auth.data.user} />
          ) : (
            <Link href="/login" className="site-header-login">Log in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
