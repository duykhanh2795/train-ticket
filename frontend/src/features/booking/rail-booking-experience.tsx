"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, intervalToDuration } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Compass,
  Info,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Ticket,
  TrainFront,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUser, logout } from "@/features/auth/api";
import { searchTrips } from "@/features/trip-search/api";
import { STATIONS, stationName } from "@/features/trip-search/stations";
import type { TripSearchItem } from "@/features/trip-search/types";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/shared/api/client";
import { confirmBooking, holdBooking, listSeats } from "./api";
import { useBookingStore } from "./store";

const searchSchema = z
  .object({
    originId: z.string().min(1),
    destinationId: z.string().min(1),
    serviceDate: z.string().min(1, "Chọn ngày đi"),
  })
  .refine((value) => value.originId !== value.destinationId, {
    message: "Ga đi và ga đến phải khác nhau",
    path: ["destinationId"],
  });
type SearchForm = z.infer<typeof searchSchema>;

function clock(value: string) {
  return format(new Date(value), "HH:mm");
}

function fareLabel(amount: number | null | undefined) {
  return amount == null ? "Chưa có giá" : `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}

function tripDuration(start: string, end: string) {
  const duration = intervalToDuration({
    start: new Date(start),
    end: new Date(end),
  });
  return (
    [
      duration.days && `${duration.days} ngày`,
      duration.hours && `${duration.hours} giờ`,
      duration.minutes && `${duration.minutes} phút`,
    ]
      .filter(Boolean)
      .join(" ") || "—"
  );
}

export function RailBookingExperience() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    search,
    trip,
    selectedSeats,
    booking,
    setSearch,
    chooseTrip,
    chooseSeat,
    setBooking,
    reset,
  } = useBookingStore();
  const [now, setNow] = useState(0);
  const [minDate, setMinDate] = useState("");
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>({});
  const [passengerError, setPassengerError] = useState("");
  const searchForm = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      originId: search?.originId ?? "HN",
      destinationId: search?.destinationId ?? "SG",
      serviceDate: search?.serviceDate ?? "",
    },
  });
  const setSearchValue = searchForm.setValue;
  const getSearchValue = searchForm.getValues;
  const originId = useWatch({ control: searchForm.control, name: "originId" });
  const destinationId = useWatch({
    control: searchForm.control,
    name: "destinationId",
  });
  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    retry: false,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.setQueryData(["auth", "me"], null);
      reset();
      setPassengerNames({});
      setPassengerError("");
    },
  });
  const tripsQuery = useQuery({
    queryKey: ["trips", search],
    queryFn: () => searchTrips(search!),
    enabled: !!search,
  });
  const seatsQuery = useQuery({
    queryKey: ["seats", trip?.trip_id, trip?.from_stop, trip?.to_stop],
    queryFn: () => listSeats(trip!.trip_id, trip!.from_stop, trip!.to_stop),
    enabled: !!trip && !booking,
    refetchInterval: trip && !booking ? 15_000 : false,
  });
  const holdMutation = useMutation({
    mutationFn: () =>
      holdBooking({
        trip_id: trip!.trip_id,
        passengers: selectedSeats.map((item, index) => ({
          seat_id: item.seat_id,
          full_name: (passengerNames[item.seat_id] ??
            (index === 0 ? authQuery.data?.user?.full_name : "") ?? "").trim(),
        })),
        from_stop: trip!.from_stop,
        to_stop: trip!.to_stop,
      }),
    onSuccess: (result) => {
      setNow(Date.now());
      setBooking(result);
      queryClient.invalidateQueries({ queryKey: ["seats", trip?.trip_id] });
    },
    onError: () =>
      queryClient.invalidateQueries({ queryKey: ["seats", trip?.trip_id] }),
  });
  const confirmMutation = useMutation({
    mutationFn: confirmBooking,
    onSuccess: setBooking,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMinDate(format(new Date(), "yyyy-MM-dd"));
      if (!getSearchValue("serviceDate")) {
        setSearchValue(
          "serviceDate",
          format(addDays(new Date(), 1), "yyyy-MM-dd"),
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [getSearchValue, setSearchValue]);

  useEffect(() => {
    if (!booking || booking.status !== "held") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [booking]);

  const secondsLeft =
    booking && now
      ? Math.max(
          0,
          Math.ceil((new Date(booking.expires_at).getTime() - now) / 1000),
        )
      : 0;
  const from = search ? stationName(search.originId) : "Hà Nội";
  const to = search ? stationName(search.destinationId) : "Sài Gòn";
  const selectedCurrentSeats = selectedSeats.map((selected) =>
    seatsQuery.data?.seats.find((item) => item.seat_id === selected.seat_id),
  );
  const seatsAvailable = selectedCurrentSeats.every(
    (item) => item?.available && item.fare_vnd != null,
  );
  const estimatedFare = selectedCurrentSeats.every((item) => item?.fare_vnd != null)
    ? selectedCurrentSeats.reduce((sum, item) => sum + (item?.fare_vnd ?? 0), 0)
    : null;

  function submitSearch(values: SearchForm) {
    reset();
    setPassengerNames({});
    setPassengerError("");
    setSearch(values);
    window.setTimeout(
      () =>
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth" }),
      80,
    );
  }
  function swapStations() {
    const origin = searchForm.getValues("originId");
    searchForm.setValue("originId", searchForm.getValues("destinationId"), {
      shouldValidate: true,
    });
    searchForm.setValue("destinationId", origin, { shouldValidate: true });
    searchForm.clearErrors();
  }
  function selectTrip(value: TripSearchItem) {
    chooseTrip(value);
    setPassengerNames({});
    setPassengerError("");
    holdMutation.reset();
    confirmMutation.reset();
    window.setTimeout(
      () =>
        document
          .getElementById("booking-flow")
          ?.scrollIntoView({ behavior: "smooth" }),
      80,
    );
  }
  function startAgain() {
    reset();
    setPassengerNames({});
    setPassengerError("");
    holdMutation.reset();
    confirmMutation.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function holdSelectedSeat() {
    if (!authQuery.data?.user) {
      router.push("/login?return=booking");
      return;
    }
    if (selectedSeats.some((item, index) =>
      (passengerNames[item.seat_id] ??
        (index === 0 ? authQuery.data?.user?.full_name : "") ?? "").trim().length < 2
    )) {
      setPassengerError("Nhập họ tên cho từng hành khách (ít nhất 2 ký tự). ");
      return;
    }
    setPassengerError("");
    holdMutation.mutate();
  }

  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <a
            href="#top"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
            aria-label="Railway về đầu trang"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrainFront className="size-5" />
            </span>
            railway<span className="-ml-2 text-muted-foreground">.</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a className="hover:text-foreground" href="#search">
              Tìm chuyến
            </a>
            <a className="hover:text-foreground" href="#how-it-works">
              Cách hoạt động
            </a>
            <a className="hover:text-foreground" href="#about">
              Về dự án
            </a>
          </nav>
          <div className="flex items-center gap-2 md:gap-4">
            {authQuery.data?.user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-30 truncate text-xs font-semibold text-foreground sm:block">
                  {authQuery.data.user.full_name}
                </span>
                <Link
                  href="/bookings"
                  className={buttonVariants({ variant: "ghost" })}
                  aria-label="Đặt chỗ của tôi"
                >
                  <Ticket className="size-4" />
                  <span className="hidden sm:inline">Đặt chỗ</span>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  Đăng xuất
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost" })}
              >
                Đăng nhập
              </Link>
            )}
            <a
              href="#search"
              className={cn(buttonVariants(), "hidden sm:inline-flex")}
            >
              Đặt vé <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-background">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-10 md:grid-cols-2 md:px-8 md:py-12">
            <div>
              <Badge
                variant="outline"
                className="border-border text-foreground"
              >
                HÀNH TRÌNH BẮT ĐẦU TỪ ĐÂY
              </Badge>
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
                Đi xa hơn.
                <br />
                <span className="text-muted-foreground">Dễ dàng hơn.</span>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                Tìm chuyến tàu phù hợp, chọn đúng chỗ ngồi và giữ vé trong vài
                bước. Mọi hành trình đáng nhớ đều bắt đầu thật đơn giản.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4" /> Chọn ghế theo từng chặng
                </span>
                <span className="flex items-center gap-2">
                  <Clock3 className="size-4" /> Giữ chỗ tức thì
                </span>
              </div>
            </div>
            <div className="mx-auto w-full max-w-lg">
              <Card className="bg-card shadow-none">
                <CardHeader className="border-b border-dashed border-border">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className="bg-muted text-foreground"
                    >
                      HÀNH TRÌNH MẪU
                    </Badge>
                    <TrainFront className="size-6 text-foreground" />
                  </div>
                  <CardTitle className="mt-2">
                    Khám phá Việt Nam trên từng cung đường
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">GA ĐI</p>
                      <p className="mt-1 text-sm font-semibold">Hà Nội</p>
                    </div>
                    <div className="flex items-center gap-1 text-foreground">
                      <span className="h-px w-5 bg-current" />
                      <TrainFront className="size-5" />
                      <span className="h-px w-5 bg-current" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">GA ĐẾN</p>
                      <p className="mt-1 text-sm font-semibold">Sài Gòn</p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>ĐƯỜNG SẮT VIỆT NAM</span>
                    <span>01 / 05</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          id="search"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 md:px-8"
        >
          <Card className="bg-card shadow-none">
            <CardHeader className="sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest text-foreground">
                  LÊN KẾ HOẠCH CHUYẾN ĐI
                </p>
                <CardTitle className="mt-1">Tìm chuyến tàu của bạn</CardTitle>
              </div>
              <Badge variant="secondary" className="w-fit gap-1">
                <Ticket className="size-4" /> Vé một chiều
              </Badge>
            </CardHeader>
            <CardContent>
              <form onSubmit={searchForm.handleSubmit(submitSearch)}>
                <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label
                      htmlFor="origin"
                      className="text-xs font-bold text-muted-foreground"
                    >
                      GA ĐI
                    </Label>
                    <Select
                      value={originId}
                      onValueChange={(value) =>
                        searchForm.setValue("originId", String(value), {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="origin" className="w-full">
                        <MapPin className="size-4 text-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATIONS.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Đổi ga đi và ga đến"
                    onClick={swapStations}
                    className="justify-self-center"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <div className="space-y-2">
                    <Label
                      htmlFor="destination"
                      className="text-xs font-bold text-muted-foreground"
                    >
                      GA ĐẾN
                    </Label>
                    <Select
                      value={destinationId}
                      onValueChange={(value) =>
                        searchForm.setValue("destinationId", String(value), {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="destination" className="w-full">
                        <MapPin className="size-4 text-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATIONS.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="departure-date"
                      className="text-xs font-bold text-muted-foreground"
                    >
                      NGÀY KHỞI HÀNH
                    </Label>
                    <Input
                      id="departure-date"
                      type="date"
                      min={minDate}
                      {...searchForm.register("serviceDate")}
                    />
                  </div>
                  <Button type="submit">
                    <Search className="size-4" /> Tìm chuyến
                  </Button>
                </div>
                {(searchForm.formState.errors.destinationId ||
                  searchForm.formState.errors.serviceDate) && (
                  <p className="mt-3 text-sm text-destructive">
                    {searchForm.formState.errors.destinationId?.message ||
                      searchForm.formState.errors.serviceDate?.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" /> Dữ liệu nhà ga hiện theo bộ
            mẫu. Chuyến đi sẽ xuất hiện sau khi bạn nạp dữ liệu mẫu vào backend.
          </p>
        </section>

        <section
          id="results"
          className="mx-auto max-w-7xl scroll-mt-24 space-y-4 px-5 py-10 md:px-8"
        >
          {search ? (
            <>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-widest text-foreground">
                    KẾT QUẢ TÌM KIẾM
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {from} <span className="text-foreground">→</span> {to}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(
                      new Date(`${search.serviceDate}T12:00:00`),
                      "EEEE, dd/MM/yyyy",
                      { locale: vi },
                    )}
                  </p>
                </div>
                <Badge variant="outline">
                  {tripsQuery.data?.trips.length ?? 0} chuyến tàu
                </Badge>
              </div>
              {tripsQuery.isPending && (
                <Card>
                  <CardContent className="flex items-center gap-4">
                    <Skeleton className="size-11 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-45" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </CardContent>
                </Card>
              )}
              {tripsQuery.isError && (
                <Alert variant="destructive">
                  <Info />
                  <AlertTitle>Chưa thể tải chuyến tàu</AlertTitle>
                  <AlertDescription>
                    {apiErrorMessage(tripsQuery.error)}{" "}
                    <Button
                      variant="outline"
                      onClick={() => tripsQuery.refetch()}
                    >
                      Thử lại
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {tripsQuery.isSuccess && tripsQuery.data.trips.length === 0 && (
                <Alert>
                  <TrainFront />
                  <AlertTitle>Chưa có chuyến tàu cho ngày này</AlertTitle>
                  <AlertDescription>
                    Hãy thử ngày khác hoặc nạp dữ liệu mẫu trong backend.
                  </AlertDescription>
                </Alert>
              )}
              {tripsQuery.data?.trips.map((item) => (
                <TripCard
                  key={item.trip_id}
                  trip={item}
                  from={from}
                  to={to}
                  selected={trip?.trip_id === item.trip_id}
                  onSelect={() => selectTrip(item)}
                />
              ))}
            </>
          ) : (
            <Card className="border-dashed bg-card/70">
              <CardContent className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <Compass className="size-6" />
                </span>
                <div>
                  <h2 className="font-semibold">Sẵn sàng lên đường?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Chọn ga đi, ga đến và ngày khởi hành ở phía trên để xem các
                    chuyến tàu.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {trip && (
          <section
            id="booking-flow"
            className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 md:px-8"
          >
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-foreground">
                  BƯỚC TIẾP THEO
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {booking?.status === "confirmed"
                    ? "Vé đã được xác nhận"
                    : booking
                      ? "Chỗ ngồi của bạn"
                      : "Chọn chỗ ngồi"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tàu {trip.train_number} · {from} → {to}
                </p>
              </div>
              <Button variant="ghost" onClick={startAgain}>
                <ArrowLeft className="size-4" /> Tìm chuyến khác
              </Button>
            </div>
            {booking ? (
              <Card className="bg-card">
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="size-6" />
                    </span>
                    <div>
                      <Badge
                        variant="outline"
                        className="border-border text-foreground"
                      >
                        {booking.status === "confirmed"
                          ? "ĐẶT CHỖ HOÀN TẤT"
                          : "ĐANG GIỮ CHỖ"}
                      </Badge>
                      <h3 className="mt-2 text-base font-semibold text-foreground">
                        {booking.status === "confirmed"
                          ? "Hành trình đã sẵn sàng!"
                          : "Các ghế đã được giữ cho bạn"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Mã đặt chỗ <strong>{booking.booking_id}</strong>
                      </p>
                      <Link
                        href={`/bookings/${encodeURIComponent(booking.booking_id)}`}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
                      >
                        Xem chi tiết đặt chỗ <ArrowRight className="size-3" />
                      </Link>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Tàu {trip.train_number} · {selectedSeats.length} ghế
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        Giá đã chốt: {fareLabel(booking.fare_vnd)}
                      </p>
                      {booking.status === "held" && (
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          Thời gian còn lại:{" "}
                          {String(Math.floor(secondsLeft / 60)).padStart(
                            2,
                            "0",
                          )}
                          :{String(secondsLeft % 60).padStart(2, "0")}
                        </p>
                      )}
                    </div>
                  </div>
                  {booking.status === "held" && (
                    <div className="flex flex-col gap-2">
                      <Button
                        disabled={
                          secondsLeft === 0 || confirmMutation.isPending
                        }
                        onClick={() =>
                          confirmMutation.mutate(booking.booking_id)
                        }
                      >
                        {confirmMutation.isPending
                          ? "Đang xác nhận..."
                          : "Xác nhận đặt chỗ demo"}{" "}
                        <ArrowRight className="size-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Chức năng demo, chưa kết nối thanh toán
                      </span>
                      {confirmMutation.isError && (
                        <p className="text-sm text-destructive">
                          {apiErrorMessage(confirmMutation.error)}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="bg-card">
                  <CardHeader className="gap-2">
                    <Badge variant="secondary" className="w-fit gap-1">
                      <TrainFront className="size-3" /> SƠ ĐỒ CHỖ NGỒI
                    </Badge>
                    <CardTitle>Chọn ghế cho hành khách</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Chọn tối đa 6 ghế. Ghế chỉ được giữ sau khi bạn xác nhận.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <i className="size-3 rounded bg-background ring-1 ring-border" />{" "}
                        Còn trống
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-3 rounded bg-muted ring-1 ring-border" />{" "}
                        Đã giữ
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-3 rounded bg-primary" /> Đang chọn
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {seatsQuery.isPending && (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                        {Array.from({ length: 16 }, (_, index) => (
                          <Skeleton key={index} className="h-8 rounded-lg" />
                        ))}
                      </div>
                    )}
                    {seatsQuery.isError && (
                      <Alert variant="destructive">
                        <Info />
                        <AlertTitle>Không tải được sơ đồ ghế</AlertTitle>
                        <AlertDescription>
                          {apiErrorMessage(seatsQuery.error)}{" "}
                          <Button
                            variant="outline"
                            onClick={() => seatsQuery.refetch()}
                          >
                            Thử lại
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    {seatsQuery.data &&
                      (seatsQuery.data.seats.length ? (
                        <div className="space-y-6">
                          {Array.from(
                            new Set(
                              seatsQuery.data.seats.map(
                                (item) => item.coach_number,
                              ),
                            ),
                          ).map((coach) => (
                            <div
                              key={coach}
                              className="rounded-xl border border-border p-4"
                            >
                              <div className="mb-4 flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-foreground">
                                  TOA {coach}
                                </span>
                                <Badge variant="outline">
                                  {
                                    seatsQuery.data.seats.filter(
                                      (item) =>
                                        item.coach_number === coach &&
                                        item.available,
                                    ).length
                                  }{" "}
                                  ghế trống
                                </Badge>
                              </div>
                              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-8">
                                {seatsQuery.data.seats
                                  .filter((item) => item.coach_number === coach)
                                  .map((item) => (
                                    <Button
                                      key={item.seat_id}
                                      type="button"
                                      variant="outline"
                                      disabled={
                                        (!item.available || selectedSeats.length >= 6) &&
                                        !selectedSeats.some((selected) => selected.seat_id === item.seat_id)
                                      }
                                      aria-pressed={selectedSeats.some((selected) => selected.seat_id === item.seat_id)}
                                      title={`${item.seat_type} · Ghế ${item.seat_number} · ${fareLabel(item.fare_vnd)}`}
                                      className={cn(
                                        "font-semibold",
                                        !item.available &&
                                          "bg-muted text-muted-foreground",
                                        selectedSeats.some((selected) => selected.seat_id === item.seat_id)
                                          ? "border-primary bg-accent text-accent-foreground hover:bg-accent/80 hover:text-accent-foreground"
                                          : "border-border bg-background text-foreground hover:bg-muted",
                                      )}
                                      onClick={() => chooseSeat(item)}
                                    >
                                      {item.seat_number}
                                    </Button>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Chuyến tàu này chưa có sơ đồ ghế.
                        </p>
                      ))}
                  </CardContent>
                </Card>
                <Card className="h-fit bg-card lg:sticky lg:top-24">
                  <CardHeader>
                    <div className="flex items-center justify-between text-xs font-bold tracking-widest text-foreground">
                      <span>THÔNG TIN ĐẶT CHỖ</span>
                      <Ticket className="size-5" />
                    </div>
                    <CardTitle className="mt-1">Hành trình của bạn</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {clock(trip.departure_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">{from}</p>
                      </div>
                      <TrainFront className="size-5 text-foreground" />
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {clock(trip.arrival_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">{to}</p>
                      </div>
                    </div>
                    <Separator />
                    <SummaryRow label="Chuyến tàu" value={trip.train_number} />
                    <SummaryRow
                      label="Ngày đi"
                      value={format(new Date(trip.departure_at), "dd/MM/yyyy")}
                    />
                    <SummaryRow
                      label="Chỗ ngồi"
                      value={selectedSeats.length
                        ? selectedSeats.map((item) => `${item.coach_number}-${item.seat_number}`).join(", ")
                        : "Chưa chọn"}
                    />
                    <SummaryRow
                      label="Giá vé dự kiến"
                      value={fareLabel(estimatedFare)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Giá được tính lại và chốt khi giữ chỗ.
                    </p>
                    {selectedSeats.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Thông tin hành khách</p>
                        {selectedSeats.map((item, index) => (
                          <div key={item.seat_id} className="space-y-1">
                            <Label htmlFor={`passenger-${item.seat_id}`}>
                              Ghế {item.coach_number}-{item.seat_number}
                            </Label>
                            <Input
                              id={`passenger-${item.seat_id}`}
                              maxLength={120}
                              autoComplete="name"
                              placeholder="Họ và tên hành khách"
                              value={passengerNames[item.seat_id] ??
                                (index === 0 ? authQuery.data?.user?.full_name : "") ?? ""}
                              onChange={(event) => {
                                setPassengerNames((current) => ({ ...current, [item.seat_id]: event.target.value }));
                                setPassengerError("");
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <Separator />
                    {authQuery.data?.user ? (
                      <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                        <UserRound className="size-5 shrink-0 text-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {authQuery.data.user.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {authQuery.data.user.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Đăng nhập hoặc tạo tài khoản để giữ ghế này.
                      </p>
                    )}
                    {holdMutation.isError && (
                      <p className="text-sm text-destructive">
                        {apiErrorMessage(holdMutation.error)}
                      </p>
                    )}
                    {passengerError && <p className="text-sm text-destructive">{passengerError}</p>}
                    <Button
                      className="w-full"
                      onClick={holdSelectedSeat}
                      disabled={
                        selectedSeats.length === 0 || !seatsAvailable || holdMutation.isPending
                      }
                    >
                      {holdMutation.isPending
                        ? "Đang giữ ghế..."
                        : authQuery.data?.user
                          ? `Giữ ${selectedSeats.length} chỗ ngay`
                          : "Đăng nhập để giữ chỗ"}
                      <ArrowRight className="size-4" />
                    </Button>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="size-4" /> Ghế được giữ trong 10
                      phút sau khi đặt
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        )}

        <section id="how-it-works" className="mt-10 bg-card py-12">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-foreground">
                  ĐƠN GIẢN TRONG TỪNG BƯỚC
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Đi tàu dễ đến thế.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Một luồng đặt vé rõ ràng, từ chọn hành trình đến giữ đúng ghế
                bạn muốn.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Step
                number="01 / TÌM KIẾM"
                icon={<Search className="size-6" />}
                title="Chọn hành trình"
                copy="Nhập điểm đi, điểm đến và ngày khởi hành để tìm chuyến tàu phù hợp."
              />
              <Step
                number="02 / CHỌN GHẾ"
                icon={<TrainFront className="size-6" />}
                title="Tìm chỗ của bạn"
                copy="Xem trạng thái từng ghế trên đúng chặng đi và chọn vị trí yêu thích."
              />
              <Step
                number="03 / GIỮ CHỖ"
                icon={<Ticket className="size-6" />}
                title="Hoàn tất đặt vé"
                copy="Giữ ghế trong 10 phút và xác nhận đặt chỗ trong luồng demo."
              />
            </div>
          </div>
        </section>
        <section
          id="about"
          className="mx-auto max-w-7xl px-5 py-10 md:px-8"
        >
          <div>
            <p className="text-xs font-bold tracking-widest text-foreground">
              VỀ DỰ ÁN
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Mỗi chặng đường, một trải nghiệm mới.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Railway là giao diện cho hệ thống đặt vé tàu đa chặng. Trạng thái
              ghế phụ thuộc vào đoạn hành trình, nên một ghế có thể phục vụ
              nhiều lượt khách trên cùng chuyến tàu.
            </p>
            <a
              href="#search"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              Khám phá hành trình <ArrowUpRight className="size-4" />
            </a>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-muted-foreground md:px-8">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <TrainFront className="size-4" /> railway.
          </span>
          <span>Đồ án hệ thống đặt vé tàu đa chặng</span>
          <span>Trải nghiệm demo</span>
        </div>
      </footer>
    </div>
  );
}

function TripCard({
  trip,
  from,
  to,
  selected,
  onSelect,
}: {
  trip: TripSearchItem;
  from: string;
  to: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        "bg-card transition-colors hover:bg-accent/20",
        selected && "ring-1 ring-primary",
      )}
    >
      <CardContent className="grid gap-5 md:grid-cols-[130px_1fr_auto] md:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <TrainFront className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">CHUYẾN TÀU</p>
            <p className="font-bold text-foreground">{trip.train_number}</p>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="text-base font-semibold">
              {clock(trip.departure_at)}
            </p>
            <p className="text-xs text-muted-foreground">{from}</p>
          </div>
          <div className="text-center text-xs text-muted-foreground">
            <Clock3 className="mx-auto mb-1 size-4" />
            {tripDuration(trip.departure_at, trip.arrival_at)}
          </div>
          <div className="text-right">
            <p className="text-base font-semibold">{clock(trip.arrival_at)}</p>
            <p className="text-xs text-muted-foreground">{to}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {format(new Date(trip.departure_at), "dd MMM yyyy", { locale: vi })}
            </p>
            <p className="mt-1 text-sm font-medium">
              {trip.fare_from_vnd == null ? "Chưa có giá" : `Từ ${fareLabel(trip.fare_from_vnd)}`}
            </p>
          </div>
          <Button onClick={onSelect}>
            {selected ? "Đang chọn" : "Chọn chuyến"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right text-foreground">{value}</strong>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  copy,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <Card className="bg-background">
      <CardContent className="space-y-4">
        <Badge variant="outline">{number}</Badge>
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-foreground">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
      </CardContent>
    </Card>
  );
}
