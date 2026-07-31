export interface Task {
  id: string
  title: string
  description?: string
  incharge: string
  startDate: string
  dueDate: string
  status: "Not Started" | "In Progress" | "Completed" | "Not Assigned"
  actualEnd: string | null
  linkedForm?: string | null
  createdBy?: string
  createdByDesignation?: string
  createdOn?: string
  formid?: number | String | null
  isAutoClosed?: boolean
  isBulkImported?: boolean
}

const tasks: Task[] = []

export function getTasks(): Task[] {
  return [...tasks]
}

export function getTask(id: string): Task | undefined {
  return tasks.find((task) => task.id === id)
}

export function createTask(task: Omit<Task, "id">): Task {
  // Generate a new ID
  const newId = `TASK-${String(tasks.length + 1).padStart(3, "0")}`

  // Create the new task with proper formatting
  const newTask: Task = {
    id: newId,
    title: task.title,
    description: task.description || "",
    incharge: task.incharge,
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status || "Not Started",
    actualEnd: task.actualEnd || null,
    linkedForm: task.linkedForm || null,
    createdBy: task.createdBy || "Current User",
    createdByDesignation: task.createdByDesignation || "User",
    createdOn: task.createdOn || new Date().toISOString().split("T")[0],
  }

  // Add to the tasks array
  tasks.push(newTask)
  return newTask
}

export function updateTask(id: string, updatedTask: Partial<Task>): Task | undefined {
  const index = tasks.findIndex((task) => task.id === id)
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updatedTask }
    return tasks[index]
  }
  return undefined
}

export function deleteTask(id: string): boolean {
  const index = tasks.findIndex((task) => task.id === id)
  if (index !== -1) {
    tasks.splice(index, 1)
    return true
  }
  return false
}
