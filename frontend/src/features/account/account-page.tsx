"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Pencil, Plus, Trash2, UserRound, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUser } from "@/features/auth/api";
import { ApiError, apiErrorMessage } from "@/shared/api/client";
import {
  createSavedPassenger,
  deleteSavedPassenger,
  listSavedPassengers,
  renameSavedPassenger,
} from "./api";

export function AccountPage() {
  const queryClient = useQueryClient();
  const auth = useQuery({ queryKey: ["auth", "me"], queryFn: currentUser, retry: false });
  const user = auth.data?.user;
  const passengers = useQuery({
    queryKey: ["account", "passengers"],
    queryFn: listSavedPassengers,
    enabled: Boolean(user),
    retry: false,
  });
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const refreshPassengers = () => queryClient.invalidateQueries({ queryKey: ["account", "passengers"] });
  const create = useMutation({
    mutationFn: createSavedPassenger,
    onSuccess: () => {
      setNewName("");
      void refreshPassengers();
    },
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameSavedPassenger(id, name),
    onSuccess: () => {
      setEditingId(null);
      void refreshPassengers();
    },
  });
  const remove = useMutation({
    mutationFn: deleteSavedPassenger,
    onSuccess: () => {
      setDeletingId(null);
      void refreshPassengers();
    },
  });
  const validNewName = newName.trim().length >= 2 && newName.trim().length <= 120;
  const validEditedName = editedName.trim().length >= 2 && editedName.trim().length <= 120;

  return (
    <main className="railway-landing min-h-screen bg-[#F0F3F7] text-foreground dark:bg-background">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">YOUR ACCOUNT</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Manage account</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Keep your details and passenger names in one place.
        </p>

        {auth.isPending ? (
          <div className="mt-9 space-y-4"><Skeleton className="h-52 w-full" /><Skeleton className="h-56 w-full" /></div>
        ) : !user ? (
          <Card className="mt-9 max-w-xl">
            <CardHeader><CardTitle>Sign in to manage your account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {auth.isError && !(auth.error instanceof ApiError && auth.error.status === 401)
                  ? apiErrorMessage(auth.error)
                  : "Your profile and saved passengers are available after sign-in."}
              </p>
              <Link href="/login?return=account" className={buttonVariants()}>Sign in <ArrowRight className="size-4" /></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-9 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <aside className="rounded-xl bg-card p-2 text-sm ring-1 ring-foreground/10">
              <a href="#profile" className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 font-medium"><UserRound className="size-4" /> Profile</a>
              <a href="#passengers" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"><UsersRound className="size-4" /> Saved passengers</a>
              <Link href="/bookings" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowRight className="size-4" /> My bookings</Link>
            </aside>

            <div className="min-w-0 space-y-7">
              <Card id="profile" className="scroll-mt-24">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-lg">Profile</CardTitle>
                  <p className="text-sm text-muted-foreground">Your account information.</p>
                </CardHeader>
                <CardContent className="grid gap-5 pt-1 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Full name</p>
                    <p className="mt-1 truncate text-base font-medium">{user.full_name}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Email address</p>
                    <p className="mt-1 truncate text-base font-medium">{user.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">Profile editing is not available yet.</p>
                </CardContent>
              </Card>

              <Card id="passengers" className="scroll-mt-24">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-lg">Saved passengers</CardTitle>
                  <p className="text-sm text-muted-foreground">Store the names of people you book for.</p>
                </CardHeader>
                <CardContent className="space-y-5 pt-1">
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => { event.preventDefault(); if (validNewName) create.mutate(newName.trim()); }}
                  >
                    <Input
                      aria-label="Passenger full name"
                      placeholder="Passenger full name"
                      maxLength={120}
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      className="sm:flex-1"
                    />
                    <Button type="submit" disabled={!validNewName || create.isPending}>
                      <Plus className="size-4" /> {create.isPending ? "Adding..." : "Add passenger"}
                    </Button>
                  </form>
                  {create.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(create.error)}</p>}
                  {passengers.isPending ? (
                    <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
                  ) : passengers.isError ? (
                    <Alert variant="destructive"><AlertTitle>Could not load passengers</AlertTitle><AlertDescription>{apiErrorMessage(passengers.error)}</AlertDescription></Alert>
                  ) : passengers.data?.length ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {passengers.data.map((passenger) => (
                        <li key={passenger.id} className="flex flex-wrap items-center gap-2 px-3 py-3 sm:flex-nowrap">
                          {editingId === passenger.id ? (
                            <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (validEditedName) rename.mutate({ id: passenger.id, name: editedName.trim() }); }}>
                              <Input aria-label="Edit passenger name" autoFocus maxLength={120} value={editedName} onChange={(event) => setEditedName(event.target.value)} />
                              <Button type="submit" size="icon" aria-label="Save name" disabled={!validEditedName || rename.isPending}><Check className="size-4" /></Button>
                              <Button type="button" size="icon" variant="ghost" aria-label="Cancel editing" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
                            </form>
                          ) : deletingId === passenger.id ? (
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="text-sm">Remove {passenger.full_name}?</span>
                              <div className="flex gap-1">
                                <Button type="button" size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
                                <Button type="button" size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(passenger.id)}>{remove.isPending ? "Removing..." : "Remove"}</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-4" /></span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{passenger.full_name}</span>
                              <Button type="button" size="icon" variant="ghost" aria-label={`Rename ${passenger.full_name}`} onClick={() => { setEditingId(passenger.id); setEditedName(passenger.full_name); setDeletingId(null); }}><Pencil className="size-4" /></Button>
                              <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${passenger.full_name}`} onClick={() => { setDeletingId(passenger.id); setEditingId(null); }}><Trash2 className="size-4" /></Button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">No saved passengers yet.</div>
                  )}
                  {rename.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(rename.error)}</p>}
                  {remove.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(remove.error)}</p>}
                </CardContent>
              </Card>

              <Link href="/bookings" className="flex items-center justify-between rounded-xl bg-card px-5 py-4 text-sm font-medium ring-1 ring-foreground/10 hover:bg-muted">
                View your bookings <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
