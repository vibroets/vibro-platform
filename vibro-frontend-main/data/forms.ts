export type FormType = "Standard" | "Location" | "Audit"

export interface Form {
  id: string
  title: string
  author: string
  createdDate: string
  latestResponse: string | null
  formType: FormType
  repeatSchedule: string | null
  stages: FormStage[]
  settings: FormSettings
  folder?: string
}

export interface FormStage {
  id: string
  title: string
  questions: FormQuestion[]
}

export interface FormQuestion {
  id: string
  type: QuestionType
  title: string
  description?: string
  required: boolean
  options?: string[]
  conditionalLogic?: ConditionalLogic
  useCamera?: boolean
  offlineEnabled?: boolean
  attachments?: Attachment[]
}

export interface ConditionalLogic {
  questionId: string
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than"
  value: string
  action: "show" | "hide" | "skip"
}

export interface Attachment {
  id: string
  name: string
  url: string
  type: "image" | "video" | "file"
}

export interface FormSettings {
  captureGPS: boolean
  allowSharing: boolean
  passPercentage?: number
  responseIdPrefix?: string
  allowEditingSubmitted: boolean
  allowStageReEditing: boolean
  emailNotifications: boolean
  autoShareResponses: boolean
  autoShareWith?: {
    users?: string[]
    groups?: string[]
    locationLeaders?: boolean
  }
}

export type QuestionType =
  | "table"
  | "title_description"
  | "long_answer"
  | "date"
  | "time"
  | "datetime"
  | "signature"
  | "file_upload"
  | "formula"
  | "short_answer"
  | "text"
  | "multiple_choice"
  | "checkboxes"
  | "rating"
  | "location"

export interface FormResponse {
  id: string
  formId: string
  submissionId: string
  user: string
  submissionDate: string
  filledBy: string
  designation: string
  department: string
  location?: string
  status: "complete" | "partial"
  taskCompletion: number
  overdueTask: number
  reopenedTask: number
  answers: Record<string, any>
}

export interface FormFolder {
  id: string
  name: string
  parentId?: string
  createdBy: string
  createdDate: string
  forms: string[]
  subfolders: string[]
  accessRights: string[] // User IDs with access
}

