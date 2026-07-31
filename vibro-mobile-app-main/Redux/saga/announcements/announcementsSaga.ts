import { call, put, select, takeLatest } from 'redux-saga/effects';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchAnnouncements,
  fetchAnnouncementsSuccess,
  fetchAnnouncementsFailure,
  patchAnnouncement,
} from '../../reducer/announcements/announcementsSlice';
import Api from '../../../services';

type StatusFlags = {
  viewed?: boolean;
  liked?: boolean;
  acknowledged?: boolean;
  notified?: boolean;
};

type StatusMap = Record<string, StatusFlags>;

const getStatusStorageKey = (userId: number | null | undefined) =>
  `announcement_status_${userId ?? 'anonymous'}`;

function* loadStatusMap(userId: number | null | undefined) {
  try {
    const raw = (yield call([AsyncStorage, 'getItem'], getStatusStorageKey(userId))) as string | null;
    if (!raw) return {} as StatusMap;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? (parsed as StatusMap) : ({} as StatusMap);
  } catch {
    return {} as StatusMap;
  }
}

function* saveStatusMap(userId: number | null | undefined, map: StatusMap) {
  try {
    yield call([AsyncStorage, 'setItem'], getStatusStorageKey(userId), JSON.stringify(map));
  } catch {
    // Ignore storage failures to avoid breaking fetch/patch flows.
  }
}

function* handleFetchAnnouncements() {
  try {
    const response = yield call(Api.get, '/announcements/', { active: true });
    const userId = (yield select((state: any) => state.user?.id)) as number | null | undefined;
    const statusMap = (yield loadStatusMap(userId)) as StatusMap;
    const data = Array.isArray(response.data)
      ? response.data.map((item: any) => {
          const saved = statusMap[String(item.id)];
          return {
            ...item,
            viewed: item.viewed ?? saved?.viewed,
            liked: item.liked ?? saved?.liked,
            acknowledged: item.acknowledged ?? saved?.acknowledged,
            notified: item.notified ?? saved?.notified,
          };
        })
      : response.data;
    yield put(fetchAnnouncementsSuccess(data));
  } catch (error: any) {
    yield put(fetchAnnouncementsFailure(error.message || 'Failed to fetch announcements'));
  }
}

function* handlePatchAnnouncement(action: ReturnType<typeof patchAnnouncement>) {
  const { id, type, value } = action.payload;
  const userId = (yield select((state: any) => state.user?.id)) as number | null | undefined;
  try {
    let urlSuffix = '';
    let payload = {};

    switch (type) {
      case 'viewed':
        urlSuffix = 'status_viewed';
        payload = { viewed: value };
        break;
      case 'acknowledged':
        urlSuffix = 'status_acknowledged';
        payload = { acknowledged: value };
        break;
      case 'notified':
        urlSuffix = 'status_notified';
        payload = { notified: value };
        break;
      case 'liked':
        urlSuffix = 'liked';
        payload = { liked: value };
        break;
    }

    if (urlSuffix) {
      yield call(Api.patch, `/announcements/${id}/${urlSuffix}/`, payload);
    }
  } catch (error: any) {
    // For now, not reverting on failure
  } finally {
    // Persist local status so viewed/liked doesn't reappear after logout/login.
    if (userId != null) {
      const statusMap = (yield loadStatusMap(userId)) as StatusMap;
      const current = statusMap[String(id)] || {};
      const next = { ...current, [type]: value } as StatusFlags;
      statusMap[String(id)] = next;
      yield saveStatusMap(userId, statusMap);
    }
  }
}

export default function* announcementsSaga() {
  yield takeLatest(fetchAnnouncements.type, handleFetchAnnouncements);
  yield takeLatest(patchAnnouncement.type, handlePatchAnnouncement);
}
