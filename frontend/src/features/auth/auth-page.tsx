"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiErrorMessage } from "@/shared/api/client";
import { login, register } from "./api";
import type { AuthResponse } from "./types";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100),
    email: z.email("Enter a valid email address"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(72, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

function authErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "email_taken") return "This email is already registered.";
    if (error.code === "invalid_credentials") return "Incorrect email or password.";
    if (error.code === "invalid_registration")
      return "Check your name, email, and password.";
  }
  return apiErrorMessage(error);
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTarget = searchParams.get("return");
  const returnToBooking = returnTarget === "booking";
  const returnToBookings = returnTarget === "bookings";
  const returnToAccount = returnTarget === "account";
  const returnToGate = returnTarget === "gate";
  const returnToAdmin = returnTarget === "admin";
  const requestedPassengers = Number(searchParams.get("pax"));
  const passengerCount = Number.isInteger(requestedPassengers) && requestedPassengers >= 1 && requestedPassengers <= 4 ? requestedPassengers : 1;
  const queryClient = useQueryClient();
  function signedIn(result: AuthResponse) {
    queryClient.setQueryData(["auth", "me"], result);
    router.replace(
      returnToBooking ? `/booking?pax=${passengerCount}#booking-flow` : returnToBookings ? "/bookings" : returnToAccount ? "/account" : returnToGate ? "/gate" : returnToAdmin ? "/admin" : "/",
    );
  }
  const returnSuffix = returnToBooking
    ? `?return=booking&pax=${passengerCount}`
    : returnToBookings
      ? "?return=bookings"
      : returnToAccount
        ? "?return=account"
      : returnToGate
        ? "?return=gate"
      : returnToAdmin
        ? "?return=admin"
      : "";
  const otherPage = `${mode === "login" ? "/register" : "/login"}${returnSuffix}`;

  return (
    <main className="railway-landing grid min-h-[calc(100vh-60px)] lg:grid-cols-2">
      <div className="flex flex-col bg-background px-4 py-4 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <Link
            href="/"
            className="mb-4 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to home
          </Link>
          <Card className="bg-card shadow-none">
            <CardHeader>
              <p className="text-xs font-medium tracking-widest text-muted-foreground">
                {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
              </p>
              <CardTitle>
                {mode === "login" ? "Sign in" : "Create an account"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? "Sign in to reserve seats and manage your trips."
                  : "Create an account to book your train tickets."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "login" ? (
                <LoginFields onSuccess={signedIn} />
              ) : (
                <RegisterFields onSuccess={signedIn} />
              )}
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "New here?" : "Already have an account?"}{" "}
                <Link
                  className="font-semibold text-foreground hover:underline"
                  href={otherPage}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">Railway · Train tickets</p>
      </div>
      <aside className="hidden min-h-screen flex-col justify-between border-l border-border bg-muted p-8 text-foreground lg:flex">
        <span className="text-xs font-medium tracking-widest text-muted-foreground">
          TRAVEL BY RAIL
        </span>
        <div className="max-w-lg">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Find your train.
            <br />
            <span className="text-muted-foreground">Choose your seat.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Search a route, see available seats, and keep your booking in one
            place.
          </p>
        </div>
        <div className="flex items-center gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>HANOI</span>
          <span className="h-px flex-1 bg-border" />
          <span>SAIGON</span>
        </div>
      </aside>
    </main>
  );
}

function LoginFields({
  onSuccess,
}: {
  onSuccess: (result: AuthResponse) => void;
}) {
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({ mutationFn: login, onSuccess });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">EMAIL</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          autoFocus
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">PASSWORD</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {authErrorMessage(mutation.error)}
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function RegisterFields({
  onSuccess,
}: {
  onSuccess: (result: AuthResponse) => void;
}) {
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const mutation = useMutation({ mutationFn: register, onSuccess });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(({ full_name, email, password }) =>
        mutation.mutate({ full_name, email, password }),
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="register-name">FULL NAME</Label>
        <Input
          id="register-name"
          type="text"
          autoComplete="name"
          placeholder="Your full name"
          autoFocus
          {...form.register("full_name")}
        />
        {form.formState.errors.full_name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.full_name.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">EMAIL</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">PASSWORD</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 12 characters"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-confirm-password">CONFIRM PASSWORD</Label>
        <Input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {authErrorMessage(mutation.error)}
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
