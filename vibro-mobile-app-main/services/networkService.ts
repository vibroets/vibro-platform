import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
}

class NetworkService {
  private listeners: ((status: NetworkStatus) => void)[] = [];
  private currentStatus: NetworkStatus | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Get initial network state
    NetInfo.fetch().then(state => {
      this.updateStatus(this.convertNetInfoState(state));
    });

    // Listen for network changes
    NetInfo.addEventListener(state => {
      this.updateStatus(this.convertNetInfoState(state));
    });
  }

  private convertNetInfoState(state: NetInfoState): NetworkStatus {
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
    };
  }

  private updateStatus(status: NetworkStatus) {
    const hasChanged = !this.currentStatus ||
      this.currentStatus.isConnected !== status.isConnected ||
      this.currentStatus.isInternetReachable !== status.isInternetReachable;

    this.currentStatus = status;

    if (hasChanged) {
      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          console.error('Error in network status listener:', error);
        }
      });
    }
  }

  /**
   * Get current network status
   */
  getCurrentStatus(): NetworkStatus | null {
    return this.currentStatus;
  }

  /**
   * Check if device is online (connected and internet reachable)
   */
  isOnline(): boolean {
    return this.currentStatus?.isConnected === true &&
           this.currentStatus?.isInternetReachable !== false;
  }

  /**
   * Check if device is offline
   */
  isOffline(): boolean {
    return !this.isOnline();
  }

  /**
   * Add a listener for network status changes
   */
  addListener(callback: (status: NetworkStatus) => void): () => void {
    this.listeners.push(callback);

    // Immediately call with current status if available
    if (this.currentStatus) {
      callback(this.currentStatus);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Wait for network to become available
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isOnline()) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.addListener((status) => {
        if (status.isConnected && status.isInternetReachable !== false) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * Force refresh network status
   */
  async refresh(): Promise<NetworkStatus> {
    const state = await NetInfo.refresh();
    const status = this.convertNetInfoState(state);
    this.updateStatus(status);
    return status;
  }
}

// Create singleton instance
export const networkService = new NetworkService();

export default networkService;