// Mock data
export const mockForms: Form[] = [
  {
    id: "form-1",
    title: "Daily Safety Inspection",
    author: "John Doe",
    createdDate: "2023-04-15",
    latestResponse: "2023-04-27",
    formType: "Audit",
    repeatSchedule: "Daily",
    stages: [
      {
        id: "stage-1",
        title: "General Information",
        questions: [
          {
            id: "q1",
            type: "text",
            title: "Inspector Name",
            required: true,
          },
          {
            id: "q2",
            type: "date",
            title: "Inspection Date",
            required: true,
          },
          {
            id: "q3",
            type: "location",
            title: "Inspection Location",
            required: true,
          },
        ],
      },
      {
        id: "stage-2",
        title: "Safety Checks",
        questions: [
          {
            id: "q4",
            type: "checkboxes",
            title: "Safety Equipment Available",
            options: ["Fire Extinguisher", "First Aid Kit", "Emergency Exits", "Safety Goggles", "Hard Hats"],
            required: true,
          },
          {
            id: "q5",
            type: "multiple_choice",
            title: "Overall Safety Rating",
            options: ["Excellent", "Good", "Fair", "Poor", "Critical"],
            required: true,
          },
          {
            id: "q6",
            type: "file_upload",
            title: "Upload Photos of Issues",
            required: false,
            useCamera: true,
          },
        ],
      },
    ],
    settings: {
      captureGPS: true,
      allowSharing: true,
      passPercentage: 80,
      responseIdPrefix: "SI",
      allowEditingSubmitted: false,
      allowStageReEditing: true,
      emailNotifications: true,
      autoShareResponses: true,
      autoShareWith: {
        locationLeaders: true,
      },
    },
  },
  {
    id: "form-2",
    title: "Employee Satisfaction Survey",
    author: "Jane Smith",
    createdDate: "2023-03-10",
    latestResponse: "2023-04-25",
    formType: "Standard",
    repeatSchedule: "Monthly",
    stages: [
      {
        id: "stage-1",
        title: "Personal Information",
        questions: [
          {
            id: "q1",
            type: "text",
            title: "Department",
            required: true,
          },
          {
            id: "q2",
            type: "multiple_choice",
            title: "Years at Company",
            options: ["Less than 1", "1-3", "3-5", "5-10", "10+"],
            required: true,
          },
        ],
      },
      {
        id: "stage-2",
        title: "Satisfaction Metrics",
        questions: [
          {
            id: "q3",
            type: "rating",
            title: "Work-Life Balance",
            required: true,
          },
          {
            id: "q4",
            type: "rating",
            title: "Management Support",
            required: true,
          },
          {
            id: "q5",
            type: "rating",
            title: "Career Growth Opportunities",
            required: true,
          },
          {
            id: "q6",
            type: "long_answer",
            title: "Suggestions for Improvement",
            required: false,
          },
        ],
      },
    ],
    settings: {
      captureGPS: false,
      allowSharing: false,
      allowEditingSubmitted: false,
      allowStageReEditing: false,
      emailNotifications: true,
      autoShareResponses: false,
    },
  },
  {
    id: "form-3",
    title: "Store Audit Checklist",
    author: "Michael Johnson",
    createdDate: "2023-02-20",
    latestResponse: "2023-04-26",
    formType: "Location",
    repeatSchedule: "Weekly",
    stages: [
      {
        id: "stage-1",
        title: "Store Information",
        questions: [
          {
            id: "q1",
            type: "text",
            title: "Store Number",
            required: true,
          },
          {
            id: "q2",
            type: "text",
            title: "Store Manager",
            required: true,
          },
          {
            id: "q3",
            type: "location",
            title: "Store Location",
            required: true,
          },
        ],
      },
      {
        id: "stage-2",
        title: "Visual Merchandising",
        questions: [
          {
            id: "q4",
            type: "table",
            title: "Display Compliance",
            required: true,
          },
          {
            id: "q5",
            type: "file_upload",
            title: "Store Front Photo",
            required: true,
            useCamera: true,
          },
        ],
      },
      {
        id: "stage-3",
        title: "Inventory Check",
        questions: [
          {
            id: "q6",
            type: "multiple_choice",
            title: "Inventory Accuracy",
            options: ["Excellent", "Good", "Fair", "Poor"],
            required: true,
          },
          {
            id: "q7",
            type: "long_answer",
            title: "Notes on Discrepancies",
            required: false,
          },
        ],
      },
    ],
    settings: {
      captureGPS: true,
      allowSharing: true,
      passPercentage: 85,
      responseIdPrefix: "SA",
      allowEditingSubmitted: true,
      allowStageReEditing: true,
      emailNotifications: true,
      autoShareResponses: true,
      autoShareWith: {
        users: ["user-1", "user-2"],
        groups: ["group-1"],
      },
    },
    folder: "folder-1",
  },
  {
    id: "form-4",
    title: "Equipment Maintenance Log",
    author: "Robert Chen",
    createdDate: "2023-01-05",
    latestResponse: "2023-04-20",
    formType: "Standard",
    repeatSchedule: null,
    stages: [
      {
        id: "stage-1",
        title: "Equipment Details",
        questions: [
          {
            id: "q1",
            type: "text",
            title: "Equipment ID",
            required: true,
          },
          {
            id: "q2",
            type: "text",
            title: "Equipment Type",
            required: true,
          },
          {
            id: "q3",
            type: "text",
            title: "Location",
            required: true,
          },
        ],
      },
      {
        id: "stage-2",
        title: "Maintenance Information",
        questions: [
          {
            id: "q4",
            type: "date",
            title: "Maintenance Date",
            required: true,
          },
          {
            id: "q5",
            type: "text",
            title: "Technician Name",
            required: true,
          },
          {
            id: "q6",
            type: "checkboxes",
            title: "Maintenance Tasks Performed",
            options: ["Cleaning", "Lubrication", "Part Replacement", "Calibration", "Software Update"],
            required: true,
          },
          {
            id: "q7",
            type: "long_answer",
            title: "Notes",
            required: false,
          },
          {
            id: "q8",
            type: "file_upload",
            title: "Photos",
            required: false,
            useCamera: true,
          },
        ],
      },
    ],
    settings: {
      captureGPS: false,
      allowSharing: true,
      allowEditingSubmitted: true,
      allowStageReEditing: true,
      emailNotifications: false,
      autoShareResponses: false,
    },
  },
  {
    id: "form-5",
    title: "New Hire Onboarding",
    author: "Sarah Williams",
    createdDate: "2023-03-25",
    latestResponse: null,
    formType: "Standard",
    repeatSchedule: null,
    stages: [
      {
        id: "stage-1",
        title: "Employee Information",
        questions: [
          {
            id: "q1",
            type: "text",
            title: "Full Name",
            required: true,
          },
          {
            id: "q2",
            type: "date",
            title: "Start Date",
            required: true,
          },
          {
            id: "q3",
            type: "text",
            title: "Department",
            required: true,
          },
          {
            id: "q4",
            type: "text",
            title: "Manager",
            required: true,
          },
        ],
      },
      {
        id: "stage-2",
        title: "Onboarding Checklist",
        questions: [
          {
            id: "q5",
            type: "checkboxes",
            title: "Documents Received",
            options: ["ID", "Tax Forms", "Direct Deposit", "Benefits Enrollment", "Employee Handbook"],
            required: true,
          },
          {
            id: "q6",
            type: "checkboxes",
            title: "Equipment Provided",
            options: ["Laptop", "Phone", "Access Card", "Office Supplies"],
            required: true,
          },
          {
            id: "q7",
            type: "signature",
            title: "Employee Signature",
            required: true,
          },
        ],
      },
    ],
    settings: {
      captureGPS: false,
      allowSharing: true,
      allowEditingSubmitted: false,
      allowStageReEditing: false,
      emailNotifications: true,
      autoShareResponses: true,
      autoShareWith: {
        groups: ["HR", "IT"],
      },
    },
    folder: "folder-2",
  },
]

