// Redux/actions/formAssignmentActions.ts
export const FETCH_GROUP_ASSIGNMENTS = "FETCH_GROUP_ASSIGNMENTS";

export function fetchGroupAssignments(payload: any) {
  return {
    type: FETCH_GROUP_ASSIGNMENTS,
    payload,
  };
}
