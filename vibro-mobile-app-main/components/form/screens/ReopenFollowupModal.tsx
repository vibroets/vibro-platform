import React, { useCallback, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import api from '../../../services';
import { USERS_LIST } from '../../../services/constants';

const GROUPS_LIST = "/groups/";
import { textColors, typography } from '../../../styles/typography';

interface ReopenFollowupModalProps {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  onReopenSuccess: () => void;
}

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  department_details?: {
    description: string;
  };
}

interface Group {
  id: number;
  name: string;
}