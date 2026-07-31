import { ALL_FORMS, FOLDERS } from "@/constants/forms";
import { fetchFormAssignments } from "@/Redux/actions/formAssignmentActions";
import { fetchGroupAssignments } from "@/Redux/actions/groupAssignmentAction";
import * as Api from "@/services";
import {
  GETALLASSIGNEDSTAGESACCESSID,
  GETALLASSIGNFORMS,
  GETAUDITFORMGROUPASSINGEDUUID
} from "@/services/constants";
import { RootState } from "@/store";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import FileList from "../ListItems/FileList";
import FolderList from "../ListItems/FolderList";

const SLOW_REFRESH_LOADER_DELAY_MS = 400;

export interface Folder {
  id: string;
  name: string;
}
export interface Form {
  id: string;
  title: string;
  type?: string;
}

type NewFormProps = {
  searchQuery?: string;
};

type NewFormTabKey = "folders" | "forms";

export default function NewForm({ searchQuery = "" }: NewFormProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [formRefreshing, setFormRefreshing] = useState(false);
  const [folderRefreshing, setFolderRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<NewFormTabKey>("folders");
  const loaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch();

  const routeFormsFolder = (folder: any) => {
    router.push({
      pathname: "/(app)/(tabs)/forms/folder-list",
      params: { folderName: folder.name, folderId: folder.id },
    });
  };

  const routeFormsFileList = (form: any) => {
    router.push({
      pathname: "/(app)/(tabs)/forms/multi-stage-form",
      params: { formTitle: form.title, formId: form.id, formType: form.type, sourceScreen: 'new' },
    });
  };

  const getFolderSortInfo = (folder: any) => {
    const raw =
      folder?.created_at ||
      folder?.created_on ||
      folder?.updated_at ||
      folder?.updated_on ||
      null;
    const time = new Date(raw || 0).getTime();
    const rawId = folder?.id ?? "";
    const idNum = Number(rawId);
    return {
      time: Number.isFinite(time) ? time : 0,
      idNum: Number.isFinite(idNum) ? idNum : 0,
      idStr: String(rawId ?? ""),
    };
  };

  const sortFoldersByNewest = (items: any[]) => {
    const withIndex = items.map((item, index) => ({
      item,
      index,
      sort: getFolderSortInfo(item),
    }));
    withIndex.sort((a, b) => {
      if (a.sort.time !== b.sort.time) return b.sort.time - a.sort.time;
      if (a.sort.idNum !== b.sort.idNum) return b.sort.idNum - a.sort.idNum;
      if (a.sort.idStr !== b.sort.idStr) return b.sort.idStr.localeCompare(a.sort.idStr);
      return a.index - b.index;
    });
    return withIndex.map((entry) => entry.item);
  };

const getOrgFolder = async () => {
  try {
    const response = (await Api.get("folder/")) as any;
    setFolders(sortFoldersByNewest(Array.isArray(response) ? response : []));
  } catch (error: any) {
    if (error?.status === 403) {
      setFolders([]);
      return;
    }
  }
};



  const getFormSortInfo = (form: any) => {
    const raw =
      form?.created_at ||
      form?.created_on ||
      form?.updated_at ||
      form?.updated_on ||
      form?.form?.created_at ||
      form?.form?.created_on ||
      form?.form?.updated_at ||
      form?.form?.updated_on ||
      null;
    const time = new Date(raw || 0).getTime();
    const rawId = form?.id ?? form?.form?.id ?? "";
    const idNum = Number(rawId);
    return {
      time: Number.isFinite(time) ? time : 0,
      idNum: Number.isFinite(idNum) ? idNum : 0,
      idStr: String(rawId ?? ""),
    };
  };

  const sortFormsByNewest = (items: any[]) => {
    const withIndex = items.map((item, index) => ({
      item,
      index,
      sort: getFormSortInfo(item),
    }));
    withIndex.sort((a, b) => {
      if (a.sort.time !== b.sort.time) return b.sort.time - a.sort.time;
      if (a.sort.idNum !== b.sort.idNum) return b.sort.idNum - a.sort.idNum;
      if (a.sort.idStr !== b.sort.idStr) return b.sort.idStr.localeCompare(a.sort.idStr);
      return a.index - b.index;
    });
    return withIndex.map((entry) => entry.item);
  };

  const getAllFormsForUser = async () => {
    try {
      const response = (await Api.get(`${GETALLASSIGNFORMS}`)) as any;
      setForms(sortFormsByNewest(Array.isArray(response) ? response : []));
    } catch (error: any) {
      if (!error.message?.includes("Session expired")) {
      }
    }
  };

  const getAllAssingedStageAccessId = async () => {
    try {
      const response = (await Api.get(
        `${GETALLASSIGNEDSTAGESACCESSID}${user.id}/`
      )) as any;
      dispatch(fetchFormAssignments(response));
    } catch (error: any) {
      if (!error.message?.includes("Session expired")) {
      }
    }
  };

  const getAuditGroupAssignedUuid = async () => {
    try {
      const response = (await Api.get(
        `${GETAUDITFORMGROUPASSINGEDUUID}`
      )) as any;
      dispatch(fetchGroupAssignments(response));
    } catch (error: any) {
    }
  };

  const fetchData = async ({ delayedLoader = false }: { delayedLoader?: boolean } = {}) => {
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

      await getOrgFolder();
      await getAllFormsForUser();
      await getAllAssingedStageAccessId();
      await getAuditGroupAssignedUuid();
    } catch (error: any) {
    } finally {
      if (loaderTimeoutRef.current) {
        clearTimeout(loaderTimeoutRef.current);
        loaderTimeoutRef.current = null;
      }
      if (didShowLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData({ delayedLoader: true });
      return () => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
          loaderTimeoutRef.current = null;
        }
      };
    }, [])
  );

