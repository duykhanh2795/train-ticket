import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPage } from "@/features/auth/auth-page";

export const metadata: Metadata = { title: "Sign in | Railway" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthPage mode="login" />
    </Suspense>
  );
}
