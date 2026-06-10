import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addSSEClient, removeSSEClient } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const projectId = params.id;

  const stream = new ReadableStream({
    start(ctrl) {
      addSSEClient(projectId, ctrl);

      // Send initial connected event
      const encoded = new TextEncoder().encode(
        `data: ${JSON.stringify({ type: "connected", projectId })}\n\n`
      );
      ctrl.enqueue(encoded);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          ctrl.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeSSEClient(projectId, ctrl);
        try {
          ctrl.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
