// Redux/reducer/formAssignments/formAssignmentsSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FormReceived {
  formId: number;
  stageId: number;
  stageAssignmentUUID: string;
  formSubmissionId: number | null
}

interface FormReceivedState {
  data: FormReceived[];
}

const initialState: FormReceivedState = {
  data: [],
};

const formReceivedSlice = createSlice({
  name: "formReceived",
  initialState,
  reducers: {
    setFormReceived(state, action: PayloadAction<FormReceived[]>) {
      state.data = action.payload;
    },
    clearFormReceived(state) {
      state.data = [];
    },
  },
});

export const { setFormReceived, clearFormReceived } = formReceivedSlice.actions;
export default formReceivedSlice.reducer;
