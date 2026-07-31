import Accordion from "@/components/Accordion";
import { fetchFormReceived } from "@/Redux/actions/formReceivedActions";
import api from "@/services";
import { RECEIVED } from "@/services/constants";
import { RootState } from "@/store";
import { Received, ReceivedData } from "@/types/received";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import FileList from "../ListItems/ReceivedListItems/FileList";

const SLOW_REFRESH_LOADER_DELAY_MS = 400;

const getReceivedSortTime = (item: {
  submission_initiated_on?: string | null;
  completed_on?: string | null;
  form_submission_id?: string | number | null;
  id?: string | number | null;
}) => {
  const raw = item.submission_initiated_on || item.completed_on;
  if (raw) {
    const parsed = new Date(String(raw)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const submissionId = Number(item.form_submission_id ?? item.id);
  return Number.isFinite(submissionId) ? submissionId : 0;
};

export default function ReceivedForm() {
  const user = useSelector((state: RootState) => state.user);
  const [receivedData, setReceivedData] = useState<ReceivedData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatch = useDispatch();

  const getReceivedForms = async ({ delayedLoader = false }: { delayedLoader?: boolean } = {}) => {
    let didShowLoader = false;
    try {
      if (delayedLoader) {
        if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = setTimeout(() => {
          didShowLoader = true;
          setLoading(true);
        }, SLOW_REFRESH_LOADER_DELAY_MS);
      } else {
        didShowLoader = true;
        setLoading(true);
      }
      const response = await api.get(`${RECEIVED}${user.id}/`);
      let rawData = response.data;
      dispatch(fetchFormReceived(rawData));

      // NOTE: Removed filtering of todo workflow forms for Forms RECEIVED tab
      // This allows multi-stage forms to appear in RECEIVED after stage submissions
      // The To-Do tab handles its own workflow display

      // Show only stages that are currently pending for the user.
      rawData = (rawData || []).filter(
        (item: any) => item?.is_stage_submission_pending === true
      );

      const grouped: { [formId: string]: ReceivedData } = {};

      rawData.forEach((item: any) => {
        // Skip if no form_submission_id
        if (!item.form_submission_id) return;

        const form = item.form;
        const formId = String(form.id);

        if (!grouped[formId]) {
          grouped[formId] = {
            id: formId,
            title: form.title,
            form_type: form.form_type,
            received: [],
          };
        }

        grouped[formId].received.push({
          id: String(item.form_submission_id),
          submission_initiated_on:
            item.submission_initiated_on ||
            item.created_on ||
            item.created_at ||
            form.created_on ||
            form.created_at,
          submission_initiated_stage: item.stage_order,
          submission_initiated_by: form.created_by,
          is_completed: !item.is_form_submission_pending,
          completed_by: null,
          completed_on: null,

          is_form_submission_pending: item.is_form_submission_pending,
          is_stage_submission_pending: item.is_stage_submission_pending,
          stage_assignment_id: item.stage_assignment_id,
          stage_assignment_uuid: item.assignment_uuid,
          stage_id: item.stage_id,
          stage_name: item.stage_name,
          stage_order: item.stage_order,
          form_submission_id: item.form_submission_id,
        });
      });

      const finalData = Object.values(grouped)
        .map((formGroup) => ({
          ...formGroup,
          received: [...formGroup.received].sort((a, b) => {
            const timeDiff = getReceivedSortTime(b) - getReceivedSortTime(a);
            if (timeDiff !== 0) return timeDiff;
            return Number(b.stage_order || 0) - Number(a.stage_order || 0);
          }),
        }))
        .sort((a, b) => {
          const aLatest = Math.max(...a.received.map(getReceivedSortTime), 0);
          const bLatest = Math.max(...b.received.map(getReceivedSortTime), 0);
          return bLatest - aLatest;
        });
      setReceivedData(finalData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch received forms");
    } finally {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
      if (didShowLoader) setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await getReceivedForms();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    getReceivedForms();
  }, []);

  // Automatically refresh when tab becomes active (user navigates to RECEIVED tab)
  useFocusEffect(
    useCallback(() => {
      getReceivedForms({ delayedLoader: true });
      return () => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
          loaderTimeoutRef.current = null;
        }
      };
    }, [])
  );

  // NOTE: Removed real-time Redux watching to prevent conflicts with manual refresh
  // Tab focus effect now handles automatic refreshes when user navigates to the tab

  const routeFormsFileList = (formId: string, submissionId: string, stageId: string, formTitle?: string) => {
    router.push({
      pathname: "/(app)/(tabs)/forms/multi-stage-form",
      params: { formId, submissionId, stageId, formTitle, sourceScreen: 'received' },
    });
  };

  const renderItem = ({ item }: { item: ReceivedData }) => {
    if (!item.received || item.received.length === 0) return null;
    const itemId = String(item.id);
    return (
      <Accordion
        title={item.title}
        containerStyle={styles.accordionContainer}
        headerStyle={styles.accordionHeader}
        iconColor="#6200ee"
        expanded={expandedFormId === itemId}
        onPress={(expanded) => {
          setExpandedFormId(expanded ? itemId : null);
        }}
      >
        {item.received
          .filter(
            (received: Received) =>
              received.is_stage_submission_pending === true
          )
          .map(
            (received: Received) =>
                <FileList
                  key={received.stage_assignment_id}
                  items={received}
                  formId={item.id}
                  formTitle={item.title}
                  onClick={routeFormsFileList}
                />
          )}
      </Accordion>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#6200ee" />
      ) : (
        <FlatList
          data={receivedData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No received forms available.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  accordionContainer: {
    marginBottom: 10,
  },
  accordionHeader: {
    backgroundColor: "#e3f2fd",
  },
  emptyText: {
    padding: 15,
    textAlign: "center",
    color: "gray",
    fontStyle: "italic",
  },
});
