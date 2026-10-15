"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Ticket,
  TrainFront,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/shared/api/client";
import { cancelBooking, confirmBooking, getBooking, listBookings } from "./api";
import type { BookingView } from "./types";

const PAGE_SIZE = 10;

function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function bookingStatus(status: BookingView["status"]) {
  switch (status) {
    case "held":
      return "Đang giữ chỗ";
    case "confirmed":
      return "Đã xác nhận";
    case "expired":
      return "Đã hết hạn";
    case "cancelled":
      return "Đã hủy";
  }
}

function serviceDate(value: string) {
  return format(new Date(`${value}T12:00:00`), "EEEE, dd/MM/yyyy", {
    locale: vi,
  });
}

function dateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}

function fareLabel(amount: number | null) {
  return amount == null ? "Chưa có giá lưu" : `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}

function BookingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <TrainFront className="size-5" /> railway.
          </Link>
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="size-4" /> Trang chủ
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">{children}</div>
    </main>
  );
}

function QueryError({ error }: { error: unknown }) {
  if (isUnauthorized(error)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Đăng nhập để xem đặt chỗ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lịch sử đặt chỗ được lưu theo tài khoản của bạn.
          </p>
          <Link href="/login?return=bookings" className={buttonVariants()}>
            Đăng nhập <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>Không tải được đặt chỗ</AlertTitle>
      <AlertDescription>{apiErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}

export function BookingsPage() {
  const [offset, setOffset] = useState(0);
  const bookings = useQuery({
    queryKey: ["bookings", PAGE_SIZE, offset],
    queryFn: () => listBookings(PAGE_SIZE, offset),
  });

  return (
    <BookingShell>
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground">
          TÀI KHOẢN CỦA BẠN
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Đặt chỗ của tôi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Xem lại các lượt giữ chỗ và hành trình đã xác nhận.
        </p>
      </div>

      {bookings.isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      {bookings.isError && <QueryError error={bookings.error} />}
      {bookings.data && bookings.data.bookings.length === 0 && offset === 0 && (
        <Card>
          <CardContent className="flex items-start gap-3">
            <Ticket className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Chưa có đặt chỗ nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tìm chuyến tàu và giữ ghế để hành trình xuất hiện tại đây.
              </p>
              <Link
                href="/#search"
                className={buttonVariants({ className: "mt-4" })}
              >
                Tìm chuyến <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
      {bookings.data && bookings.data.bookings.length === 0 && offset > 0 && (
        <p className="text-sm text-muted-foreground">
          Không còn đặt chỗ ở trang này.
        </p>
      )}
      <div className="space-y-3">
        {bookings.data?.bookings.map((booking) => (
          <Card key={booking.booking_id}>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    Tàu {booking.train_number}
                  </span>
                  <Badge variant="outline">
                    {bookingStatus(booking.status)}
                  </Badge>
                </div>
                <p className="text-sm">
                  {booking.origin_station} → {booking.destination_station}
                </p>
                <p className="text-xs text-muted-foreground">
                  {serviceDate(booking.service_date)} · Toa{" "}
                  {booking.seats.length > 1
                    ? `${booking.seats.length} hành khách · ${booking.seats.length} ghế`
                    : `Toa ${booking.coach_number} · Ghế ${booking.seat_number}`}
                </p>
                <p className="text-sm font-medium">{fareLabel(booking.fare_vnd)}</p>
              </div>
              <Link
                href={`/bookings/${encodeURIComponent(booking.booking_id)}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Xem chi tiết <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      {bookings.data && (offset > 0 || bookings.data.has_more) && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ArrowLeft className="size-4" /> Trang trước
          </Button>
          <span className="text-xs text-muted-foreground">
            Trang {offset / PAGE_SIZE + 1}
          </span>
          <Button
            variant="outline"
            disabled={!bookings.data.has_more}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Trang sau <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </BookingShell>
  );
}

