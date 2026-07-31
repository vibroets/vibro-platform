import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import taskReducer from './slices/taskSlice';
import announcementReducer from './slices/announcementSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    task: taskReducer,
    announcement: announcementReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
