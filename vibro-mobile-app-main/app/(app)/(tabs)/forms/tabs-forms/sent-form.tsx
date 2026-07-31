import Accordion from "@/components/Accordion";
import api from "@/services";
import { backgroundSyncService } from "@/services/backgroundSyncService";
import { GETALLASSIGNFORMS, GETSENTFORMS } from "@/services/constants";
import { networkService } from "@/services/networkService";
import { RootState } from "@/store";
import { SubmissionData } from "@/types/sent";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import FileList from "../ListItems/SentListItems/FileList";

type MainFormTaskMeta = {
  id: string;
  main_form_location?: string;
  main_form_title?: string;
};

const MAIN_FORM_BY_TASK_CACHE: Record<string, MainFormTaskMeta> = {};

const SLOW_REFRESH_LOADER_DELAY_MS = 400;

type SentFormProps = {
  searchQuery?: string;
};

export default function SentForm({ searchQuery = "" }: SentFormProps) {
  const user = useSelector((state: RootState) => state.user);
  const [loading, setLoading] = useState<boolean>(false);
  const [sentData, setSentData] = useState<SubmissionData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [mainFormByTaskId, setMainFormByTaskId] = useState<Record<string, MainFormTaskMeta>>(MAIN_FORM_BY_TASK_CACHE);
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSentForms = useCallback(async ({ delayedLoader = false }: { delayedLoader?: boolean } = {}) => {
    let didShowLoader = false;
    try {
      if (!user?.id) return;
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
      const response = await api.get(`${GETALLASSIGNFORMS}`);
      const forms = response.data.map((form: any) => form.id);

      const submissions = await api.get(`${GETSENTFORMS}${user.id}/submission-history/`);
      setSentData(submissions.data);

      // Populate mainFormByTaskId for location information
      const updates: Record<string, MainFormTaskMeta> = {};
      submissions.data.forEach((group: any) => {
        group.submissions.forEach((submission: any) => {
          const taskIdRaw = submission?.task_id ?? submission?.followup_task_id;
          if (taskIdRaw && !updates[taskIdRaw]) {
            updates[taskIdRaw] = {
              id: String(group.form.id),
              main_form_location: submission.main_form_location || submission.location_name || submission.location,
              main_form_title: submission.main_form_title || group.form.title,
            };
          }
        });
      });
      setMainFormByTaskId((prev) => ({ ...prev, ...updates }));

      // Log sample data for debugging
      console.log("Sample submission data:", submissions.data[0]?.submissions[0]);
      console.log("mainFormByTaskId:", mainFormByTaskId);
    } catch (error: any) {
    } finally {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
      if (didShowLoader) setLoading(false);
    }
  }, [user?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await getSentForms();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    getSentForms();
  }, [getSentForms]);

  // Automatically refresh when tab becomes active (user navigates to SENT tab)
  useFocusEffect(
    useCallback(() => {
      getSentForms({ delayedLoader: true });
      return () => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
          loaderTimeoutRef.current = null;
        }
      };
    }, [getSentForms])
  );

  // Refresh sent list when network comes back online and after background sync
  useEffect(() => {
    let isMounted = true;
    let lastOnline: boolean | null = null;
    const unsubscribe = networkService.addListener(async (status) => {
      const isOnline = status.isConnected && status.isInternetReachable !== false;
      if (lastOnline === isOnline) return;
      lastOnline = isOnline;

      if (!isOnline || !user?.id) return;

      try {
        await backgroundSyncService.forceSync();
      } catch (error) {
      }

      // Small delay to allow backend to finalize submissions before fetching
      setTimeout(() => {
        if (isMounted) getSentForms({ delayedLoader: true });
      }, 800);
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [getSentForms, user?.id]);

  // // Automatically refresh when tab becomes active (user navigates to SENT tab)
  // useFocusEffect(
  //   useCallback(() => {
  //     getSentForms();
  //   }, [])
  // );

  const routeFormsFileList = (formId: any, submissionId: any, formType:any, formTitle?: string, summaryData?: any[], submission?: any) => {

    router.push({
      pathname: "/(app)/(tabs)/forms/multi-stage-form",
      params: { formId: formId, submissionId: submissionId, formType:formType, formTitle, sourceScreen: 'sent', auditSubmissionData: submission ? JSON.stringify(submission) : undefined },
    });
  };

  const normalizedQuery = (searchQuery || "").trim().toLowerCase();

  const renderItem = ({ item }: { item: SubmissionData }) => {
    const itemId = String(item.form.id);

    const formTitle = String(item.form?.title ?? "").toLowerCase();

    // Filter submissions by query (form title match OR submission/file match)
    const filteredSubmissions = !normalizedQuery
      ? item.submissions
      : item.submissions.filter((submission: any) => {
          const cp = submission?.checkpoint_summary;
          const ft = submission?.followup_tasks_summary;
          const submissionText = (
            [
              formTitle,
              String(item.form?.id ?? ""),
              String(submission?.task_name ?? ""),
              String(submission?.submission_initiated_on ?? ""),
              String(submission?.submitted_by ?? ""),
              String(submission?.created_by ?? ""),
              String(submission?.status ?? ""),
              String(submission?.task_status ?? ""),
              String(submission?.source ?? ""),
              String(submission?.source_ref ?? ""),
              cp ? `ok ${cp.ok} corrected ${cp.not_ok_corrected} open ${cp.not_ok_not_closed}` : "",
              ft ? `followup ${ft.total} completed ${ft.completed} in progress ${ft.in_progress} not started ${ft.not_started}` : "",
            ]
              .filter(Boolean)
              .join(" ")
          ).toLowerCase();

          return submissionText.includes(normalizedQuery);
        });

    // If accordion doesn't have any matching submissions, hide it.
    if (normalizedQuery && filteredSubmissions.length === 0) return null;

    const count = filteredSubmissions.length;
    const accordionTitle = (
      <View style={styles.accordionTitleRow}>
        <Text style={styles.accordionTitleText} numberOfLines={1}>{item.form.title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      </View>
    );

    return (
      <Accordion
        title={accordionTitle}
        containerStyle={styles.accordionContainer}
        headerStyle={styles.accordionHeader}
        contentStyle={styles.accordionContent}
        iconColor="#fff"
        iconSize={20}
        expanded={expandedFormId === itemId}
        onPress={(expanded) => {
          setExpandedFormId(expanded ? itemId : null);
        }}
      >
        {filteredSubmissions.map((submission: any) => (
          <FileList
            key={submission.form_submission_id}
            items={submission}
            formId={item.form.id}
            formType={item.form?.form_type}
            formTitle={item.form.title}
            formPrefix={item.form.prefix}
            onClick={routeFormsFileList}
            mainFormByTaskId={mainFormByTaskId}
          />
        ))}
      </Accordion>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2196f3" />
      ) : (
        <FlatList
          data={sentData}
          keyExtractor={(item) => item.form.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No sent forms available.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
  },
  accordionContainer: {
    marginBottom: 6,
    borderRadius: 8,
    marginVertical: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  accordionHeader: {
    backgroundColor: "#2196f3",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  accordionContent: {
    padding: 0,
    paddingTop: 4,
    paddingBottom: 4,
  },
  accordionTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  accordionTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  emptyText: {
    padding: 15,
    textAlign: "center",
    color: "gray",
    fontStyle: "italic",
  },
});
