/* KeyboardAwareContainer.tsx */
import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Animated,
  Dimensions,
  findNodeHandle,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TargetedEvent,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('screen');

export interface KeyboardAwareContainerRef {
  scrollToInput: (key: string) => void;
  scrollToTop: () => void;
  scrollToAccordion: (accordionId: string) => void;
  scrollToOffset: (offset: number) => void;
  scrollByOffset: (delta: number) => void;
  getCurrentScrollOffset: () => number;
  getFieldRef: (key: string) => React.RefObject<View | null> | undefined;
  _registerRef: (key: string, ref: React.RefObject<View | null>) => void;
  _registerAccordionRef: (accordionId: string, ref: React.RefObject<View | null>) => void;
}

/* --------------------------------------------------------------- */
export const InputWrapper = ({
  inputKey,
  children,
  container,
}: {
  inputKey: string;
  children: ReactNode;
  container?: React.RefObject<KeyboardAwareContainerRef>;
}) => {
  const wrapperRef = useRef<View>(null);
  const textInputRef = useRef<any>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (container?.current && wrapperRef.current) {
      container.current._registerRef(inputKey, wrapperRef);
    }
  }, [container, inputKey]);

  // Re-focus the input after keyboard appears to prevent focus loss
  // from layout shifts (padding changes, scroll adjustments) that occur
  // when the keyboard shows for the first time.
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        if (isFocusedRef.current && textInputRef.current) {
          setTimeout(() => {
            if (isFocusedRef.current && textInputRef.current) {
              textInputRef.current.focus();
            }
          }, 100);
        }
      },
    );
    return () => showSub.remove();
  }, []);

  const child = Children.only(children);
  if (!isValidElement(child)) return <View ref={wrapperRef}>{children}</View>;

  const origFocus = (child.props as any).onFocus;
  const origBlur = (child.props as any).onBlur;
  const origRef = (child.props as any).ref;

  const handleFocus = (e: NativeSyntheticEvent<TargetedEvent>) => {
    isFocusedRef.current = true;
    origFocus?.(e);
    setTimeout(() => container?.current?.scrollToInput(inputKey), 250);
  };

  const handleBlur = (e: NativeSyntheticEvent<TargetedEvent>) => {
    isFocusedRef.current = false;
    origBlur?.(e);
  };

  const setRef = (ref: any) => {
    textInputRef.current = ref;
    if (typeof origRef === 'function') origRef(ref);
    else if (origRef && typeof origRef === 'object') origRef.current = ref;
  };

  // Wrap the child in a View with our ref for measurement
  return (
    <View ref={wrapperRef}>
      {cloneElement(child, { onFocus: handleFocus, onBlur: handleBlur, ref: setRef } as any)}
    </View>
  );
};

/* --------------------------------------------------------------- */
interface Props {
  children: ReactNode;
  style?: ViewStyle;
  scrollViewStyle?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  /** iOS: distance from top of screen to the view that should stay above the keyboard */
  keyboardVerticalOffset?: number;
  /** extra scroll (negative = higher) */
  extraScrollHeight?: number;
  /** form type for positioning adjustments */
  formType?: 'standard' | 'audit' | 'todo';
}