export function BookingDetailsPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const booking = useQuery({
    queryKey: ["bookings", id],
    queryFn: () => getBooking(id),
  });
  const confirm = useMutation({
    mutationFn: () => confirmBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelBooking(id),
    onSuccess: () => {
      setConfirmCancellation(false);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["seats"] });
    },
  });

  return (
    <BookingShell>
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Tất cả đặt chỗ
      </Link>
      {booking.isPending && <Skeleton className="h-64 rounded-xl" />}
      {booking.isError &&
        (isUnauthorized(booking.error) ? (
          <QueryError error={booking.error} />
        ) : axios.isAxiosError(booking.error) &&
          booking.error.response?.status === 404 ? (
          <Alert>
            <AlertTitle>Không tìm thấy đặt chỗ</AlertTitle>
            <AlertDescription>
              Đặt chỗ này không thuộc tài khoản của bạn hoặc không còn tồn tại.
            </AlertDescription>
          </Alert>
        ) : (
          <QueryError error={booking.error} />
        ))}
      {booking.data && (
        <>
          <div>
            <p className="text-xs font-medium tracking-widest text-muted-foreground">
              CHI TIẾT ĐẶT CHỖ
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              {booking.data.origin_station} → {booking.data.destination_station}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mã đặt chỗ: {booking.data.booking_id}
            </p>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Tàu {booking.data.train_number}</CardTitle>
              <Badge variant="outline">
                {bookingStatus(booking.data.status)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow
                label="Ngày khởi hành"
                value={serviceDate(booking.data.service_date)}
              />
              <DetailRow label="Từ ga" value={booking.data.origin_station} />
              <DetailRow
                label="Đến ga"
                value={booking.data.destination_station}
              />
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Hành khách và chỗ ngồi</p>
                {booking.data.seats.map((seat) => (
                  <div key={seat.seat_id} className="flex items-start justify-between gap-4 text-sm">
                    <span>{seat.full_name || "Chưa lưu tên hành khách"}</span>
                    <span className="text-right text-muted-foreground">
                      Toa {seat.coach_number} · Ghế {seat.seat_number} · {seat.seat_type}
                    </span>
                  </div>
                ))}
              </div>
              <DetailRow label="Tổng giá đã chốt" value={fareLabel(booking.data.fare_vnd)} />
              <DetailRow
                label="Đặt lúc"
                value={dateTime(booking.data.created_at)}
              />
              {booking.data.status === "held" && (
                <DetailRow
                  label="Giữ đến"
                  value={dateTime(booking.data.expires_at)}
                />
              )}
            </CardContent>
          </Card>
          {booking.data.status === "held" && (
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Các chỗ đang được giữ tạm thời</p>
                    <p className="text-sm text-muted-foreground">
                      Xác nhận trước khi thời gian giữ chỗ kết thúc. Đây là
                      luồng demo, chưa kết nối thanh toán.
                    </p>
                  </div>
                </div>
                {confirm.isError && (
                  <p className="text-sm text-destructive">
                    {apiErrorMessage(confirm.error)}
                  </p>
                )}
                <Button
                  disabled={confirm.isPending || cancel.isPending}
                  onClick={() => confirm.mutate()}
                >
                  {confirm.isPending
                    ? "Đang xác nhận..."
                    : "Xác nhận đặt chỗ demo"}
                </Button>
                <div>
                  {confirmCancellation ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm">
                        Hủy lượt giữ chỗ này? Các ghế sẽ được mở lại ngay.
                      </p>
                      {cancel.isError && (
                        <p className="text-sm text-destructive">
                          {apiErrorMessage(cancel.error)}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          disabled={cancel.isPending || confirm.isPending}
                          onClick={() => cancel.mutate()}
                        >
                          {cancel.isPending ? "Đang hủy..." : "Xác nhận hủy"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={cancel.isPending}
                          onClick={() => setConfirmCancellation(false)}
                        >
                          Giữ chỗ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={confirm.isPending}
                      onClick={() => setConfirmCancellation(true)}
                    >
                      Hủy lượt giữ chỗ
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {booking.data.status === "confirmed" && (
            <p className="text-sm text-muted-foreground">
              Đặt chỗ đã xác nhận. Vé điện tử chưa được phát hành trong phiên
              bản hiện tại.
            </p>
          )}
        </>
      )}
    </BookingShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