const onFolderRefresh = useCallback(async () => {
  if (user?.role === "location_leader") {
    setFolders([]);
    return;
  }

  setFolderRefreshing(true);
  try {
    const response = (await Api.get('folder/')) as any;
    setFolders(sortFoldersByNewest(Array.isArray(response) ? response : []));
    await getAllAssingedStageAccessId();
    await getAuditGroupAssignedUuid();
  } catch (error: any) {
  if (error?.status === 403) {
    }
  } finally {
    setFolderRefreshing(false);
  }
}, [user]);


  const onFormRefresh = useCallback(async () => {
    setFormRefreshing(true);
    await getAllFormsForUser();
    await getAllAssingedStageAccessId();
    await getAuditGroupAssignedUuid();
    setFormRefreshing(false);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const foldersWithSearch = useMemo(
    () =>
      folders.map((folder) => ({
        item: folder,
        nameLower: (folder.name ?? "").toLowerCase(),
      })),
    [folders]
  );

  const formsWithSearch = useMemo(
    () =>
      forms.map((form) => {
        const title = (form as any)?.form?.title ?? form.title ?? "";
        return {
          item: form,
          titleLower: title.toLowerCase(),
        };
      }),
    [forms]
  );

  const filteredFolders = useMemo(() => {
    if (!normalizedQuery) return folders;
    return foldersWithSearch
      .filter((entry) => entry.nameLower.includes(normalizedQuery))
      .map((entry) => entry.item);
  }, [folders, foldersWithSearch, normalizedQuery]);

  const filteredForms = useMemo(() => {
    if (!normalizedQuery) return forms;
    return formsWithSearch
      .filter((entry) => entry.titleLower.includes(normalizedQuery))
      .map((entry) => entry.item);
  }, [forms, formsWithSearch, normalizedQuery]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableTab
          label={FOLDERS}
          active={activeTab === "folders"}
          onPress={() => setActiveTab("folders")}
        />
        <TouchableTab
          label={ALL_FORMS}
          active={activeTab === "forms"}
          onPress={() => setActiveTab("forms")}
        />
      </View>
      <View style={styles.content}>
        {activeTab === "folders" ? (
          <FlatList
            data={filteredFolders}
            keyExtractor={(item) => item.id}
            refreshing={folderRefreshing}
            onRefresh={onFolderRefresh}
            renderItem={({ item }) => (
              <FolderList items={item} onClick={routeFormsFolder} />
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                You don't have any assigned folders.
              </Text>
            }
          />
        ) : (
          <FlatList
            data={filteredForms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 50 }}
            refreshing={formRefreshing}
            onRefresh={onFormRefresh}
            renderItem={({ item }) => (
              <FileList items={item} onClick={routeFormsFileList} />
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                You don't have any assigned forms.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

function TouchableTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabWrap, active ? styles.tabWrapActive : null]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  tabsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
  tabWrap: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    alignItems: "center",
  },
  tabWrapActive: {
    borderBottomColor: "#FF5733",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  tabTextActive: {
    color: "#FF5733",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    padding: 15,
    textAlign: "center",
    color: "gray",
    fontStyle: "italic",
  },
});
