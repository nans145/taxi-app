// Envoie un message NUI vers le client Lua
export async function fetchNui<T = unknown>(
  eventName: string,
  data: unknown = {}
): Promise<T> {
  const resourceName =
    (window as any).__cfx_nui_resource ?? window.name ?? 'taxi-app';

  const resp = await fetch(`https://${resourceName}/${eventName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return resp.json() as Promise<T>;
}

// Écoute un message NUI envoyé depuis le client Lua via SendNuiMessage
export function onNuiMessage(
  action: string,
  handler: (payload: any) => void
): () => void {
  const listener = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg) return;

    // Format { action, payload }
    if (msg.action === action) { handler(msg.payload ?? {}); return; }
    // Format { type, data }
    if (msg.type === action)   { handler(msg.data ?? {});    return; }
    // Format direct { Taxi:xxx, ... }
    if (msg[action] !== undefined) { handler(msg[action]);   return; }
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}