export const mockFormResponses: FormResponse[] = [
  {
    id: "response-1",
    formId: "form-1",
    submissionId: "SI-001",
    user: "Alex Johnson",
    submissionDate: "2023-04-27",
    filledBy: "Alex Johnson",
    designation: "Safety Officer",
    department: "Operations",
    location: "Building A",
    status: "complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 0,
    answers: {},
  },
  {
    id: "response-2",
    formId: "form-1",
    submissionId: "SI-002",
    user: "Maria Garcia",
    submissionDate: "2023-04-26",
    filledBy: "Maria Garcia",
    designation: "Team Lead",
    department: "Production",
    location: "Building B",
    status: "complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 0,
    answers: {},
  },
  {
    id: "response-3",
    formId: "form-2",
    submissionId: "ES-001",
    user: "David Kim",
    submissionDate: "2023-04-25",
    filledBy: "David Kim",
    designation: "Developer",
    department: "IT",
    status: "complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 0,
    answers: {},
  },
  {
    id: "response-4",
    formId: "form-3",
    submissionId: "SA-001",
    user: "Jennifer Lee",
    submissionDate: "2023-04-26",
    filledBy: "Jennifer Lee",
    designation: "Regional Manager",
    department: "Retail",
    location: "Store #123",
    status: "complete",
    taskCompletion: 90,
    overdueTask: 10,
    reopenedTask: 5,
    answers: {},
  },
  {
    id: "response-5",
    formId: "form-3",
    submissionId: "SA-002",
    user: "Carlos Rodriguez",
    submissionDate: "2023-04-25",
    filledBy: "Carlos Rodriguez",
    designation: "Store Manager",
    department: "Retail",
    location: "Store #456",
    status: "partial",
    taskCompletion: 75,
    overdueTask: 25,
    reopenedTask: 0,
    answers: {},
  },
  {
    id: "response-6",
    formId: "form-4",
    submissionId: "EM-001",
    user: "Lisa Wong",
    submissionDate: "2023-04-20",
    filledBy: "Lisa Wong",
    designation: "Maintenance Technician",
    department: "Facilities",
    status: "complete",
    taskCompletion: 100,
    overdueTask: 0,
    reopenedTask: 0,
    answers: {},
  },
]

export const mockFolders: FormFolder[] = [
  {
    id: "folder-1",
    name: "Audit Forms",
    createdBy: "John Doe",
    createdDate: "2023-01-01",
    forms: ["form-3"],
    subfolders: [],
    accessRights: ["user-1", "user-2", "user-3"],
  },
  {
    id: "folder-2",
    name: "HR Forms",
    createdBy: "Jane Smith",
    createdDate: "2023-01-15",
    forms: ["form-5"],
    subfolders: ["folder-3"],
    accessRights: ["user-2", "user-4"],
  },
  {
    id: "folder-3",
    name: "Onboarding",
    parentId: "folder-2",
    createdBy: "Jane Smith",
    createdDate: "2023-01-20",
    forms: [],
    subfolders: [],
    accessRights: ["user-2", "user-4"],
  },
]
