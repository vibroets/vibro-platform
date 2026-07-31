// Redux/sagas/formAssignmentsSaga.ts
import { put, takeLatest } from "redux-saga/effects";
import { setFormAssignments } from "@/Redux/reducer/formAssignments/formAssignmentsSlice";
import { FETCH_FORM_ASSIGNMENTS } from "@/Redux/actions/formAssignmentActions";

function* fetchFormAssignmentsSaga(action: any): Generator<any, void, any> {
  try {
    const rawData = action.payload;


    const transformedData = rawData.map((item: any) => ({
      formId: item.form.id,
      stageId: item.stage_id,
      stageAssignmentUUID: item.assignment_uuid,
      formSubmissionId: item.form_submission_id,
    }));

    yield put(setFormAssignments(transformedData));
  } catch (error: any) {
  }
}

export default function* formAssignmentsSaga() {
  yield takeLatest(FETCH_FORM_ASSIGNMENTS, fetchFormAssignmentsSaga);
}
