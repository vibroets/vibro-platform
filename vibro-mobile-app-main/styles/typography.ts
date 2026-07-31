// styles/typography.ts
// Modern Typography System for Vibro Forms
// Following Material Design 3 and iOS Human Interface Guidelines

import { TextStyle } from 'react-native';

/**
 * Modern Typography Scale
 * Provides consistent, accessible, and visually appealing text styles
 */

export const typography = {
  // ========== DISPLAY & HEADLINES ==========
  // Use for main page titles, major sections
  displayLarge: {
    fontSize: 28,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 36,
    letterSpacing: 0,
  },
  displayMedium: {
    fontSize: 24,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 32,
    letterSpacing: 0,
  },

  // ========== TITLES ==========
  // Use for group headers, section titles
  titleLarge: {
    fontSize: 22,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 28,
    letterSpacing: 0,
  },
  titleMedium: {
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  // ========== BODY TEXT ==========
  // Use for question labels, main content
  bodyLarge: {
    fontSize: 17,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 22,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 18,
    letterSpacing: 0.4,
  },

  // ========== LABELS ==========
  // Use for input field text, buttons
  labelLarge: {
    fontSize: 16,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 14,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 16,
    letterSpacing: 0.5,
  },

  // ========== CAPTIONS & HELPER TEXT ==========
  // Use for descriptions, hints, metadata
  caption: {
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  overline: {
    fontSize: 11,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },
};

/**
 * Font Weights
 * Standardized weight scale
 */
export const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

/**
 * Color Palette for Typography
 * Semantic color system for text
 */
export const textColors = {
  primary: '#1A1A1A',      // Main text
  secondary: '#666666',    // Secondary text
  tertiary: '#999999',     // Disabled/hint text
  error: '#D32F2F',        // Error messages
  success: '#2E7D32',      // Success messages
  link: '#007AFF',         // Links and interactive text
  white: '#FFFFFF',        // Text on dark backgrounds
};

/**
 * Spacing Scale
 * Consistent spacing for text elements
 */
export const textSpacing = {
  tight: 4,
  normal: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
};

export default typography;

