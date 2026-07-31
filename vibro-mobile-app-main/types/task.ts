export interface Task {
  id: number;
  task_name: string;
  title?: string;
  description?: string;
  status?: string;
  organization?: number;
  form?: number;
  form_title?: string;
  created_on?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface Group {
  id: number;
  name: string;
  organization?: number;
}

export interface TaskTracking {
  id: number;
  task: Task;
  assignee_user?: User;
  assignee_group?: Group;
  actual_start_date?: string;
  actual_end_date?: string;
  comments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskTrackingCreate {
  task: number;
  assignee_user?: number;
  assignee_group?: number;
  actual_start_date?: string;
  actual_end_date?: string;
  comments?: string;
}
