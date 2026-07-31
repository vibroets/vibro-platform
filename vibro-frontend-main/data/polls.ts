import { v4 as uuidv4 } from "uuid"

export type PollQuestionType = "multiple-choice" | "checkbox" | "rating" | "text" | "yes-no" | "emoji"

export type PollCategory =
  | "Employee Engagement"
  | "Operations"
  | "HR"
  | "Safety"
  | "Training"
  | "Events"
  | "General"

export type PollType =
  | "Single Choice"
  | "Multiple Choice"
  | "Rating Scale (1-5)"
  | "Yes/No"
  | "Open Text"
  | "Emoji Reaction"

export interface PollQuestion {
  id: string
  type: PollQuestionType
  question: string
  options?: string[]
  required: boolean
  nextSectionLogic?: {
    condition: string
    nextSectionId: string
  }[]
}

export interface Poll {
  id: string
  title: string
  description?: string
  category?: PollCategory
  pollType?: PollType
  thumbnail?: string
  createdBy: string
  createdOn: string
  status: "Active" | "Closed"
  responseCount: number
  questions: PollQuestion[]
  isPinned?: boolean
  removeOnCompletion?: boolean
  startDate?: string
  endDate?: string
  anonymous?: boolean
  allowMultipleResponses?: boolean
  targetAudience?: {
    users: number[]
    groups: number[]
    locations: number[]
  }
}

export interface PollResponse {
  id: string
  pollId: string
  respondent: string
  submittedOn: string
  answers: {
    questionId: string
    answer: string | string[] | number
  }[]
}

export interface PollShare {
  id: string
  pollId: string
  sharedBy: string
  sharedOn: string
  sharedWith: string[]
  scheduled?: boolean
  scheduledDate?: string
}

// Sample data
let polls: Poll[] = [
  {
    id: "1",
    title: "Employee Satisfaction Survey",
    createdBy: "John Doe",
    createdOn: "2023-04-15",
    status: "Active",
    responseCount: 45,
    questions: [
      {
        id: "q1",
        type: "rating",
        question: "How satisfied are you with your work environment?",
        required: true,
      },
      {
        id: "q2",
        type: "multiple-choice",
        question: "Which department do you work in?",
        options: ["HR", "Engineering", "Marketing", "Sales", "Other"],
        required: true,
      },
      {
        id: "q3",
        type: "text",
        question: "What suggestions do you have for improvement?",
        required: false,
      },
    ],
    isPinned: true,
    removeOnCompletion: false,
  },
  {
    id: "2",
    title: "Office Location Preference",
    createdBy: "Jane Smith",
    createdOn: "2023-04-10",
    status: "Active",
    responseCount: 32,
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: "Which office location do you prefer?",
        options: ["Downtown", "Suburb", "Remote"],
        required: true,
      },
      {
        id: "q2",
        type: "checkbox",
        question: "What amenities are important to you?",
        options: ["Parking", "Gym", "Cafeteria", "Public Transit Access", "Childcare"],
        required: true,
      },
    ],
    isPinned: false,
    removeOnCompletion: true,
  },
  {
    id: "3",
    title: "Company Event Planning",
    createdBy: "Michael Johnson",
    createdOn: "2023-04-05",
    status: "Closed",
    responseCount: 50,
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: "What type of company event would you prefer?",
        options: ["Team Building", "Holiday Party", "Outdoor Activity", "Volunteer Work"],
        required: true,
      },
    ],
    isPinned: false,
    removeOnCompletion: false,
  },
  {
    id: "4",
    title: "Work From Home Policy Feedback",
    createdBy: "Sarah Williams",
    createdOn: "2023-04-01",
    status: "Active",
    responseCount: 38,
    questions: [
      {
        id: "q1",
        type: "rating",
        question: "How productive are you when working from home?",
        required: true,
      },
      {
        id: "q2",
        type: "multiple-choice",
        question: "How many days per week would you prefer to work from home?",
        options: ["0", "1-2", "3-4", "5"],
        required: true,
      },
    ],
    isPinned: true,
    removeOnCompletion: false,
  },
  {
    id: "5",
    title: "Cafeteria Menu Preferences",
    createdBy: "Robert Brown",
    createdOn: "2023-03-28",
    status: "Closed",
    responseCount: 42,
    questions: [
      {
        id: "q1",
        type: "checkbox",
        question: "Which food options would you like to see in the cafeteria?",
        options: ["Vegetarian", "Vegan", "Gluten-Free", "Low-Carb", "International Cuisine"],
        required: true,
      },
    ],
    isPinned: false,
    removeOnCompletion: true,
  },
]

