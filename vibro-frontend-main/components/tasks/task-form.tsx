
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { CalendarIcon } from "lucide-react"
import { format, isAfter, isBefore, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import type { Task } from "@/data/tasks"
import { createTask, updateTask } from "@/data/tasks"
import { useSelector, useDispatch } from "react-redux";
import { selectUser } from "@/redux/slices/authSlice";
import { setCreatedTask } from "@/redux/slices/taskSlice";
import axiosInstance from "@/utils/axiosInstance";
import hotToaster from "react-hot-toast";

interface TaskFormProps {
  task?: Task
  mode?: string
}

export function TaskForm({ task, mode = 'create' }: TaskFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    incharge: task?.incharge || "",
    startDate: task?.startDate ? new Date(task.startDate) : new Date(),
    dueDate: task?.dueDate ? new Date(task.dueDate) : new Date(),
    linkedForm: task?.linkedForm || "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const organizationId = user?.organization;
  const [forms, setForms] = useState<any[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [dueCalendarOpen, setDueCalendarOpen] = useState(false);

  // Reset errors when form data changes
  useEffect(() => {
    setErrors({})
  }, [formData])

  useEffect(() => {
    if (!organizationId) return;

    const fetchForms = async () => {
      setFormsLoading(true);
      try {
        const response = await axiosInstance.get(`/forms/organization/${organizationId}/`);
        const transformed = response.data.forms
          .filter((item: any) => !item.is_archived)
          .map((item: any) => ({
            id: item.id,
            title: item.title || "Untitled",
          }));
        setForms(transformed);

        // If editing and we have a linked form title, find the corresponding ID
        if (task?.linkedForm) {
          const matchingForm = transformed.find((form: any) => form.title === task.linkedForm);
          if (matchingForm) {
            setFormData((prev) => ({ ...prev, linkedForm: String(matchingForm.id) }));
          }
        }
      } catch (error) {
        console.error("Error fetching forms:", error);
      } finally {
        setFormsLoading(false);
      }
    };

    fetchForms();
  }, [organizationId, task?.linkedForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    if (name === "linkedForm" && value === "none") {
      setFormData((prev) => ({ ...prev, [name]: "" }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleDateChange = (name: string, date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, [name]: date }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = "Title is required"
    }

    if (isAfter(formData.startDate, formData.dueDate)) {
      newErrors.dueDate = "Due date must be after start date"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const navigateToTaskshare = (taskId: string) => {
    window.dispatchEvent(new Event("route-loader-start"));
    router.push(`/tasks/share?taskId=${taskId}`);
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      hotToaster.error("Please fix the errors in the form.", { duration: 2000 });
      return
    }

    setIsSubmitting(true)

    try {
      // Format dates to ISO string with time, using selected date and fixed UTC time at start of day
      const payload = {
        task_name: formData.title,
        description: formData.description,
        form: formData.linkedForm ? parseInt(formData.linkedForm) : null,
        start_date: format(formData.startDate, 'yyyy-MM-dd') + 'T00:00:00.000Z',
        end_date: format(formData.dueDate, 'yyyy-MM-dd') + 'T00:00:00.000Z',
      }
      console.log(task ? "Updating task with payload:" : "Creating task with payload:", payload);

      if (task && mode === 'reopen') {
        // Reopen task
        console.log("Reopening task ID:", task.id);
        const response = await axiosInstance.patch(`/tasks/${task.id}/reopen/`)
        // Store task data in Redux for the share page
        dispatch(setCreatedTask({
          id: parseInt(task.id),
          title: task.title,
          user: [],
          group: [],
        }));
        hotToaster.success("The task has been reopened.", { duration: 2000 });
        router.push(`/tasks/share?taskId=${task.id}`);
      } else if (task) {
        // Update existing task
        console.log("Updating task ID:", task.id);
        const response = await axiosInstance.put(`/tasks/${task.id}/`, payload)
        hotToaster.success("The task has been successfully updated.", { duration: 2000 });
        router.push(`/tasks/${task.id}`);
      } else {
        // Create new task
        console.log("Creating new task");
        const response = await axiosInstance.post('/tasks/', payload)
        const taskId = response.data.task_id
        console.log("Created task ID:", taskId);
        // Store task data in Redux for the share page
        dispatch(setCreatedTask({
          id: taskId,
          title: formData.title,
          user: [],
          group: [],
        }));

        hotToaster.success("The task has been successfully created.", { duration: 2000 });
        navigateToTaskshare(taskId);
      }
    } catch (error) {
      console.error(`Error ${task ? "updating" : "creating"} task:`, error)
      const message = (error as any)?.response?.data?.form?.[0] ||
                     (error as any)?.response?.data?.title?.[0] ||
                     (error as any)?.response?.data?.description?.[0] ||
                     (error as any)?.response?.data?.detail ||
                     `Failed to ${task ? "update" : "create"} the task. Please try again.`
      hotToaster.error(message, { duration: 2000 });
    } finally {
      setIsSubmitting(false)
    }

  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={errors.title ? "border-destructive" : ""}
                placeholder="Enter task title"
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter task description"
                rows={4}
              />
            </div>

          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => { handleDateChange("startDate", date); setStartCalendarOpen(false); }}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                      classNames={{
                        day_disabled: "text-red-500 bg-red-100 cursor-not-allowed line-through"
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate" className={errors.dueDate ? "text-destructive" : ""}>
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Popover open={dueCalendarOpen} onOpenChange={setDueCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.dueDate && "text-muted-foreground",
                        errors.dueDate && "border-destructive",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? format(formData.dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date) => { handleDateChange("dueDate", date); setDueCalendarOpen(false); }}
                      disabled={(date) => isBefore(date, formData.startDate)}
                      classNames={{
                        day_disabled: "text-gray-400 opacity-50 bg-gray-200 cursor-not-allowed border border-gray-300 line-through"
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.dueDate && <p className="text-sm text-destructive">{errors.dueDate}</p>}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="linkedForm">Assign Form</Label>
              <Combobox
                options={[
                  { label: "None", value: "none" },
                  ...(formsLoading
                    ? [{ label: "Loading forms...", value: "loading" }]
                    : forms.map((form) => ({
                      label: form.title,
                      value: String(form.id),
                    }))
                  ),
                ]}
                value={formData.linkedForm || "none"}
                onChange={(value) => handleSelectChange("linkedForm", value)}
                placeholder="Select a form (optional)"
                searchPlaceholder="Search forms..."
                notFoundText="No forms found."
              />
            </div>
          </div>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
            >
              {isSubmitting ? "Saving..." : task ? (mode === 'reopen' ? "Reopen Task update" : "Update Task") : "Create Task"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
