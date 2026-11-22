import { getCurrentUser } from "@/lib/auth";
import { getSpaceAccess } from "@/lib/quad/access";
import { subscribe } from "@/lib/quad/events";
import type { QuadEvent } from "@/lib/quad/types";
import { getViewer } from "@/lib/viewer";

/**
 * Quad's real-time stream (Server-Sent Events).
 *
 * Authenticated by the session cookie. Each event is re-checked against
 * `getSpaceAccess()` before it is sent, so people only ever receive events
 * for spaces they can see — including after they leave a group.
 */
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });
  const viewer = await getViewer();

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const onEvent = (event: QuadEvent) => {
        if (event.type === "read") {
          if (event.userId !== viewer.id) return;
        } else if (!getSpaceAccess(viewer, event.spaceId)?.canView) {
          return;
        }
        send(`event: quad\ndata: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = subscribe(onEvent);
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup);

      // Tell the browser how soon to reconnect, and that we're live.
      send(`retry: 3000\nevent: ready\ndata: {}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
