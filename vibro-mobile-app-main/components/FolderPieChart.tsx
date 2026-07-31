import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Svg, { Circle, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";

export interface FolderStat {
  id: number | null;
  name: string;
  color: string;
  total: number;
  completed: number;
  percentage: number;
}

const RADIUS = 22;
const STROKE_WIDTH = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PROFESSIONAL_COLORS = [
  "#2563EB", // blue
  "#7C3AED", // violet
  "#DC2626", // red
  "#EA580C", // orange
  "#16A34A", // green
  "#0891B2", // cyan
  "#DB2777", // pink
  "#CA8A04", // gold
];

const GRADIENT_PAIRS: Record<string, [string, string]> = {
  "#2563EB": ["#3B82F6", "#1D4ED8"],
  "#7C3AED": ["#A78BFA", "#6D28D9"],
  "#DC2626": ["#F87171", "#B91C1C"],
  "#EA580C": ["#FB923C", "#C2410C"],
  "#16A34A": ["#4ADE80", "#15803D"],
  "#0891B2": ["#22D3EE", "#0E7490"],
  "#DB2777": ["#F472B6", "#BE185D"],
  "#CA8A04": ["#FACC15", "#A16207"],
  "#10B981": ["#34D399", "#059669"],
};

const getGradient = (color: string): [string, string] => {
  return GRADIENT_PAIRS[color] || ["#3B82F6", "#1D4ED8"];
};

const PieChartCard = ({ stat, onPress, isOverall, isActive }: { stat: FolderStat; onPress?: () => void; isOverall?: boolean; isActive?: boolean }) => {
  const { name, color, completed, total, percentage } = stat;
  const strokeDashoffset = total > 0 ? CIRCUMFERENCE * (1 - completed / total) : CIRCUMFERENCE;
  const chartColor = isOverall ? "#10B981" : color;
  const [gradStart, gradEnd] = getGradient(chartColor);
  const gradId = `grad-${name.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.card, isActive && styles.cardActive]}>
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={gradStart} />
            <Stop offset="100%" stopColor={gradEnd} />
          </LinearGradient>
        </Defs>
        <Circle cx={28} cy={28} r={RADIUS} fill="none" stroke="#E5E7EB" strokeWidth={STROKE_WIDTH} />
        {total > 0 && (
          <Circle
            cx={28}
            cy={28}
            r={RADIUS}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin="28,28"
          />
        )}
        <SvgText x={28} y={32} fontSize={12} fontWeight="700" fill={chartColor} textAnchor="middle">
          {`${percentage}%`}
        </SvgText>
      </Svg>
      <Text style={[styles.folderName, isOverall && styles.overallName, isActive && styles.folderNameActive]} numberOfLines={1}>{name}</Text>
      <Text style={styles.folderStats}>{completed}/{total}</Text>
    </TouchableOpacity>
  );
};

interface FolderPieChartListProps {
  stats: FolderStat[];
  activeFolderName?: string | null;
  onFolderPress?: (folderId: number | null) => void;
}

export const FolderPieChartList = ({ stats, activeFolderName, onFolderPress }: FolderPieChartListProps) => {
  const folderStats = (stats || []).filter(s => s.id !== null);
  if (folderStats.length === 0) return null;

  const totalCompleted = folderStats.reduce((sum, s) => sum + s.completed, 0);
  const totalAll = folderStats.reduce((sum, s) => sum + s.total, 0);
  const overallPercentage = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;

  const overallStat: FolderStat = {
    id: null,
    name: "Overall",
    color: "#10B981",
    total: totalAll,
    completed: totalCompleted,
    percentage: overallPercentage,
  };

  const coloredStats = folderStats.map((s, i) => ({
    ...s,
    color: s.color && s.color !== "#6366F1" ? s.color : PROFESSIONAL_COLORS[i % PROFESSIONAL_COLORS.length],
  }));

  const isAllActive = !activeFolderName;

  return (
    <View style={styles.listContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <PieChartCard
          key="overall"
          stat={overallStat}
          isOverall
          isActive={isAllActive}
          onPress={() => onFolderPress?.(null)}
        />
        {coloredStats.map((stat) => (
          <PieChartCard
            key={stat.id}
            stat={stat}
            isActive={activeFolderName === stat.name}
            onPress={() => onFolderPress?.(stat.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    alignItems: "center",
    marginRight: 18,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cardActive: {
    backgroundColor: "#F3F4F6",
  },
  folderName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#111827",
    marginTop: 4,
  },
  folderNameActive: {
    color: "#FF5733",
  },
  overallName: {
    color: "#10B981",
  },
  folderStats: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 1,
  },
});

export default FolderPieChartList;
