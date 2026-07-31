// Redux/actions/formAssignmentActions.ts
export const FETCH_FORM_ASSIGNMENTS = "FETCH_FORM_ASSIGNMENTS";

export function fetchFormAssignments(payload: any) {
  return {
    type: FETCH_FORM_ASSIGNMENTS,
    payload,
  };
}