const KeyboardAwareContainer = forwardRef<KeyboardAwareContainerRef, Props>(
  (
    {
      children,
      style,
      scrollViewStyle,
      contentContainerStyle,
      keyboardVerticalOffset = Platform.select({ ios: 90, android: 0 }),
      extraScrollHeight = 0,
      formType = 'standard',
    },
    ref
  ) => {
    const scrollRef = useRef<ScrollView>(null);
    const fieldRefs = useRef<{ [k: string]: React.RefObject<View | null> }>({});
    const accordionRefs = useRef<{ [k: string]: React.RefObject<View | null> }>({});
    const kbHeightRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const bottomPaddingAnim = useRef(new Animated.Value(150)).current;
    const pending = useRef<string | null>(null);

    const _registerRef = useCallback(
      (key: string, r: React.RefObject<View | null>) => {
        fieldRefs.current[key] = r;
      },
      []
    );

    const _registerAccordionRef = useCallback(
      (accordionId: string, r: React.RefObject<View | null>) => {
        accordionRefs.current[accordionId] = r;
      },
      []
    );

    /** --------------------------------------------------------------
     *  Core scrolling logic – always centers input in visible area above keyboard
     *  -------------------------------------------------------------- */
    const scrollToInput = useCallback(
      (key: string) => {
        InteractionManager.runAfterInteractions(() => {
          const input = fieldRefs.current[key]?.current;
          const scroll = scrollRef.current;

          if (!input || !scroll) {
            return;
          }

          // If keyboard not visible yet, store for later and let the keyboard
          // show listener handle scrolling. Scrolling before the keyboard appears
          // causes a layout shift that steals focus from the input on first tap.
          if (kbHeightRef.current === 0) {
            pending.current = key;
            return;
          }
          
          pending.current = null;

          // 1. Get the native node handle of the ScrollView. This is essential.
          const scrollNodeHandle = findNodeHandle(scroll);
          if (!scrollNodeHandle) {
            return;
          }

          // Try UIManager.measure approach first (more reliable in new RN architecture)
          const inputNodeHandle = findNodeHandle(input);

          if (inputNodeHandle && UIManager.measure) {
            UIManager.measure(inputNodeHandle, (x, y, width, height, pageX, pageY) => {
              // Get ScrollView layout to calculate relative position
              const scrollNodeHandle = findNodeHandle(scroll);
              if (scrollNodeHandle && UIManager.measure) {
                UIManager.measure(scrollNodeHandle, (scrollX, scrollY, scrollWidth, scrollHeight, scrollPageX, scrollPageY) => {
                  // Calculate the visible screen area (above keyboard)
                  const visibleAreaHeight = SCREEN_HEIGHT - kbHeightRef.current;

                  // Check if input is already in the optimal center zone (no need to scroll)
                  // Use a more conservative center zone to avoid false positives
                  const centerZoneTop = scrollPageY + (visibleAreaHeight * 0.4); // 40% from top
                  const centerZoneBottom = scrollPageY + (visibleAreaHeight * 0.6); // 60% from top

                  // Only skip if input is well within the center zone (with some tolerance)
                  const inputTop = pageY;
                  const inputBottom = pageY + height;
                  const isInCenterZone = inputTop >= centerZoneTop && inputBottom <= centerZoneBottom;

                  if (isInCenterZone) {
                    return;
                  }

                  // Determine target scroll position to center the input
                  // Adjust centering based on form type - standard forms need input positioned higher
                  const centerRatio = formType === 'standard' ? 0.35 : 0.5; // 35% for standard, 50% for audit
                  const idealCenterY = scrollPageY + (visibleAreaHeight * centerRatio);
                  const inputCenterY = pageY + (height / 2);

                  // Calculate how much to scroll to center the input
                  const scrollOffsetNeeded = inputCenterY - idealCenterY;

                  // Add current scroll position to get the target scroll position
                  let targetY = scrollOffsetRef.current + scrollOffsetNeeded;

                  // Add extra offset and ensure scroll is within bounds
                  targetY += extraScrollHeight;
                  targetY = Math.max(0, targetY);

                  // Perform the scroll
                  scroll.scrollTo({ y: targetY, animated: true });
                });
              }
            });
          } else {
            // Fallback to measureLayout approach
            if (typeof input.measureLayout !== 'function') {
              return;
            }

            input.measureLayout(
              scrollNodeHandle,
              (_x, y, _width, height) => {
                // Calculate the visible screen area.
                const visibleAreaHeight = SCREEN_HEIGHT - kbHeightRef.current;

                // Determine the target scroll position to position input at 30% from top
                const targetPositionRatio = 0.30;
                const targetY = y - (visibleAreaHeight * targetPositionRatio) + (height / 2);

                // Add any extra offset and ensure the scroll is not negative.
                const finalY = Math.max(0, targetY + extraScrollHeight);

                // Perform the scroll.
                scroll.scrollTo({ y: finalY, animated: true });
              },
              () => {
                // Failed to measure - do nothing
              }
            );
          }
        });
      },
      [extraScrollHeight]
    );

    const scrollToTop = useCallback(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: true });
      }
    }, []);

    const scrollToAccordion = useCallback((accordionId: string) => {
      InteractionManager.runAfterInteractions(() => {
        if (scrollRef.current) {
          const accordionRef = accordionRefs.current[accordionId];
          if (accordionRef?.current) {
            try {
              // Use measureInWindow to get screen position, then calculate content position
              if (typeof accordionRef.current.measureInWindow === 'function') {
                accordionRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
                  if (y !== undefined && y !== null && height > 0) {
                    // Convert screen position to content position
                    const contentY = y + scrollOffsetRef.current;
                    
                    // Calculate target scroll position - position at 15% from top
                    const desiredScreenPosition = SCREEN_HEIGHT * 0.15;
                    const targetScrollPosition = contentY - desiredScreenPosition;
                    
                    scrollRef.current?.scrollTo({ y: Math.max(0, targetScrollPosition), animated: true });
                  } else {
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }
                });
              } else if (typeof accordionRef.current.measure === 'function') {
                // Fallback to measure (provides pageY which is screen position)
                accordionRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                  if (pageY !== undefined && pageY !== null && height > 0) {
                    const contentY = pageY + scrollOffsetRef.current;
                    const desiredScreenPosition = SCREEN_HEIGHT * 0.15;
                    const targetScrollPosition = contentY - desiredScreenPosition;
                    
                    scrollRef.current?.scrollTo({ y: Math.max(0, targetScrollPosition), animated: true });
                  }
                });
              }
            } catch (error) {
              // Error measuring accordion - do nothing
            }
          }
        }
      });
    }, []);

    const scrollToOffset = useCallback((offset: number) => {
      const clampedOffset = Math.max(0, offset);
      scrollRef.current?.scrollTo({ y: clampedOffset, animated: true });
    }, []);

    const scrollByOffset = useCallback((delta: number) => {
      const newOffset = Math.max(0, scrollOffsetRef.current + delta);
      scrollRef.current?.scrollTo({ y: newOffset, animated: true });
    }, []);

    const getCurrentScrollOffset = useCallback(() => {
      return scrollOffsetRef.current;
    }, []);

    const getFieldRef = useCallback((k: string) => fieldRefs.current[k], []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToInput,
        scrollToTop,
        scrollToAccordion,
        scrollToOffset,
        scrollByOffset,
        getCurrentScrollOffset,
        getFieldRef,
        _registerRef,
        _registerAccordionRef,
      }),
      [scrollToInput, scrollToTop, scrollToAccordion, scrollToOffset, scrollByOffset, getCurrentScrollOffset, getFieldRef, _registerRef, _registerAccordionRef]
    );

    /* ---------- KEYBOARD LISTENERS ---------- */
    useEffect(() => {
      // Use keyboardWillShow on iOS for earlier response, keyboardDidShow on Android
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const show = Keyboard.addListener(showEvent, (e) => {
        const keyboardHeight = e.endCoordinates.height;
        kbHeightRef.current = keyboardHeight;
        // Animate padding so content can scroll above keyboard — no re-render
        try {
          Animated.timing(bottomPaddingAnim, {
            toValue: keyboardHeight + 120,
            duration: 200,
            useNativeDriver: false,
          }).start();
        } catch {}

        // Longer delay for Android to ensure keyboard is fully visible before scrolling
        const delay = Platform.OS === 'android' ? 350 : 150;
        setTimeout(() => {
          if (pending.current) {
            scrollToInput(pending.current);
            pending.current = null;
          }
        }, delay);
      });

      const hide = Keyboard.addListener(hideEvent, () => {
        kbHeightRef.current = 0;
        try {
          Animated.timing(bottomPaddingAnim, {
            toValue: 150,
            duration: 200,
            useNativeDriver: false,
          }).start();
        } catch {}
        pending.current = null;
      });

      return () => {
        show.remove();
        hide.remove();
      };
    }, [scrollToInput]);

    /* ---------- PENDING FOCUS (focus before keyboard appears) ---------- */
    // No longer needed as a useEffect — handled in keyboard show listener above

    return (
      <View style={[styles.root, style]}>
        <ScrollView
          ref={scrollRef}
          style={[styles.scroll, scrollViewStyle]}
          contentContainerStyle={[
            contentContainerStyle,
            {
              flexGrow: 1, // Ensures content area can grow to fill the screen
              paddingBottom: bottomPaddingAnim as any, // Animated value — no re-render
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={Platform.OS === 'ios'}
          overScrollMode="always"
          scrollEventThrottle={16}
          automaticallyAdjustKeyboardInsets={false} // Prevent automatic keyboard adjustments
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          onMomentumScrollEnd={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
});

export default KeyboardAwareContainer;
