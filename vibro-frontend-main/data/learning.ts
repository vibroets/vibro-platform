
export type Course ={
  id: string
  title: string
  description: string
  assignedOn: string
  assignedTo: string
  enrollmentCount: number
  status: "Active" | "Completed" | "Archived"
  content?: string
  duration?: string
  materials?: string[]
}

export type Assessment ={
  id: string
  title: string
  description: string
  courseId?: string
  passingScore: number
  timeLimit?: number
  randomizeQuestions: boolean
  status: "Active" | "Draft" | "Archived"
  questions: Question[]
}

export type Question = {
  id: string
  text: string
  type: "multiple-choice" | "true-false" | "short-answer"
  options?: string[]
  correctAnswer: string | string[]
  points: number
}

export type AssessmentAttempt = {
  id: string
  userId: string
  userName: string
  assessmentId: string
  score: number
  passingScore: number
  passed: boolean
  completedAt: string
  answers: {
    questionId: string
    answer: string | string[]
    correct: boolean
  }[]
}

// Sample data
const courses: Course[] = [
  {
    id: "1",
    title: "Safety Procedures Training",
    description: "Comprehensive training on workplace safety procedures and protocols.",
    assignedOn: "2023-04-15",
    assignedTo: "Operations Team",
    enrollmentCount: 45,
    status: "Active",
    duration: "2 hours",
  },
  {
    id: "2",
    title: "Customer Service Excellence",
    description: "Learn best practices for providing exceptional customer service.",
    assignedOn: "2023-04-10",
    assignedTo: "Sales Department",
    enrollmentCount: 32,
    status: "Active",
    duration: "3 hours",
  },
  {
    id: "3",
    title: "Leadership Skills Development",
    description: "Develop essential leadership skills for managing teams effectively.",
    assignedOn: "2023-04-05",
    assignedTo: "Management Team",
    enrollmentCount: 15,
    status: "Completed",
    duration: "4 hours",
  },
  {
    id: "4",
    title: "Compliance Training",
    description: "Mandatory training on regulatory compliance and company policies.",
    assignedOn: "2023-04-01",
    assignedTo: "All Staff",
    enrollmentCount: 120,
    status: "Active",
    duration: "1.5 hours",
  },
  {
    id: "5",
    title: "Product Knowledge Training",
    description: "Detailed overview of our product lineup and features.",
    assignedOn: "2023-03-28",
    assignedTo: "Sales Department",
    enrollmentCount: 30,
    status: "Archived",
    duration: "2.5 hours",
  },
]

const assessments: Assessment[] = [
  {
    id: "1",
    title: "Safety Procedures Assessment",
    description: "Test your knowledge of workplace safety procedures.",
    courseId: "1",
    passingScore: 80,
    timeLimit: 30,
    randomizeQuestions: true,
    status: "Active",
    questions: [],
  },
  {
    id: "2",
    title: "Customer Service Quiz",
    description: "Evaluate your understanding of customer service principles.",
    courseId: "2",
    passingScore: 75,
    timeLimit: 20,
    randomizeQuestions: true,
    status: "Active",
    questions: [],
  },
]

const assessmentAttempts: AssessmentAttempt[] = []

// CRUD operations
export function getCourses(): Course[] {
  return courses
}

export function getCourseById(id: string): Course | undefined {
  return courses.find((course) => course.id === id)
}

export function getAssessments(): Assessment[] {
  return assessments
}

export function getAssessmentById(id: string): Assessment | undefined {
  return assessments.find((assessment) => assessment.id === id)
}

export function getAssessmentsByCourseId(courseId: string): Assessment[] {
  return assessments.filter((assessment) => assessment.courseId === courseId)
}

export function getAttemptsByAssessment(assessmentId: string): AssessmentAttempt[] {
  return assessmentAttempts.filter((attempt) => attempt.assessmentId === assessmentId)
}
