import "server-only";
import { EventEmitter } from "node:events";
import type { QuadEvent } from "./types";

/**
 * In-process event bus behind Quad's real-time stream.
 *
 * Stored on globalThis so server actions and the SSE route handler share one
 * emitter even though Next.js bundles them separately, and so it survives
 * hot reloads in development.
 *
 * This works for a single server process (one school on one machine — the
 * intended deployment). To run several instances behind a load balancer,
 * swap this for Redis pub/sub or Postgres LISTEN/NOTIFY; nothing else changes.
 */
const g = globalThis as unknown as { __quadBus?: EventEmitter };

function createBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(0); // one listener per open browser tab
  return bus;
}

const bus: EventEmitter = g.__quadBus ?? (g.__quadBus = createBus());

export function publish(event: QuadEvent): void {
  bus.emit("event", event);
}

export function subscribe(listener: (event: QuadEvent) => void): () => void {
  bus.on("event", listener);
  return () => {
    bus.off("event", listener);
  };
}
