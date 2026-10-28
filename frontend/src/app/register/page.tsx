import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPage } from "@/features/auth/auth-page";

export const metadata: Metadata = { title: "Create account | Railway" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthPage mode="register" />
    </Suspense>
  );
}
