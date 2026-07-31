import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { backgroundSyncService } from "./backgroundSyncService";

const TASK_NAME = "vibro-background-sync";

if (!TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const result = await backgroundSyncService.forceSync();
      if (result.syncedCount > 0) {
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export const registerBackgroundSync = async (): Promise<void> => {
  if (Platform.OS === "web") return;

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log("Background fetch is disabled on this device");
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
  }
};

export const unregisterBackgroundSync = async (): Promise<void> => {
  if (Platform.OS === "web") return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) return;
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch (error) {
  }
};
