// Redux/sagas/formAssignmentsSaga.ts
import { put, takeLatest } from "redux-saga/effects";
import { setGroupAssignments } from "@/Redux/reducer/groupAssignMents/groupAssignmentsSlice";
import { FETCH_GROUP_ASSIGNMENTS } from "@/Redux/actions/groupAssignmentAction";

function* fetchGroupAssignmentsSaga(action: any): Generator<any, void, any> {
  try {
    const rawData = action.payload;


    const transformedData = rawData.map((item: any) => ({
      formId: item.form.id,
      groupId:item?.group_id,
      formSubmissionId: item.form_submission_id,
      assignmentUuid: item?.assignment_uuid,
    }));

    yield put(setGroupAssignments(transformedData));
  } catch (error: any) {
  }
}

export default function* groupAssignmentsSaga() {
  yield takeLatest(FETCH_GROUP_ASSIGNMENTS, fetchGroupAssignmentsSaga);
}
