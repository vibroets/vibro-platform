// Redux/reducer/formAssignments/formAssignmentsSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface GroupAssignment {
  formId: number;
  groupId:number;
  formSubmissionId: number | null
  assignmentUuid: string;
}

interface GroupAssignmentsState {
  data: GroupAssignment[];
}

const initialState: GroupAssignmentsState = {
  data: [],
};

const GroupAssignmentsSlice = createSlice({
  name: "groupAssignments",
  initialState,
  reducers: {
    setGroupAssignments(state, action: PayloadAction<GroupAssignment[]>) {
      state.data = action.payload;
    },
    clearGroupAssignments(state) {
      state.data = [];
    },
  },
});

export const { setGroupAssignments, clearGroupAssignments } = GroupAssignmentsSlice.actions;
export default GroupAssignmentsSlice.reducer;
