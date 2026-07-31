/* eslint-disable import/no-named-as-default-member */
import api from "@/services";
import { router } from "expo-router";
import { useLocalSearchParams } from "expo-router/build/hooks";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import FileList from "./ListItems/FileList";
import FolderItem from "./ListItems/FolderList";
import { Form } from "./tabs-forms/new-form";

type FolderContentResponse = {
  folder?: any;
  subfolders?: any[];
  forms?: any[];
};

type FolderListRow =
  | { rowType: "folder"; key: string; item: any }
  | { rowType: "form"; key: string; item: any };

export default function FolderList() {
  const {
    folderId,
    // folderName
  } = useLocalSearchParams();

  const [folders, setFolders] = useState<any[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      if (a.sort.idStr !== b.sort.idStr)
        return b.sort.idStr.localeCompare(a.sort.idStr);
      return a.index - b.index;
    });
    return withIndex.map((entry) => entry.item);
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
      if (a.sort.idStr !== b.sort.idStr)
        return b.sort.idStr.localeCompare(a.sort.idStr);
      return a.index - b.index;
    });
    return withIndex.map((entry) => entry.item);
  };

  const normalizeFolderPayload = (payload: any): FolderContentResponse => {
    // Backward compatibility: old endpoint returned form list directly
    if (Array.isArray(payload)) {
      return { subfolders: [], forms: payload };
    }

    const subfolders = Array.isArray(payload?.subfolders)
      ? payload.subfolders
      : Array.isArray(payload?.folders)
        ? payload.folders
        : [];

    const formsList = Array.isArray(payload?.forms)
      ? payload.forms
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    return {
      folder: payload?.folder,
      subfolders,
      forms: formsList,
    };
  };

  const getFolderFormsForUser = async () => {
    try {
      // New backend shape: { folder, subfolders, forms }
      const response = await api.get(`/forms/folder/${folderId}/`);
      const normalized = normalizeFolderPayload(response.data);
      setFolders(sortFoldersByNewest(normalized.subfolders || []));
      // Filter out archived forms
      const filteredForms = (normalized.forms || []).filter((form: any) => {
        const isArchived = form?.is_archived === true || form?.archived === true;
        return !isArchived;
      });
      setForms(sortFormsByNewest(filteredForms));
    } catch (error: any) {
      // Fallback to old endpoint (forms only) to preserve prior behavior
      try {
        const fallback = await api.get(`/form/assigned/folder/${folderId}/`);
        const fallbackForms = Array.isArray(fallback.data) ? fallback.data : [];
        // Filter out archived forms
        const filteredFallbackForms = fallbackForms.filter((form: any) => {
          const isArchived = form?.is_archived === true || form?.archived === true;
          return !isArchived;
        });
        setFolders([]);
        setForms(sortFormsByNewest(filteredFallbackForms));
        return;
      } catch {
        if (error?.status === 403) {
          setFolders([]);
          setForms([]);
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const routeFormsFolder = (folder: any) => {
    router.push({
      pathname: "/(app)/(tabs)/forms/folder-list",
      params: {
        folderId: folder?.id,
      },
    });
  };

  const routeFormsFileList = (form: any) => {
    const resolvedFormId = form?.id ?? form?.form?.id;
    const resolvedFormTitle = form?.title ?? form?.form?.title;
    const resolvedFormType =
      form?.form_type ??
      form?.type ??
      form?.form?.form_type ??
      form?.form?.type;

    router.push({
      pathname: "/(app)/(tabs)/forms/multi-stage-form",
      params: {
        formTitle: resolvedFormTitle,
        formId: resolvedFormId,
        formType: resolvedFormType,
        sourceScreen: "new",
      },
    });
  };

  useEffect(() => {
    getFolderFormsForUser();
  }, []);

  const refreshControl = async () => {
    setRefreshing(true);
    try {
      await getFolderFormsForUser();
    } finally {
      setRefreshing(false);
    }
  };

  const rows = useMemo<FolderListRow[]>(() => {
    const folderRows = (folders || []).map((item: any, index: number) => ({
      rowType: "folder" as const,
      key: `folder-${String(item?.id ?? index)}`,
      item,
    }));

    const formRows = (forms || []).map((item: any, index: number) => ({
      rowType: "form" as const,
      key: `form-${String(item?.id ?? item?.form?.id ?? index)}`,
      item,
    }));

    return [...folderRows, ...formRows];
  }, [folders, forms]);

  return (
    <>
      {!loading ? (
        <View style={styles.container}>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            refreshing={refreshing}
            onRefresh={refreshControl}
            renderItem={({ item }) => {
              if (item.rowType === "folder") {
                return <FolderItem items={item.item} onClick={routeFormsFolder} />;
              }
              return <FileList items={item.item} onClick={routeFormsFileList} />;
            }}
          />
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={"large"} color="#2196f3" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  folderContent: {
    fontSize: 16,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
