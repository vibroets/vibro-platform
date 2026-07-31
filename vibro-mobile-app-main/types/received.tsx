export interface Received {
  form_submission_id: string | null | undefined;
  id: string; // form_submission_id
  submission_initiated_on: string;
  submission_initiated_stage: number;
  submission_initiated_by: number;
  is_completed: boolean;
  completed_by: number | null;
  completed_on: string | null;

  is_form_submission_pending: boolean;
  is_stage_submission_pending: boolean;
  stage_assignment_id: number;
  stage_assignment_uuid: string;
  stage_id: number;
  stage_name: string;
  stage_order: number;

  // Additional properties for todo functionality
  task_id?: number;
  task_name?: string;
}


export interface ReceivedData {
  id: string; // form id
  title: string;
  form_type: string;
  received: Received[];
}
