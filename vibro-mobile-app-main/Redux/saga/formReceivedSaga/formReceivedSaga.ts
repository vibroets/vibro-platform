import { put, takeLatest } from "redux-saga/effects";
import { FETCH_FORM_RECEIVED } from "@/Redux/actions/formReceivedActions";
import { setFormReceived } from "@/Redux/reducer/formReceived/formReceivedSlice";

function* fetchFormReceivedSaga(action: any): Generator<any, void, any> {
  try {
    const rawData = Array.isArray(action.payload) ? action.payload : [];
    if (rawData.length === 0) {
    }
    const transformedData = rawData.map((item: any) => ({
      formId: item.form?.id ?? null,
      stageId: item.stage_id ?? null,
      stageAssignmentUUID: item.assignment_uuid ?? null,
      formSubmissionId: item.form_submission_id ?? null,
    }));
    yield put(setFormReceived(transformedData));
  } catch (error: any) {
    yield put(setFormReceived([]));
  }
}

export default function* formReceivedSaga() {
  yield takeLatest(FETCH_FORM_RECEIVED, fetchFormReceivedSaga);
}