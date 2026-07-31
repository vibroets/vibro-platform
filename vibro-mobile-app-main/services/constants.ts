const AUTH = "/auth/";
export const AUTH_REQUEST_OPT = `${AUTH}request-otp/`;
export const AUTH_VERIFY_OTP = `${AUTH}verify-otp/`;

export const FORM = "/form/";
export const GET_FORM_BY_ID = "form/";
export const USER = "/user";
export const FOLDER = `/form/used-folders/user`;
export const GETALLASSIGNEDSTAGESACCESSID = `/form/assigned/user/`;
export const GETALLASSIGNFORMS = `/form/assigned-forms-list/`;

export const USERS_LIST = "/users/list";
export const GROUPS_LIST = "/groups/";
export const LOCATION_LEADERS_LIST = "/location-leaders/list/";
export const DIVISION = "/division/";
export const SUBDIVISION = "/subdivision/";
export const LOCATION = "/location/";

export const ASSIGN_API = "/form/stage/assignment/"

export const GETSENTFORMS = "/form/users/"

export const RECEIVED = "/form/user/received/"

export const GETFORMSUBMISSIONDETAILS = "/form/response/"
export const FORM_STAGE_METADATA = "/form/"
export const FORM_FAST = "/form/"

export const GETAUDITFORMGROUPASSINGEDUUID = `/form/assigned/group/user/`;

export const GET_USER_ASSIGNMENTS = "/form/assigned/user/";
export const SUBMIT_STAGE_ANSWER = "/form/stage/submit-answer/";
export const SUBMIT_GROUP_ANSWER = "/form/group/submit-answer/";

export const TASK_TRACKING = "/tasks/";

export const TASKASSIGNEDFORM = "/user/assigned-tasks/"
export const TASKINPROGRESSFORM = "/user/assigned-tasks/"
export const TASK_TRACKING_CREATE = "/task-tracking/";
export const USER_COMPLETED_TASKS = "/user/completed-tasks/";

export const SAVE_DRAFT = "/drafts/save/";
export const GET_DRAFT = "/drafts/get-payload/";
export const GET_DRAFT_BY_ID = "/drafts/get-payload-by-id/";

export const TRIGGER_FOLLOWUP_TASKS = "/form/trigger-followup-tasks/";

export const PLANNER_MY_PLANNERS = "/planner/my-planners/";
export const PLANNER_BULK_IMPORT = "/planner/bulk-import/";
export const PLANNER_SHARE = "/planner/share/";
export const PLANNER_DOWNLOAD_TEMPLATE = "/planner/download-template/";
export const PLANNER_COLLABORATIVE_MY_GROUPS = "/planner/collaborative/my-groups/";
export const PLANNER_COLLABORATIVE_SUBMIT_GROUP = (plannerId: string | number) => `/planner/${plannerId}/collaborative/submit-group/`;
export const PLANNER_COLLABORATIVE_POLL_ANSWERS = (plannerId: string | number) => `/planner/${plannerId}/collaborative/poll-answers/`;
export const PLANNER_COLLABORATIVE_AUTO_SAVE = (plannerId: string | number) => `/planner/${plannerId}/collaborative/auto-save/`;
export const PLANNER_COLLABORATIVE_OPTION_STATS = (plannerId: string | number) => `/planner/${plannerId}/collaborative/option-stats/`;

export const POLL_MY_POLLS = "/poll/polls/my-polls/";
export const POLL_SENT = "/poll/polls/sent/";
export const POLL_SUBMIT = "/poll/polls/"; // {id}/submit/
