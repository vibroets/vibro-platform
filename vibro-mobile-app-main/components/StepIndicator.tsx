import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Step = {
  label: string;
  key: string | number;
};

type StepIndicatorProps = {
  steps: any[];
  currentStep: number;
  onStepPress?: (index: number) => void;
};

const { width } = Dimensions.get("window");

const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onStepPress,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {steps.map((_step, idx) => (
        <React.Fragment key={`step-${idx}`}>
          <TouchableOpacity
            style={styles.stepContainer}
            onPress={() => onStepPress && onStepPress(idx)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.circle,
                idx === currentStep
                  ? styles.activeCircle
                  : idx < currentStep
                  ? styles.completedCircle
                  : styles.inactiveCircle,
              ]}
            >
              <Text style={styles.circleText}>{idx + 1}</Text>
            </View>
            <Text
              style={[styles.label, idx === currentStep && styles.activeLabel]}
              numberOfLines={1}
            >
              {`Step ${idx + 1}`}
              {/* {step.label} */}
            </Text>
          </TouchableOpacity>
          {idx < steps.length - 1 && (
            <View
              style={[
                styles.line,
                idx < currentStep ? styles.completedLine : styles.inactiveLine,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </ScrollView>
  );
};

const CIRCLE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 16,
    minWidth: width,
  },
  stepContainer: {
    alignItems: "center",
    width: 70,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 4,
  },
  activeCircle: {
    backgroundColor: "#4F8EF7",
    borderColor: "#4F8EF7",
  },
  completedCircle: {
    backgroundColor: "#4F8EF7",
    borderColor: "#4F8EF7",
    opacity: 0.7,
  },
  inactiveCircle: {
    backgroundColor: "#fff",
    borderColor: "#ccc",
  },
  circleText: {
    color: "#fff",
    fontWeight: "bold",
  },
  label: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    maxWidth: 60,
  },
  activeLabel: {
    color: "#4F8EF7",
    fontWeight: "bold",
  },
  line: {
    height: 2,
    width: 32,
    alignSelf: "center",
    marginHorizontal: 2,
    borderRadius: 1,
  },
  completedLine: {
    backgroundColor: "#4F8EF7",
    opacity: 0.7,
  },
  inactiveLine: {
    backgroundColor: "#ccc",
  },
});

export default StepIndicator;
