"use client";

import { addDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { currentUser } from "@/features/auth/api";
import { LandingAccountMenu } from "./landing-account-menu";
import { STATIONS } from "@/features/trip-search/stations";
import { tripSearchHref } from "@/features/trip-search/url";

function drawPhoneQr(svg: SVGSVGElement) {
  const size = 29;
  let seed = 7;
  let pixels = "";
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const reserved = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
  const finder = (x: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const edge = i === 0 || j === 0 || i === 6 || j === 6;
        const center = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (edge || center) {
          pixels += `<rect x="${x + i}" y="${y + j}" width="1" height="1"/>`;
        }
      }
    }
  };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (!reserved(i, j) && random() > 0.5) {
        pixels += `<rect x="${i}" y="${j}" width="1" height="1"/>`;
      }
    }
  }
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  svg.innerHTML = `<g fill="#0a0a0b">${pixels}</g>`;
}

function drawSampleQr(svg: SVGSVGElement) {
  let seed = 7;
  let pixels = "";
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const finder = (x: number, y: number) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" fill="none" stroke="currentColor"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const reserved = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      if (!reserved && random() > 0.52) {
        pixels += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  svg.innerHTML = pixels + finder(0, 0) + finder(14, 0) + finder(0, 14);
}

export function LandingInteractions() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const auth = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    retry: false,
  });
  const [accountSlot, setAccountSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const accountLink = document.querySelector<HTMLAnchorElement>(
      '.landing-page header .nav-cta > a.btn:not(.primary)',
    );
    if (!accountLink) return;
    const slot = document.createElement("span");
    slot.style.display = "contents";
    accountLink.before(slot);
    accountLink.href = "/login";
    const frame = window.requestAnimationFrame(() => setAccountSlot(slot));
    return () => {
      window.cancelAnimationFrame(frame);
      accountLink.style.display = "";
      slot.remove();
    };
  }, []);

  useEffect(() => {
    const accountLink = document.querySelector<HTMLAnchorElement>(
      '.landing-page header .nav-cta > a.btn:not(.primary)',
    );
    if (accountLink) accountLink.style.display = auth.data?.user && !auth.isError ? "none" : "";
  }, [auth.data, auth.isError]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".landing-page");
    if (!root) return;

    const cleanups: Array<() => void> = [];
    const byId = <T extends Element>(id: string) =>
      root.querySelector<T>(`#${id}`);
    const listen = <T extends EventTarget>(
      target: T | null,
      name: string,
      handler: EventListener,
    ) => {
      if (!target) return;
      target.addEventListener(name, handler);
      cleanups.push(() => target.removeEventListener(name, handler));
    };
    const iso = (date: Date) => format(date, "yyyy-MM-dd");
    const from = byId<HTMLSelectElement>("from");
    const to = byId<HTMLSelectElement>("to");
    const departure = byId<HTMLInputElement>("dep");
    const returning = byId<HTMLInputElement>("ret");
    const error = byId<HTMLElement>("err");
    const returnField = byId<HTMLElement>("retf");
    const search = byId<HTMLFormElement>("search");
    const passengers = byId<HTMLSelectElement>("pax");

    if (from && to && departure && returning && error && returnField && search) {
      if (!from.options.length) {
        STATIONS.forEach((station) => {
          from.add(new Option(station.name, station.id));
          to.add(new Option(station.name, station.id));
        });
      }
      from.value = "HN";
      to.value = "SG";
      const today = new Date();
      departure.min = iso(today);
      departure.value = iso(addDays(today, 3));
      let trip = "single";
      root.querySelectorAll<HTMLButtonElement>(".trip-type button").forEach((button) => {
        listen(button, "click", () => {
          trip = button.dataset.t ?? "single";
          root.querySelectorAll<HTMLButtonElement>(".trip-type button").forEach((item) => {
            item.setAttribute("aria-checked", String(item === button));
          });
          const roundTrip = trip === "return";
          returning.disabled = !roundTrip;
          returnField.classList.toggle("off", !roundTrip);
          if (roundTrip && !returning.value) {
            const date = new Date(departure.value);
            date.setDate(date.getDate() + 3);
            returning.value = iso(date);
          }
          if (!roundTrip) returning.value = "";
          error.textContent = "";
        });
      });
      listen(departure, "change", () => {
        returning.min = departure.value;
      });
      listen(byId<HTMLButtonElement>("swap"), "click", (event) => {
        [from.value, to.value] = [to.value, from.value];
        (event.currentTarget as HTMLButtonElement).classList.toggle("flip");
        error.textContent = "";
      });
      listen(search, "submit", (event) => {
        event.preventDefault();
        if (!STATIONS.some((station) => station.id === from.value) ||
            !STATIONS.some((station) => station.id === to.value)) {
          error.textContent = "Choose valid stations.";
        } else if (from.value === to.value) {
          error.textContent = "Choose two different stations.";
        } else if (!departure.value || departure.value < iso(new Date())) {
          error.textContent = "Pick a valid departure date.";
        } else if (trip === "return" && (!returning.value || returning.value < departure.value)) {
          error.textContent = "Pick a return date on or after departure.";
        } else if (trip === "return") {
          error.textContent = "Return trips are not available yet. Choose Single to search.";
        } else {
          error.textContent = "";
          const count = Number(passengers?.value ?? "1");
          router.push(tripSearchHref(
            { originId: from.value, destinationId: to.value, serviceDate: departure.value },
            { passengers: Number.isInteger(count) && count >= 1 && count <= 4 ? count : 1 },
          ));
        }
      });
    }

    root.querySelectorAll<HTMLAnchorElement>('a.btn[href="#seats"]')
      .forEach((link) => listen(link, "click", (event) => {
        event.preventDefault();
        search?.scrollIntoView({ behavior: "smooth", block: "center" });
        from?.focus({ preventScroll: true });
      }));

    const phoneQr = byId<SVGSVGElement>("phone-demo-qr");
    if (phoneQr) drawPhoneQr(phoneQr);
    const sampleQr = byId<SVGSVGElement>("qr");
    if (sampleQr) drawSampleQr(sampleQr);

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      for (const [containerSelector, setSelector, trackSelector] of [
        [".mq", ".mq-set", ".mq-track"],
        [".rv-mq", ".rv-set", ".rv-track"],
      ]) {
        const container = root.querySelector<HTMLElement>(containerSelector);
        const set = container?.querySelector<HTMLElement>(setSelector);
        const track = container?.querySelector<HTMLElement>(trackSelector);
        if (!container || !set || !track) continue;
        const clone = set.cloneNode(true) as HTMLElement;
        clone.setAttribute("aria-hidden", "true");
        track.append(clone);
        container.classList.add("on");
        cleanups.push(() => {
          clone.remove();
          container.classList.remove("on");
        });
      }
    }

    const ringText = byId<HTMLElement>("ringT");
    const ringCircle = byId<SVGCircleElement>("ringC");
    if (ringText && ringCircle) {
      let seconds = 600;
      const timer = window.setInterval(() => {
        seconds = seconds <= 1 ? 600 : seconds - 1;
        ringText.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
        ringCircle.style.strokeDashoffset = String(314 * (1 - seconds / 600));
      }, 1000);
      cleanups.push(() => window.clearInterval(timer));
    }

    const header = root.querySelector<HTMLElement>("header");
    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", scrollY > 8);
      listen(window, "scroll", onScroll);
      onScroll();
    }
    if (!reducedMotion && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          element.classList.add("in");
          observer.unobserve(element);
          window.setTimeout(() => { element.style.transitionDelay = ""; }, 900);
        }),
        { threshold: 0.12 },
      );
      root.querySelectorAll<HTMLElement>(".sec-head,.feat,.banner,.tri,.fares .fare,.rv,.fig,.coach,.picker-copy,.faq-group").forEach((element, index) => {
        element.classList.add("rev");
        element.style.transitionDelay = `${(index % 3) * 70}ms`;
        observer.observe(element);
      });
      cleanups.push(() => observer.disconnect());
    }

    listen(byId<HTMLButtonElement>("theme"), "click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    });
    listen(byId<HTMLFormElement>("news"), "submit", (event) => {
      event.preventDefault();
      (event.currentTarget as HTMLFormElement).innerHTML =
        '<span style="font-size:14px;color:var(--fg)">Subscribed. Check your email to confirm.</span>';
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [router, setTheme]);

  const user = auth.isError ? undefined : auth.data?.user;
  return accountSlot && user
    ? createPortal(<LandingAccountMenu user={user} />, accountSlot)
    : null;
}
