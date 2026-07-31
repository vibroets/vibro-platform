// Redux/actions/formAssignmentActions.ts
export const FETCH_FORM_RECEIVED = "FETCH_FORM_RECEIVED";

export function fetchFormReceived(payload: any) {
  return {
    type: FETCH_FORM_RECEIVED,
    payload,
  };
}
