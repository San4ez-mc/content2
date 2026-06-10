// Global SSE client registry
// In production, replace with Redis pub/sub for multi-instance support

type SSEController = ReadableStreamDefaultController;

const clients = new Map<string, Set<SSEController>>();

export function addSSEClient(projectId: string, ctrl: SSEController) {
  if (!clients.has(projectId)) clients.set(projectId, new Set());
  clients.get(projectId)!.add(ctrl);
}

export function removeSSEClient(projectId: string, ctrl: SSEController) {
  clients.get(projectId)?.delete(ctrl);
}

export function broadcastToProject(projectId: string, data: object) {
  const projectClients = clients.get(projectId);
  if (!projectClients?.size) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(msg);
  for (const ctrl of Array.from(projectClients)) {
    try {
      ctrl.enqueue(encoded);
    } catch {
      projectClients.delete(ctrl);
    }
  }
}
