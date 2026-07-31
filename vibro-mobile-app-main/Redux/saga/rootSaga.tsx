import { all, fork } from "redux-saga/effects";
import authSaga from "./auth/authSagas";
import formAssignmentsSaga from "./formAssignmentsSaga/formAssignmentsSaga";
import formReceivedSaga from "./formReceivedSaga/formReceivedSaga";
import groupAssignmentsSaga from "./groupAssignmentsSaga/groupAssignmentsSaga";
import announcementsSaga from "./announcements/announcementsSaga";

// Import other sagas as needed

export function* rootSaga() {
  yield all([
    fork(authSaga),
    fork(formAssignmentsSaga), // ✅ Add this
    fork(formReceivedSaga),
    fork(groupAssignmentsSaga),
    fork(announcementsSaga)
  ]);
}

export default rootSaga;
