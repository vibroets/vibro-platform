// Redux/reducer/formAssignments/formAssignmentsSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FormAssignment {
  formId: number;
  stageId: number;
  stageAssignmentUUID: string;
  formSubmissionId: number | null
}

interface FormAssignmentsState {
  data: FormAssignment[];
}

const initialState: FormAssignmentsState = {
  data: [],
};

const formAssignmentsSlice = createSlice({
  name: "formAssignments",
  initialState,
  reducers: {
    setFormAssignments(state, action: PayloadAction<FormAssignment[]>) {
      state.data = action.payload;
    },
    clearFormAssignments(state) {
      state.data = [];
    },
  },
});

export const { setFormAssignments, clearFormAssignments } = formAssignmentsSlice.actions;
export default formAssignmentsSlice.reducer;
