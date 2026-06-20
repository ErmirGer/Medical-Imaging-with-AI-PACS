import { useEffect, useRef, useState } from "react";
import { API_BASE } from "./api";
import type { AlertEvent } from "./types";

/**
 * Subscribe to the backend SSE stream. Returns the latest high-risk alert and
 * a running log. Auto-reconnects (EventSource does this natively, but we also
 * recreate on hard errors).
 */
export function useAlerts(onAlert?: (e: AlertEvent) => void) {
  const [latest, setLatest] = useState<AlertEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(onAlert);
  cbRef.current = onAlert;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      es = new EventSource(`${API_BASE}/api/stream`);
      es.onopen = () => setConnected(true);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as AlertEvent;
          if (data.type === "high_risk") {
            setLatest(data);
            cbRef.current?.(data);
          }
        } catch {
          /* keepalive comment lines arrive as no data */
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!closed) setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, []);

  return { latest, connected };
}
