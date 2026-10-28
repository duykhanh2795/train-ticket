"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, LogOut, Mail, Settings2, Ticket, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { logout } from "@/features/auth/api";
import type { AuthUser } from "@/features/auth/types";
import { apiErrorMessage } from "@/shared/api/client";

export function LandingAccountMenu({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(["auth", "me"], null),
  });

  return (
    <Popover>
      <PopoverTrigger className="btn account-trigger" aria-label={`${user.full_name}, account menu`}>
        <UserRound aria-hidden="true" />
        <span>{user.full_name}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-60 gap-0 rounded-xl bg-popover p-2 text-popover-foreground shadow-xl"
        style={{ fontFamily: 'var(--font-instrument), Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
      >
        <div className="min-w-0 px-2.5 py-2">
          <p className="truncate text-sm font-semibold">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="my-1 border-t border-border" />
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground">
          <BadgeCheck className="size-4" aria-hidden="true" />
          <span>Member</span>
        </div>
        <Link href="/account" className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
          <Settings2 className="size-4" aria-hidden="true" />
          Manage account
        </Link>
        <Link href="/bookings" className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
          <Ticket className="size-4" aria-hidden="true" />
          My Bookings
        </Link>
        <span aria-disabled="true" title="Coming soon" className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/70">
          <Wallet className="size-4" aria-hidden="true" />
          Promo Codes
        </span>
        <span aria-disabled="true" title="Coming soon" className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/70">
          <Mail className="size-4" aria-hidden="true" />
          Contact Preference
        </span>
        <div className="my-1 border-t border-border" />
        <button type="button" disabled={signOut.isPending} onClick={() => signOut.mutate()} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
          <LogOut className="size-4" aria-hidden="true" />
          {signOut.isPending ? "Signing out..." : "Sign Out"}
        </button>
        {signOut.isError && <p role="alert" className="px-2.5 py-1 text-xs text-destructive">{apiErrorMessage(signOut.error)}</p>}
      </PopoverContent>
    </Popover>
  );
}
