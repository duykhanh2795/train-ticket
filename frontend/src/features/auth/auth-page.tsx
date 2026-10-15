"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, TrainFront } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/shared/api/client";
import { login, register } from "./api";
import type { AuthResponse } from "./types";

const loginSchema = z.object({
  email: z.email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
});
const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Tên cần ít nhất 2 ký tự").max(100),
    email: z.email("Email không hợp lệ"),
    password: z
      .string()
      .min(12, "Mật khẩu cần ít nhất 12 ký tự")
      .max(72, "Mật khẩu quá dài"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại chưa khớp",
  });
type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

function authErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    if (code === "email_taken") return "Email này đã được đăng ký.";
    if (code === "invalid_credentials")
      return "Email hoặc mật khẩu không đúng.";
    if (code === "invalid_registration")
      return "Vui lòng kiểm tra tên, email và mật khẩu.";
  }
  return apiErrorMessage(error);
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const returnTarget = useSearchParams().get("return");
  const returnToBooking = returnTarget === "booking";
  const returnToBookings = returnTarget === "bookings";
  const queryClient = useQueryClient();
  function signedIn(result: AuthResponse) {
    queryClient.setQueryData(["auth", "me"], result);
    router.replace(
      returnToBooking ? "/#booking-flow" : returnToBookings ? "/bookings" : "/",
    );
  }
  const returnSuffix = returnToBooking
    ? "?return=booking"
    : returnToBookings
      ? "?return=bookings"
      : "";
  const otherPage = `${mode === "login" ? "/register" : "/login"}${returnSuffix}`;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col bg-background px-4 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrainFront className="size-5" />
          </span>{" "}
          railway<span className="-ml-2 text-muted-foreground">.</span>
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <Link
            href="/"
            className="mb-4 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Quay về trang chủ
          </Link>
          <Card className="bg-card shadow-none">
            <CardHeader>
              <p className="text-xs font-medium tracking-widest text-muted-foreground">
                {mode === "login" ? "CHÀO MỪNG TRỞ LẠI" : "BẮT ĐẦU HÀNH TRÌNH"}
              </p>
              <CardTitle>
                {mode === "login" ? "Đăng nhập tài khoản" : "Tạo tài khoản mới"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? "Đăng nhập để giữ ghế và quản lý chuyến đi của bạn."
                  : "Tạo tài khoản để đặt vé tàu nhanh hơn."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "login" ? (
                <LoginFields onSuccess={signedIn} />
              ) : (
                <RegisterFields onSuccess={signedIn} />
              )}
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
                <Link
                  className="font-semibold text-foreground hover:underline"
                  href={otherPage}
                >
                  {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          © Railway · Đồ án hệ thống đặt vé tàu đa chặng
        </p>
      </div>
      <aside className="hidden min-h-screen flex-col justify-between border-l border-border bg-muted p-8 text-foreground lg:flex">
        <span className="text-xs font-medium tracking-widest text-muted-foreground">
          HÀNH TRÌNH BẮT ĐẦU TỪ ĐÂY
        </span>
        <div className="max-w-lg">
          <TrainFront className="mb-6 size-10 text-primary" />
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Đi xa hơn.
            <br />
            <span className="text-muted-foreground">Dễ dàng hơn.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Tìm chuyến, chọn đúng ghế và giữ chỗ cho hành trình của bạn trong
            vài bước.
          </p>
        </div>
        <div className="flex items-center gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>HÀ NỘI</span>
          <span className="h-px flex-1 bg-border" />
          <TrainFront className="size-5 text-primary" />
          <span className="h-px flex-1 bg-border" />
          <span>SÀI GÒN</span>
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
          placeholder="ban@example.com"
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
        <Label htmlFor="login-password">MẬT KHẨU</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
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
        {mutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        <ArrowRight className="size-4" />
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
        <Label htmlFor="register-name">HỌ VÀ TÊN</Label>
        <Input
          id="register-name"
          type="text"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
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
          placeholder="ban@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">MẬT KHẨU</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="Ít nhất 12 ký tự"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-confirm-password">NHẬP LẠI MẬT KHẨU</Label>
        <Input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
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
        {mutation.isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
