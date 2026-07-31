import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./index";
import { FORM, GETFORMSUBMISSIONDETAILS, FORM_STAGE_METADATA, FORM_FAST } from "./constants";

const METADATA_PREFIX = "form_meta_";

// In-memory cache for stage data — no AsyncStorage size limits
// Key: `${formId}_${submissionId || 'new'}_stage_${order}` → form data object
const memoryCache = new Map<string, any>();

// Track which orders are loaded in memory
const memoryCacheOrders = new Map<string, Set<number>>();

interface StageMeta {
  id: number;
  name: string;
  order: number;
  stage_uuid?: string;
  is_completed?: boolean;
}

interface GroupMeta {
  id: number;
  name: string;
  order: number;
  group_uuid?: string;
}

interface FormMetadata {
  form_id: number;
  form_title: string;
  form_type: string;
  stages: StageMeta[];
  audit_groups: GroupMeta[];
}

function getMetaCacheKey(formId: string | number, submissionId?: string | number): string {
  return `${METADATA_PREFIX}${formId}_${submissionId || 'new'}`;
}

function getMemoryKey(formId: string | number, order: number, submissionId?: string | number): string {
  return `${formId}_${submissionId || 'new'}_stage_${order}`;
}

function getOrdersKey(formId: string | number, submissionId?: string | number): string {
  return `${formId}_${submissionId || 'new'}`;
}

/**
 * Fetch lightweight stage/group metadata from backend.
 */
export async function fetchFormMetadata(formId: string | number): Promise<FormMetadata | null> {
  try {
    const response = await api.get(`${FORM_STAGE_METADATA}${formId}/stage-metadata/`);
    return response.data;
  } catch (error: any) {
    console.error("[formCacheService] fetchFormMetadata failed:", formId, error?.message, error?.response?.status);
    return null;
  }
}

/**
 * Load cached metadata from AsyncStorage (tiny — safe to store).
 */
export async function loadCachedMetadata(formId: string | number, submissionId?: string | number): Promise<FormMetadata | null> {
  try {
    const key = getMetaCacheKey(formId, submissionId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save metadata to AsyncStorage (tiny — safe to store).
 */
export async function saveCachedMetadata(formId: string | number, metadata: FormMetadata, submissionId?: string | number): Promise<void> {
  try {
    const key = getMetaCacheKey(formId, submissionId);
    await AsyncStorage.setItem(key, JSON.stringify(metadata));
  } catch {
    // Silent fail
  }
}

/**
 * Fetch a SINGLE stage/group from backend with full question data.
 * Uses ?groups=N query param — always 1 group at a time to keep response small.
 */
export async function fetchFormStages(
  formId: string | number,
  orders: number[],
  submissionId?: string | number,
  groupId?: string | number
): Promise<any | null> {
  try {
    const params: string[] = [];
    if (orders.length > 0) params.push(`groups=${orders.join(',')}`);
    if (groupId) params.push(`group_id=${groupId}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    let url: string;
    if (submissionId) {
      url = `${GETFORMSUBMISSIONDETAILS}${formId}/${submissionId}${queryString}`;
    } else {
      url = `${FORM_FAST}${formId}/fast/${queryString}`;
    }
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    console.error("[formCacheService] fetchFormStages failed:", { formId, orders, submissionId, error: error?.message, status: error?.response?.status });
    // Fallback to old endpoint if fast endpoint fails
    try {
      const groupsParam = orders.length > 0 ? `?groups=${orders.join(',')}` : '';
      let url: string;
      if (submissionId) {
        url = `${GETFORMSUBMISSIONDETAILS}${formId}/${submissionId}${groupsParam}`;
      } else {
        url = `${FORM}${formId}/${groupsParam}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (fallbackError: any) {
      console.error("[formCacheService] fetchFormStages fallback also failed:", { formId, orders, error: fallbackError?.message, status: fallbackError?.response?.status });
      return null;
    }
  }
}

/**
 * Save a stage/group to in-memory cache (no size limits).
 */
export async function saveCachedStage(formId: string | number, order: number, stageData: any, submissionId?: string | number): Promise<void> {
  try {
    const key = getMemoryKey(formId, order, submissionId);
    memoryCache.set(key, stageData);
    
    // Track loaded orders
    const ordersKey = getOrdersKey(formId, submissionId);
    if (!memoryCacheOrders.has(ordersKey)) {
      memoryCacheOrders.set(ordersKey, new Set());
    }
    memoryCacheOrders.get(ordersKey)!.add(order);
  } catch {
    // Silent fail
  }
}

/**
 * Load a cached stage/group from in-memory cache.
 */
export async function loadCachedStage(formId: string | number, order: number, submissionId?: string | number): Promise<any | null> {
  try {
    const key = getMemoryKey(formId, order, submissionId);
    return memoryCache.get(key) || null;
  } catch {
    return null;
  }
}

/**
 * Get all cached stage orders for a form (from in-memory cache).
 */
export async function getCachedStageOrders(formId: string | number, submissionId?: string | number): Promise<number[]> {
  try {
    const ordersKey = getOrdersKey(formId, submissionId);
    const orders = memoryCacheOrders.get(ordersKey);
    if (!orders) return [];
    return Array.from(orders).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/**
 * Assemble full form data from in-memory cached stages.
 */
export async function assembleFormFromCache(
  formId: string | number,
  _totalOrders: number[],
  submissionId?: string | number
): Promise<{ stages: any[]; auditGroups: any[]; formType: string } | null> {
  try {
    const metadata = await loadCachedMetadata(formId, submissionId);
    if (!metadata) return null;

    const isAudit = metadata.form_type === 'audit';
    const stageKey = isAudit ? 'audit_groups' : 'stages';
    const items = metadata[stageKey] || [];
    const stages: any[] = [];
    const auditGroups: any[] = [];

    for (const item of items) {
      const cached = await loadCachedStage(formId, item.order, submissionId);
      if (cached) {
        if (isAudit) {
          const groupData = cached.audit_group?.find((g: any) => g.order === item.order);
          if (groupData) auditGroups.push(groupData);
        } else {
          const stageData = cached.stages?.find((s: any) => s.order === item.order);
          if (stageData) stages.push(stageData);
        }
      }
    }

    if (stages.length === 0 && auditGroups.length === 0) return null;

    return { stages, auditGroups, formType: metadata.form_type };
  } catch {
    return null;
  }
}

/**
 * Clear all cached data for a specific form (in-memory + AsyncStorage metadata).
 */
export async function clearFormCache(formId: string | number, submissionId?: string | number): Promise<void> {
  try {
    const subId = submissionId || 'new';
    
    // Clear in-memory cache
    const prefix = `${formId}_${subId}_stage_`;
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
    memoryCacheOrders.delete(`${formId}_${subId}`);
    
    // Clear AsyncStorage metadata
    const metaKey = getMetaCacheKey(formId, submissionId);
    await AsyncStorage.removeItem(metaKey);
  } catch {
    // Silent fail
  }
}

/**
 * Check if cache exists (in-memory).
 */
export async function isCacheFresh(_formId: string | number, _submissionId?: string | number): Promise<boolean> {
  // In-memory cache is always "fresh" while app is running
  return true;
}

/**
 * Update cache timestamp (no-op for in-memory cache).
 */
export async function updateCacheTimestamp(_formId: string | number, _submissionId?: string | number): Promise<void> {
  // No-op — in-memory cache doesn't need timestamps
}

/**
 * Clear all in-memory cache (call on app exit/logout).
 */
export function clearAllMemoryCache(): void {
  memoryCache.clear();
  memoryCacheOrders.clear();
}

