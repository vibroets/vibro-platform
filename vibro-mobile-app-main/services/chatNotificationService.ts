import { SecureStoreService, SecureStoreKeys } from "./secureStore";

const WS_BASE_URL = "ws://192.168.1.3:8000/ws/chat/notifications";
const RECONNECT_BASE_DELAY = 3000;
const RECONNECT_MAX_DELAY = 30000;
const PING_INTERVAL = 25000;

type NotificationCallback = (data: {
  message: any;
  group_id: number;
  group_name: string;
}) => void;

class ChatNotificationService {
  private ws: WebSocket | null = null;
  private callback: NotificationCallback | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;

  setCallback(cb: NotificationCallback) {
    this.callback = cb;
  }

  async connect() {
    const authInfo = (await SecureStoreService.get(
      SecureStoreKeys.AUTH_INFO
    )) as any;
    const token = authInfo?.access;
    if (!token) {
      console.warn("[ChatNotification] No token, will retry in 5s");
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
      return;
    }

    this.cleanupWs();
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/?token=${token}`);

      this.ws.onopen = () => {
        console.log("[ChatNotification] WebSocket connected");
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message_notification" && this.callback) {
            this.callback(data);
          }
        } catch (e) {
          // Ignore non-JSON messages (e.g., pong responses)
        }
      };

      this.ws.onclose = () => {
        console.log("[ChatNotification] WebSocket closed");
        this.stopPing();
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.warn("[ChatNotification] WS error:", error);
      };
    } catch (e) {
      console.warn("[ChatNotification] connect error:", e);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(1.5, this.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );
    this.reconnectAttempts++;
    console.log(`[ChatNotification] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          // ignore
        }
      }
    }, PING_INTERVAL);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanupWs() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.cleanupWs();
  }
}

export const chatNotificationService = new ChatNotificationService();
