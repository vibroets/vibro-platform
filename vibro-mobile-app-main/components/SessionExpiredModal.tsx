import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SessionExpiredModalProps {
  visible: boolean;
  onPress: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  visible,
  onPress,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onPress}
    >
      {/* Dark semi-transparent backdrop */}
      <View style={styles.overlay}>
        {/* Center the card */}
        <View style={styles.centered}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.cardWrapper}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
                <View style={styles.viewContainer}>
                  <View style={styles.circularContainer}>
                    <Text style={styles.largeBoldText}>V</Text>
                  </View>
                  <Text style={styles.headingText}>Session Expired</Text>
                  <Text style={styles.headingSmallText}>Please sign in again to continue</Text>
                </View>

                <TouchableOpacity
                  style={styles.blueRoundedContainer}
                  onPress={onPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',          // <-- center vertically
    alignItems: 'center',              // <-- center horizontally
  },

  /* NEW – wrapper that forces the card to stay inside the safe area */
  centered: {
    width: '100%',
    paddingHorizontal: 20,
    maxWidth: 340,                     // <-- max width of the popup
  },

  cardWrapper: {
    // no flex:1 → the card will only take the space it needs
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  /* NEW – the actual white/blue card */
  card: {
    backgroundColor: '#2196f3',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 24,
    // optional shadow for iOS/Android
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  viewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },

  circularContainer: {
    width: 70,
    height: 70,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#bfdbff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  largeBoldText: {
    fontSize: 33,
    fontWeight: 'bold',
    color: 'white',
  },

  headingText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },

  headingSmallText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },

  blueRoundedContainer: {
    marginTop: 10,
    backgroundColor: '#cee0f8ff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },

  btnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
});