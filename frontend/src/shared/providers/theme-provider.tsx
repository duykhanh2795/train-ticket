"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

function SyncLandingTheme() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") {
      document.documentElement.dataset.theme = resolvedTheme;
    }
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SyncLandingTheme />
      {children}
    </NextThemesProvider>
  );
}
