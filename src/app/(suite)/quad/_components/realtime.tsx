"use client";

/**
 * One EventSource per tab, shared by everything in Quad (the sidebar's
 * unread counters and the open conversation). Reconnects with backoff when
 * the server goes away and tells subscribers when it is live again, so they
 * can catch up on anything they missed.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { QuadEvent } from "@/lib/quad/types";

type Listener = (event: QuadEvent) => void;
type Status = "connecting" | "live" | "offline";

type RealtimeContext = {
  subscribe: (listener: Listener) => () => void;
  status: Status;
  /** Increments every time the stream (re)connects. */
  epoch: number;
  viewerId: string;
};

const Ctx = createContext<RealtimeContext | null>(null);

export function QuadRealtimeProvider({ viewerId, children }: { viewerId: string; children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [status, setStatus] = useState<Status>("connecting");
  const [epoch, setEpoch] = useState(0);
  const subscribe = useRef((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }).current;

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/quad/stream");
      source.addEventListener("ready", () => {
        attempts = 0;
        setStatus("live");
        setEpoch((n) => n + 1);
      });
      source.addEventListener("quad", (e) => {
        let event: QuadEvent;
        try {
          event = JSON.parse((e as MessageEvent<string>).data) as QuadEvent;
        } catch {
          return;
        }
        for (const l of listeners.current) l(event);
      });
      source.onerror = () => {
        setStatus("offline");
        // The browser retries by itself unless the connection was refused
        // outright; in that case back off and try again ourselves.
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          attempts += 1;
          retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts));
        }
      };
    };

    connect();
    const onOnline = () => {
      if (source?.readyState === EventSource.CLOSED) {
        clearTimeout(retry);
        connect();
      }
    };
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      clearTimeout(retry);
      source?.close();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return <Ctx.Provider value={{ subscribe, status, epoch, viewerId }}>{children}</Ctx.Provider>;
}

function useRealtime(): RealtimeContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Quad components must be inside <QuadRealtimeProvider>");
  return ctx;
}

/** Calls `listener` for every event; always sees the latest closure. */
export function useQuadEvents(listener: Listener) {
  const { subscribe } = useRealtime();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => subscribe((e) => latest.current(e)), [subscribe]);
}

export function useConnection() {
  const { status, epoch, viewerId } = useRealtime();
  return { status, epoch, viewerId };
}