let pollResponses: PollResponse[] = [
  {
    id: "r1",
    pollId: "1",
    respondent: "User 1",
    submittedOn: "2023-04-16",
    answers: [
      { questionId: "q1", answer: 4 },
      { questionId: "q2", answer: "Engineering" },
      { questionId: "q3", answer: "Better coffee machines" },
    ],
  },
  {
    id: "r2",
    pollId: "1",
    respondent: "User 2",
    submittedOn: "2023-04-17",
    answers: [
      { questionId: "q1", answer: 3 },
      { questionId: "q2", answer: "Marketing" },
      { questionId: "q3", answer: "More team events" },
    ],
  },
]

let pollShares: PollShare[] = [
  {
    id: "s1",
    pollId: "1",
    sharedBy: "John Doe",
    sharedOn: "2023-04-15",
    sharedWith: ["Engineering Team", "Marketing Team"],
    scheduled: false,
  },
  {
    id: "s2",
    pollId: "2",
    sharedBy: "Jane Smith",
    sharedOn: "2023-04-10",
    sharedWith: ["All Employees"],
    scheduled: true,
    scheduledDate: "2023-04-20",
  },
]

// CRUD operations
export const getPolls = () => {
  return [...polls]
}

export const getPoll = (id: string) => {
  return polls.find((poll) => poll.id === id)
}

export const createPoll = (poll: Omit<Poll, "id" | "createdOn" | "responseCount">) => {
  const newPoll: Poll = {
    ...poll,
    id: uuidv4(),
    createdOn: new Date().toISOString().split("T")[0],
    responseCount: 0,
  }
  polls = [...polls, newPoll]
  return newPoll
}

export const updatePoll = (id: string, updatedPoll: Partial<Poll>) => {
  polls = polls.map((poll) => (poll.id === id ? { ...poll, ...updatedPoll } : poll))
  return polls.find((poll) => poll.id === id)
}

export const deletePoll = (id: string) => {
  polls = polls.filter((poll) => poll.id !== id)
}

export const closePoll = (id: string) => {
  polls = polls.map((poll) => (poll.id === id ? { ...poll, status: "Closed" } : poll))
}

export const getPollResponses = (pollId: string) => {
  return pollResponses.filter((response) => response.pollId === pollId)
}

export const createPollResponse = (response: Omit<PollResponse, "id" | "submittedOn">) => {
  const newResponse: PollResponse = {
    ...response,
    id: uuidv4(),
    submittedOn: new Date().toISOString().split("T")[0],
  }
  pollResponses = [...pollResponses, newResponse]

  // Update response count
  polls = polls.map((poll) => (poll.id === response.pollId ? { ...poll, responseCount: poll.responseCount + 1 } : poll))

  return newResponse
}

export const getPollShares = (pollId: string) => {
  return pollShares.filter((share) => share.pollId === pollId)
}

export const createPollShare = (share: Omit<PollShare, "id" | "sharedOn">) => {
  const newShare: PollShare = {
    ...share,
    id: uuidv4(),
    sharedOn: new Date().toISOString().split("T")[0],
  }
  pollShares = [...pollShares, newShare]
  return newShare
}

export const bulkImportResponses = (responses: Omit<PollResponse, "id" | "submittedOn">[]) => {
  const newResponses = responses.map((response) => ({
    ...response,
    id: uuidv4(),
    submittedOn: new Date().toISOString().split("T")[0],
  }))

  pollResponses = [...pollResponses, ...newResponses]

  // Update response counts
  const pollCounts = new Map<string, number>()
  responses.forEach((response) => {
    const count = pollCounts.get(response.pollId) || 0
    pollCounts.set(response.pollId, count + 1)
  })

  polls = polls.map((poll) => {
    const additionalCount = pollCounts.get(poll.id) || 0
    return additionalCount > 0 ? { ...poll, responseCount: poll.responseCount + additionalCount } : poll
  })

  return newResponses
}
