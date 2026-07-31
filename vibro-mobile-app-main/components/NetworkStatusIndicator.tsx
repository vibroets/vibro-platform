import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { networkService, NetworkStatus } from '../services/networkService';
import { backgroundSyncService } from '../services/backgroundSyncService';
import { MaterialIcons } from '@expo/vector-icons';

interface NetworkStatusIndicatorProps {
  showText?: boolean;
  compact?: boolean;
}

const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  showText = true,
  compact = false
}) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    const currentIsOnline = networkStatus?.isConnected && networkStatus?.isInternetReachable !== false;
    if (!currentIsOnline || pendingCount === 0 || isSyncing) return;

    try {
      setIsSyncing(true);
      const result = await backgroundSyncService.forceSync();

      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${result.syncedCount} submission${result.syncedCount !== 1 ? 's' : ''}.`
        );
      } else {
        Alert.alert(
          'Sync Failed',
          `Failed to sync ${result.failedCount} submission${result.failedCount !== 1 ? 's' : ''}.\n\nErrors: ${result.errors.join('\n')}`
        );
      }
    } catch (error: any) {
      Alert.alert('Sync Error', error.message || 'An error occurred during sync.');
    } finally {
      // Update pending count after sync
      const count = await backgroundSyncService.getPendingCount();
      setPendingCount(count);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let pendingInterval: number | undefined;
    let syncInterval: number | undefined;

    const updatePendingCount = async () => {
      try {
        const count = await backgroundSyncService.getPendingCount();
        setPendingCount(count);
      } catch (error) {
        setPendingCount(0);
      }
    };

    const checkSyncStatus = () => {
      try {
        const syncStatus = backgroundSyncService.getSyncStatus();
        setIsSyncing(syncStatus.syncInProgress);
      } catch (error) {
        setIsSyncing(false);
      }
    };

    const initializeComponent = async () => {
      try {
        // Get initial status
        const initialStatus = networkService.getCurrentStatus();
        setNetworkStatus(initialStatus);

        // Listen for network changes
        unsubscribe = networkService.addListener((status) => {
          setNetworkStatus(status);
          // Update pending count when network status changes
          updatePendingCount();
        });

        // Initial updates
        await updatePendingCount();
        checkSyncStatus();

        // Set up intervals
        pendingInterval = setInterval(updatePendingCount, 5000); // Update every 5 seconds
        syncInterval = setInterval(checkSyncStatus, 1000); // Update every second

      } catch (error) {
        // Set default values
        setNetworkStatus({
          isConnected: true,
          isInternetReachable: true,
          type: 'unknown',
          isWifi: false,
          isCellular: false
        });
        setPendingCount(0);
        setIsSyncing(false);
      }
    };

    initializeComponent();

    return () => {
      if (unsubscribe) unsubscribe();
      if (pendingInterval) clearInterval(pendingInterval);
      if (syncInterval) clearInterval(syncInterval);
    };
  }, []);

  if (!networkStatus) {
    return null; // Don't show anything until we have network status
  }

  const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable !== false;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <MaterialIcons
          name={isOnline ? "wifi" : "wifi-off"}
          size={16}
          color={isOnline ? "#34C759" : "#FF3B30"}
        />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
        {isSyncing && (
          <MaterialIcons
            name="sync"
            size={14}
            color="#007AFF"
            style={styles.syncIcon}
          />
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, !isOnline && styles.offlineContainer]}
      onPress={pendingCount > 0 && isOnline && !isSyncing ? handleManualSync : undefined}
      disabled={!pendingCount || !isOnline || isSyncing}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons
          name={isOnline ? "wifi" : "wifi-off"}
          size={20}
          color={isOnline ? "#34C759" : "#FF3B30"}
        />
        {isSyncing && (
          <MaterialIcons
            name="sync"
            size={16}
            color="#007AFF"
            style={styles.syncIcon}
          />
        )}
      </View>

      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.statusText, !isOnline && styles.offlineText]}>
            {isOnline ? "Online" : "Offline"}
          </Text>
          {pendingCount > 0 && (
            <Text style={styles.pendingText}>
              {pendingCount} pending sync{pendingCount !== 1 ? 's' : ''}
              {isOnline && !isSyncing && (
                <Text style={styles.tapToSyncText}> (tap to sync)</Text>
              )}
            </Text>
          )}
          {isSyncing && (
            <Text style={styles.syncingText}>
              Syncing...
            </Text>
          )}
        </View>
      )}

      {pendingCount > 0 && isOnline && !isSyncing && (
        <MaterialIcons
          name="sync"
          size={16}
          color="#007AFF"
          style={styles.manualSyncIcon}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  offlineContainer: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FECACA',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  syncIcon: {
    marginLeft: 4,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  offlineText: {
    color: '#FF3B30',
  },
  pendingText: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  syncingText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapToSyncText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  manualSyncIcon: {
    marginLeft: 8,
  },
});

export default NetworkStatusIndicator;
