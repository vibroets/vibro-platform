const WS_BASE_URL = "wss://www.vibroets.com/ws/chat";

export class ChatSocket {
  private ws: WebSocket | null = null;
  private groupId: number;
  private token: string;
  private onMessage: (data: any) => void;
  private onConnect: () => void;
  private onDisconnect: () => void;
  private reconnectTimer: any = null;
  private shouldReconnect = true;

  constructor(
    groupId: number,
    token: string,
    onMessage: (data: any) => void,
    onConnect: () => void,
    onDisconnect: () => void
  ) {
    this.groupId = groupId;
    this.token = token;
    this.onMessage = onMessage;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
  }

  connect() {
    this.shouldReconnect = true;
    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/${this.groupId}/?token=${this.token}`);

      this.ws.onopen = () => {
        this.onConnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (e) {
          console.warn("ChatSocket parse error:", e);
        }
      };

      this.ws.onclose = () => {
        this.onDisconnect();
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = (error) => {
        console.warn("ChatSocket error:", error);
      };
    } catch (e) {
      console.warn("ChatSocket connect error:", e);
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
