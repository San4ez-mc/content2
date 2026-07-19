import { NextRequest } from "next/server";
import { getSessionUser, canAccessProject } from "@/lib/tenant";
import { addSSEClient, removeSSEClient } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const projectId = params.id;
  if (!(await canAccessProject(user, projectId))) {
    return new Response("Forbidden", { status: 403 });
  }

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
