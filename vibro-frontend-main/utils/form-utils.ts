import { type Form, type FormResponse, type FormType, mockFormResponses, mockForms } from "@/data/forms"
import { FormData } from "@/components/forms/form-creator"


export const getFormById = (formId: string): Form | undefined => {
  return mockForms.find((form) => form.id === formId)
}

export const getFormResponses = (formId: string): FormResponse[] => {
  return mockFormResponses.filter((response) => response.formId === formId)
}
export const filterForms =(
  forms: Form[],
  searchQuery: string,
  formType: string | null,
  dateRange: { from: Date | undefined; to: Date | undefined },
): Form[] => {
  return forms.filter((form) => {
    // Search query filter
    if (
      searchQuery &&
      !form.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !form.author.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }

    // Form type filter
    if (formType && form.formType !== formType) {
      return false
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const formDate = new Date(form.createdDate)

      if (dateRange.from && formDate < dateRange.from) {
        return false
      }

      if (dateRange.to) {
        const toDateEnd = new Date(dateRange.to)
        toDateEnd.setHours(23, 59, 59, 999)

        if (formDate > toDateEnd) {
          return false
        }
      }
    }

    return true
  })
}

export const filterFormResponses = (
  responses: FormResponse[],
  searchQuery: string,
  dateRange: { from: Date | undefined; to: Date | undefined },
  location?: string,
  user?: string,
): FormResponse[] => {
  return responses.filter((response) => {
    // Search query filter
    if (
      searchQuery &&
      !response.submissionId.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !response.user.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !response.filledBy.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const responseDate = new Date(response.submissionDate)

      if (dateRange.from && responseDate < dateRange.from) {
        return false
      }

      if (dateRange.to) {
        const toDateEnd = new Date(dateRange.to)
        toDateEnd.setHours(23, 59, 59, 999)

        if (responseDate > toDateEnd) {
          return false
        }
      }
    }

    // Location filter
    if (location && response.location !== location) {
      return false
    }

    // User filter
    if (user && response.user !== user && response.filledBy !== user) {
      return false
    }

    return true
  })
}

export const getFormTypeColor = (formType: FormType): string => {
  switch (formType) {
    case "Standard":
      return "bg-blue-100 text-blue-800"
    case "Location":
      return "bg-green-100 text-green-800"
    case "Audit":
      return "bg-purple-100 text-purple-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export const getStatusColor = (status: "complete" | "partial"): string => {
  switch (status) {
    case "complete":
      return "bg-green-100 text-green-800"
    case "partial":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}


// utils/formUtils.ts

export const getEmptyFormData = (): FormData => ({
  title: "",
  type: "standard",
  captureGPS: false,
  allowSharing: true,
  passPercentage: 70,
  responseIdPrefix: "",
  allowEditing: false,
  enableStageReEditing: false,
  triggerEmailNotifications: false,
  autoShareResponses: false,
  autoShareWith: null,
  folderId: null,
  folderName: "",
  stages: [],
  requiresApproval: false,
  logics: [
    {
      logic_type: "is",
      logic_value: "",
      order: 1,
      follow_up: {
        title: "",
        deadline: 0,
        assign_to: "form_submitter",
        task_close_questions: [],
      },
      logic_questions: [],
      notification: {
        enabled: false,
        users: [],
        groups: [],
        emails: "",
      },
    },
  ],
});
