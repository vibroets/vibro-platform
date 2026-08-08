import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Stage } from "../types/formTypes";

interface StageIndicatorProps {
  stages: Stage[] | any;
  currentStageIndex: number;
  completedStages: number[];
  onStagePress?: (index: number) => void;
  disableNavigation?: boolean;
  allowPreviewNavigation?: boolean;
  isToggleEnabled?: boolean;
  isFormAssignedToUser?: boolean;
  onStageMenuPress?: (stageIndex: number) => void;
}

const StageIndicator: React.FC<StageIndicatorProps> = ({
  stages,
  currentStageIndex,
  completedStages,
  onStagePress,
  disableNavigation = false,
  allowPreviewNavigation = false,
  isToggleEnabled = false,
  isFormAssignedToUser = false,
  onStageMenuPress,
}) => {
  const completedStageIds = stages
    .filter((stage: any) => stage.is_completed === true)
    .map((stage: any) => stage.id);

  // Function to check if a stage is accessible
  const canAccessStage = (stageIndex: number): boolean => {
    if (stageIndex < 0 || stageIndex >= stages.length) return false;
    const targetStage = stages[stageIndex];
    if (!targetStage) return false;

    if (allowPreviewNavigation) return true;

    // Always allow access to current stage
    if (stageIndex === currentStageIndex) return true;

    // For completed forms, allow viewing all stages
    const completedStageIds = stages
      .filter((stage: any) => stage.is_completed === true)
      .map((stage: any) => stage.id);

    const allStagesCompleted = stages.every((stage: any) =>
      completedStageIds.includes(stage.id)
    );

    if (allStagesCompleted) {
      return true;
    }

    // For stages after the first, check if previous stages are completed
    if (stageIndex > 0) {
      for (let i = 0; i < stageIndex; i++) {
        const prevStage = stages[i];
        if (!prevStage?.is_completed) {
          return false; // Previous stage not completed
        }
      }
    }

    return true;
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {stages.map((stage: any, index: number) => {
        const isCompleted = completedStageIds.includes(stage.id);
        const isCurrent = index === currentStageIndex;
        const isAccessible = canAccessStage(index);
        const isDisabled = !isAccessible || disableNavigation;

        return (
          <View key={stage.id} style={styles.stageWrapper}>
            <TouchableOpacity
              style={[
                styles.stageContainer,
                isCurrent && styles.currentStageContainer,
              ]}
              onPress={() => !disableNavigation && onStagePress?.(index)}
              disabled={isDisabled || disableNavigation}
              activeOpacity={disableNavigation ? 1 : 0.1}
            >
              <View
                style={[
                  styles.stageCircle,
                  isCurrent && styles.currentStageCircle,
                  isCompleted && styles.completedStageCircle,
                  // isDisabled && styles.disabledStageCircle,
                ]}
              >
                {isCompleted ? (
                  <MaterialIcons name="check" size={16} color="white" />
                ) : (
                  <Text
                    style={[
                      styles.stageNumber,
                      isCurrent && styles.currentStageNumber,
                      isDisabled && styles.disabledStageNumber,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stageName,
                  isCurrent && styles.currentStageName,
                  isCompleted && styles.completedStageName,
                  isDisabled && styles.disabledStageName,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {stage.name}
              </Text>
              {index < stages.length - 1 && (
                <View
                  style={[
                    styles.connectorLine,
                    (isCompleted || isCurrent) && styles.activeConnectorLine,
                    isDisabled && styles.disabledConnectorLine,
                  ]}
                />
              )}
            </TouchableOpacity>

            {/* Three-dot menu button - Show whenever previous-stage edit toggle is enabled */}
            {isToggleEnabled && onStageMenuPress && (
              <TouchableOpacity
                style={styles.stageMenuButton}
                onPress={() => onStageMenuPress(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="more-vert" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 8,
    flexGrow: 1, // Allow proper scrolling
  },
  stageWrapper: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  stageContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginRight: 16,
    width: 70,
    minWidth: 60, // Ensure minimum width for touch targets
    position: "relative",
  },
  stageMenuButton: {
    position: "absolute",
    right: -5,
    top: -5,
    padding: 5,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  stageCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    minWidth: 24,
    minHeight: 24,
  },
  currentStageCircle: {
    backgroundColor: "#007AFF",
  },
  completedStageCircle: {
    backgroundColor: "#34C759",
  },
  disabledStageCircle: {
    backgroundColor: "#F5F5F5",
  },
  stageNumber: {
    color: "#757575",
    fontSize: 12,
    fontWeight: "500",
  },
  currentStageNumber: {
    color: "white",
  },
  disabledStageNumber: {
    color: "#BDBDBD",
  },
  stageName: {
    fontSize: 11,
    color: "#757575",
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 2,
  },
  currentStageName: {
    color: "#007AFF",
    fontWeight: "500",
  },
  completedStageName: {
    color: "#34C759",
  },
  disabledStageName: {
    color: "#BDBDBD",
  },
  connectorLine: {
    position: "absolute",
    top: 12,
    right: -18,
    width: 20,
    height: 2,
    backgroundColor: "#E0E0E0",
  },
  activeConnectorLine: {
    backgroundColor: "#34C759",
  },
  disabledConnectorLine: {
    backgroundColor: "#F5F5F5",
  },
  currentStageContainer: {
    //flexDirection: "row",
    // backgroundColor: "rgba(0, 122, 255, 0.1)",
    // borderRadius: 20,
    // paddingVertical: 8,
    // paddingHorizontal: 12,
    // marginRight: 20,
  },
});

export default StageIndicator;
