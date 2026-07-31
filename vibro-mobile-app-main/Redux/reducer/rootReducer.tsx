import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "../reducer/auth/authSlice";
import userReducer from "../reducer/user/userSlice"; // ✅ Import the new user slice
import announcementsReducer from "./announcements/announcementsSlice";
import formAssignmentsReducer from "./formAssignments/formAssignmentsSlice";
import formReceivedReducer from "./formReceived/formReceivedSlice";
import groupAssignmentsReducer from "./groupAssignMents/groupAssignmentsSlice";
import modalReducer from "./modal/modalSlice";


const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer, // ✅ Add user slice to root reducer
  formAssignments: formAssignmentsReducer, // ✅ Add this line
  formReceived:  formReceivedReducer,
  groupAssignments: groupAssignmentsReducer,
  modal: modalReducer,
  announcements: announcementsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
