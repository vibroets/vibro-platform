import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface CreatedTask {
  id: number;
  title: string;
  user: any[];
  group: any[];
}

interface TaskState {
  createdTask: CreatedTask | null;
}

const initialState: TaskState = {
  createdTask: null,
};

const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    setCreatedTask: (state, action: PayloadAction<CreatedTask>) => {
      state.createdTask = action.payload;
    },
    clearCreatedTask: (state) => {
      state.createdTask = null;
    },
  },
});

export const selectCreatedTask = (state: RootState) => state.task.createdTask;

export const { setCreatedTask, clearCreatedTask } = taskSlice.actions;

export default taskSlice.reducer;
