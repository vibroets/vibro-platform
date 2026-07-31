import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: string;
  style?: any;
  compact?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style, compact = false }) => {
  const getStatusDisplay = (status: string) => {
    return {
      'not_started': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
      'not_assigned': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
      'notassigned': { text: 'Not Started', color: '#FFA500', bgColor: '#FFF3CD' },
      'in_progress': { text: 'In Progress', color: '#007AFF', bgColor: '#E3F2FD' },
      'completed': { text: 'Completed', color: '#34C759', bgColor: '#E8F5E8' }
    }[status] || { text: status, color: '#666', bgColor: '#F5F5F5' };
  };

  const statusDisplay = getStatusDisplay(status);

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: statusDisplay.bgColor },
        style,
      ]}
    >
      <Text style={[styles.text, compact && styles.textCompact, { color: statusDisplay.color }]}>
        {statusDisplay.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default StatusBadge;
