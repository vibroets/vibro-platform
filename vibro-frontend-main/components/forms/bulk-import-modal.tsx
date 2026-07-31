"use client"

import React, { useState, useRef, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Upload,
  FileText,
  Download,
  Check,
  AlertCircle,
  X,
  Plus,
  Trash,
  Copy,
  ChevronDown,
  ChevronRight,
  Settings,
  MessageSquareText,
  CircleX,
  MoveUp,
  MoveDown,
  Type,
  CheckSquare,
  CircleChevronDown,
  Ruler,
  Calendar,
  Clock,
  Calculator,
  ImageIcon,
  VideoIcon,
  FileIcon,
  QrCode,
  MapPin,
  User,
  Layers,
} from "lucide-react"
import * as XLSX from "xlsx"
import hotToaster from "react-hot-toast"
import { Question, QuestionType, Stage, FormData } from "./form-creator"
import LogicFollowUpAccordion from "./logic-follow-up"
import { LogicNotificationAccordion } from "./logic-notification"
import QuestionEditor from "./question-editor"

// ─── Question type label mapping ─────────────────────────────────────────────
const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  multiple_choice: "Multiple Choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  linear_scale: "Linear Scale",
  date: "Date",
  time: "Time",
  datetime: "Datetime",
  signature: "Signature",
  upload_image: "Upload Image",
  upload_video: "Upload Video",
  upload_file: "Upload File",
  qr_code: "QR Code",
  formula: "Formula",
  user: "User",
  location: "Location",
  division: "Division",
  sub_division: "Sub Division",
  title_and_description: "Title and Description",
  table: "Table",
  audit: "Audit",
  text: "Text",
  rating: "Rating",
  checkbox: "Checkbox",
}

const LABEL_TO_TYPE: Record<string, QuestionType> = Object.entries(
  QUESTION_TYPE_LABELS
).reduce((acc, [type, label]) => {
  acc[label.toLowerCase()] = type as QuestionType
  acc[type.toLowerCase()] = type as QuestionType
  return acc
}, {
  "multiple choice": "multiple_choice",
  "multiple-choice": "multiple_choice",
  "multiple_choice": "multiple_choice",
  checkbox: "checkboxes",
  checkboxes: "checkboxes",
  dropdown: "dropdown",
  audit: "audit",
} as Record<string, QuestionType>)

const MAX_OPTIONS = 10

const stripNumbering = (value: string) => value.replace(/^\d+\.(?:\d+\.?)*\s*/, "").trim()

const applyFinalNumbering = (form: FormData): FormData => {
  let groupNumber = 0

  return {
    ...form,
    stages: form.stages.map((stage, stageIndex) => {
      if (form.type === "audit" && stageIndex === 0) {
        return stage
      }

      groupNumber += 1
      return {
        ...stage,
        title: `${groupNumber}. ${stripNumbering(stage.title) || stage.title}`,
        questions: stage.questions.map((question, questionIndex) => ({
          ...question,
          title: `${groupNumber}.${questionIndex + 1} ${stripNumbering(question.title) || question.title}`,
        })),
      }
    }),
  }
}

// Types that support options
const OPTION_TYPES = ["multiple_choice", "checkboxes", "dropdown"]
// Types that support conditional logic
const LOGIC_TYPES = ["multiple_choice", "dropdown", "checkboxes", "short_answer", "linear_scale", "audit"]

// ─── Default logic object ────────────────────────────────────────────────────
const createDefaultLogic = () => ({
  enabled: true,
  logic_type: "is" as "is" | "is_not",
  comparision: "equals" as string,
  logic_value: "",
  subQuestions: [] as Question[],
  notification: {
    enabled: false,
    users: [] as string[],
    groups: [] as string[],
    emails: "",
  },
  follow_up: {
    enabled: false,
    followup_toggle: false,
    title: "",
    description: "",
    deadline: 0,
    assign_to: "form_submitter" as const,
    assign_form: "",
    assignFormUser: "",
    assignFormSubmitter: false,
    assignUsers: [] as string[],
    assignGroups: [] as string[],
    task_close_questions: [] as any[],
  },
})

// ─── Parsed question from Excel ──────────────────────────────────────────────
interface ParsedGroup {
  groupName: string
  questions: ParsedQuestion[]
}

interface ParsedQuestion {
  title: string
  type: QuestionType
  options: string[]
  optionMarks: number[]
  referenceVideo: string
  referenceImage: string
  required: boolean
  critical: boolean
}

// ─── Bulk logic type ─────────────────────────────────────────────────────────
interface BulkLogic {
  id: string
  logic_type: "is" | "is_not"
  comparision: string
  logic_value: string
  subQuestions: Question[]
  notification: {
    enabled: boolean
    users: string[]
    groups: string[]
    emails: string
  }
  follow_up: {
    enabled: boolean
    followup_toggle: boolean
    title: string
    description: string
    deadline: number
    assign_to: "form_submitter"
    assign_form: string
    assignFormUser: string
    assignFormSubmitter: boolean
    assignUsers: string[]
    assignGroups: string[]
    task_close_questions: any[]
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface BulkImportModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  activeStage: string | null
  questionTypes: any[]
  questionTypesObj: any[]
  users: any[]
  groups: any[]
  allForms: any[]
  formId: number
}

// ─── Component ───────────────────────────────────────────────────────────────
export function BulkImportModal({
  open,
  onOpenChange,
  formData,
  setFormData,
  activeStage,
  questionTypes,
  questionTypesObj,
  users,
  groups,
  allForms,
  formId,
}: BulkImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedGroups, setParsedGroups] = useState<ParsedGroup[]>([])
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [bulkLogics, setBulkLogics] = useState<BulkLogic[]>([])
  const [appliedFromStep1, setAppliedFromStep1] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ─── Reset state when modal closes ──────────────────────────────────────────
  const resetState = useCallback(() => {
    setStep(1)
    setFile(null)
    setParsedGroups([])
    setSelectedQuestionIds(new Set())
    setCollapsedGroups(new Set())
    setBulkLogics([])
    setAppliedFromStep1(false)
  }, [])

  // ─── Compute available options from ALL questions with options ─────────────
  const availableOptions = useMemo(() => {
    const opts: string[] = []
    const seen = new Set<string>()
    formData.stages.forEach((stage) => {
      stage.questions.forEach((q) => {
        const qOpts = q.type === "audit"
          ? (q.auditOptions || []).map((o) => o.option)
          : (q.options || [])
        qOpts.forEach((opt) => {
          const trimmed = opt?.trim()
          if (trimmed && !seen.has(trimmed)) {
            seen.add(trimmed)
            opts.push(trimmed)
          }
        })
      })
    })
    return opts
  }, [formData.stages])

  // ─── Bulk import options for a sub-question via CSV ─────────────────────────
  const handleBulkImportSubQuestionOptions = useCallback((
    logicId: string,
    subQId: string,
    csvText: string
  ) => {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => !!l)
    if (lines.length === 0) {
      hotToaster.error("CSV file is empty.")
      return
    }
    let optionLines = lines
    const firstLine = lines[0].toLowerCase()
    if (firstLine === "option" || firstLine === "options") {
      optionLines = lines.slice(1)
    }
    const importedOptions = Array.from(
      new Set(optionLines.map((o) => o.trim()).filter((o) => !!o))
    )
    if (importedOptions.length === 0) {
      hotToaster.error("No valid options found in CSV.")
      return
    }
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? {
              ...l,
              subQuestions: l.subQuestions.map((sq) =>
                sq.id === subQId
                  ? {
                      ...sq,
                      options: Array.from(
                        new Set([...(sq.options || []), ...importedOptions])
                      ),
                    }
                  : sq
              ),
            }
          : l
      )
    )
    hotToaster.success(`${importedOptions.length} option(s) imported.`)
  }, [])

  // ─── Step 1: Download template ──────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers: string[] = [
      "Question type",
      "Group name",
      "Question",
    ]
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      headers.push(`Option ${i}`)
    }
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      headers.push(`Option Mark ${i}`)
    }
    headers.push("Reference Video")
    headers.push("Reference Image")
    headers.push("Required")
    headers.push("Critical")

    const sampleRow: (string | number)[] = [
      "Audit",
      "Group 1",
      "Sample audit question",
      "Pass",
      "Needs Improvement",
      "Fail",
      ...Array(MAX_OPTIONS - 3).fill(""),
      5,
      3,
      0,
      ...Array(MAX_OPTIONS - 3).fill(""),
      "",
      "",
      "Yes",
      "No",
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow])
    // Set column widths
    ws["!cols"] = headers.map((h, i) => ({
      wch: h.startsWith("Option") ? 12 : 20,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Questions Template")
    XLSX.writeFile(wb, "form_questions_template.xlsx")
    hotToaster.success("Template downloaded successfully")
  }

  // ─── Step 1: Parse uploaded file ────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    parseExcelFile(selectedFile)
  }

  const parseExcelFile = (selectedFile: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        })

        if (rows.length < 2) {
          hotToaster.error("Template is empty or has no data rows")
          return
        }

        const headers = rows[0].map((h: any) => String(h).trim().toLowerCase())
        const colMap: Record<string, number> = {}
        headers.forEach((h: string, i: number) => {
          colMap[h] = i
        })

        // Find option columns dynamically
        const optionColIndices: number[] = []
        const optionMarkColIndices: number[] = []
        for (let i = 1; i <= MAX_OPTIONS; i++) {
          const optKey = `option ${i}`
          const markKey = `option mark ${i}`
          if (colMap[optKey] !== undefined) optionColIndices.push(colMap[optKey])
          if (colMap[markKey] !== undefined) optionMarkColIndices.push(colMap[markKey])
        }

        const groupNameIdx = colMap["group name"]
        const questionIdx = colMap["question"] ?? colMap["questions"]
        const typeIdx = colMap["question type"]
        const refVideoIdx = colMap["reference video"]
        const refImageIdx = colMap["reference image"]
        const requiredIdx = colMap["required"]
        const criticalIdx = colMap["critical"]

        if (groupNameIdx === undefined || questionIdx === undefined || typeIdx === undefined) {
          hotToaster.error("Template missing required columns: Group name, Question, Question type")
          return
        }

        const groupMap = new Map<string, ParsedQuestion[]>()

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r]
          const groupName = String(row[groupNameIdx] || "").trim()
          const questionTitle = String(row[questionIdx] || "").trim()
          if (!groupName && !questionTitle) continue
          if (!questionTitle) continue

          const typeLabel = String(row[typeIdx] || "").trim().toLowerCase()
          const questionType = LABEL_TO_TYPE[typeLabel]
          if (!questionType || !["audit", "multiple_choice", "dropdown", "checkboxes"].includes(questionType)) {
            hotToaster.error(`Row ${r + 1}: Question type must be Audit, Multiple Choice, Dropdown, or Checkboxes.`)
            return
          }

          const options: string[] = []
          const optionMarks: number[] = []
          optionColIndices.forEach((optionIndex, index) => {
            const optVal = String(row[optionIndex] || "").trim()
            if (!optVal) return
            options.push(optVal)
            const markIndex = optionMarkColIndices[index]
            const markVal = markIndex === undefined ? "" : row[markIndex]
            optionMarks.push(markVal === "" || markVal === null || markVal === undefined ? 0 : Number(markVal) || 0)
          })

          if (options.length === 0) {
            hotToaster.error(`Row ${r + 1}: ${QUESTION_TYPE_LABELS[questionType]} questions require at least one option.`)
            return
          }

          const refVideo = refVideoIdx !== undefined ? String(row[refVideoIdx] || "").trim() : ""
          const refImage = refImageIdx !== undefined ? String(row[refImageIdx] || "").trim() : ""
          const requiredVal = requiredIdx !== undefined ? String(row[requiredIdx] || "").trim().toLowerCase() : ""
          const criticalVal = criticalIdx !== undefined ? String(row[criticalIdx] || "").trim().toLowerCase() : ""

          const parsedQ: ParsedQuestion = {
            title: questionTitle,
            type: questionType,
            options: options.length > 0 ? options : OPTION_TYPES.includes(questionType) ? ["", ""] : [],
            optionMarks,
            referenceVideo: refVideo,
            referenceImage: refImage,
            required: requiredVal === "yes" || requiredVal === "true" || requiredVal === "1",
            critical: criticalVal === "yes" || criticalVal === "true" || criticalVal === "1",
          }

          const gName = groupName || "Group 1"
          if (!groupMap.has(gName)) {
            groupMap.set(gName, [])
          }
          groupMap.get(gName)!.push(parsedQ)
        }

        const groupsArr: ParsedGroup[] = Array.from(groupMap.entries()).map(([name, questions]) => ({
          groupName: name,
          questions,
        }))

        setParsedGroups(groupsArr)
        hotToaster.success(`Parsed ${groupsArr.length} groups with ${groupsArr.reduce((s, g) => s + g.questions.length, 0)} questions`)
      } catch (err) {
        console.error("Error parsing file:", err)
        hotToaster.error("Failed to parse the uploaded file")
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  // ─── Step 1: Apply parsed data to formData ──────────────────────────────────
  const applyParsedData = () => {
    if (parsedGroups.length === 0) {
      hotToaster.error("No data to apply. Please upload a valid template.")
      return
    }

    setFormData((prev) => {
      const newStages: Stage[] = [...prev.stages]

      parsedGroups.forEach((pg) => {
        const groupName = stripNumbering(pg.groupName) || pg.groupName
        const numberedStageIndexes = newStages
          .map((_, index) => index)
          .filter((index) => prev.type !== "audit" || index !== 0)

        // Check if a stage with this name already exists
        const existingIdx = newStages.findIndex(
          (s, index) => (prev.type !== "audit" || index !== 0)
            && stripNumbering(s.title).toLowerCase() === groupName.toLowerCase()
        )
        const existingGroupIndex = numberedStageIndexes.indexOf(existingIdx)
        const groupNumber = (existingGroupIndex >= 0
          ? existingGroupIndex
          : numberedStageIndexes.length) + 1
        const existingQuestionCount = existingIdx >= 0 ? newStages[existingIdx].questions.length : 0
        const numberedGroupTitle = `${groupNumber}. ${groupName}`

        const questions: Question[] = pg.questions.map((pq, questionIndex) => {
          const qId = `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const baseQ: Question = {
            id: qId,
            type: pq.type,
            title: `${groupNumber}.${existingQuestionCount + questionIndex + 1} ${stripNumbering(pq.title) || pq.title}`,
            required: pq.required,
            critical: pq.critical,
            subQuestions: [],
            conditionalLogics: [],
          }

          if (OPTION_TYPES.includes(pq.type)) {
            baseQ.options = pq.options.length > 0 ? pq.options : ["", ""]
          }

          if (pq.type === "linear_scale") {
            baseQ.from = 1
            baseQ.to = 5
          }

          if (pq.type === "audit" && pq.options.length > 0) {
            baseQ.auditOptions = pq.options.map((opt, i) => ({
              option: opt,
              score: pq.optionMarks[i] ?? 0,
              order: i + 1,
            }))
            baseQ.maxScore = Math.max(...pq.optionMarks.map(m => Number(m) || 0), 0)
          }

          if (pq.referenceVideo) {
            baseQ.referenceVideoEnabled = true
            baseQ.referenceVideos = [pq.referenceVideo]
          }

          if (pq.referenceImage) {
            baseQ.referenceImageEnabled = true
            baseQ.referenceImages = [pq.referenceImage]
          }

          return baseQ
        })

        if (existingIdx >= 0) {
          // Append questions to existing stage
          newStages[existingIdx] = {
            ...newStages[existingIdx],
            title: numberedGroupTitle,
            questions: [...newStages[existingIdx].questions, ...questions],
          }
        } else {
          // Create new stage
          const stageId = `stage${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          newStages.push({
            id: stageId,
            originalId: stageId,
            title: numberedGroupTitle,
            questions,
          })
        }
      })

      return applyFinalNumbering({ ...prev, stages: newStages })
    })

    setAppliedFromStep1(true)
    hotToaster.success("Questions imported successfully!")
    setStep(2)
  }

  // ─── Step 2: Proceed to Step 3 (Logic) ───────────────────────────────────
  const proceedToLogic = () => {
    if (selectedQuestionIds.size === 0) {
      hotToaster.error("Please select at least one question to apply logic to.")
      return
    }
    setStep(3)
  }

  // ─── Step 2: Toggle question selection ─────────────────────────────────────
  const toggleQuestionSelection = useCallback((qId: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(qId)) {
        next.delete(qId)
      } else {
        next.add(qId)
      }
      return next
    })
  }, [])

  const selectAllQuestions = useCallback(() => {
    const allIds = new Set<string>()
    formData.stages.forEach((stage) => {
      stage.questions.forEach((q) => {
        if (LOGIC_TYPES.includes(q.type)) {
          allIds.add(q.id)
        }
      })
    })
    setSelectedQuestionIds(allIds)
  }, [formData.stages])

  const deselectAllQuestions = useCallback(() => {
    setSelectedQuestionIds(new Set())
  }, [])

  const toggleGroupCollapse = useCallback((stageId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
  }, [])

  // ─── Step 3: Bulk logic management ──────────────────────────────────────────
  const addBulkLogic = useCallback(() => {
    const newLogic: BulkLogic = {
      id: `logic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...createDefaultLogic(),
    }
    setBulkLogics((prev) => [...prev, newLogic])
  }, [])

  const removeBulkLogic = useCallback((logicId: string) => {
    setBulkLogics((prev) => prev.filter((l) => l.id !== logicId))
  }, [])

  const duplicateBulkLogic = useCallback((logicId: string) => {
    setBulkLogics((prev) => {
      const logic = prev.find((l) => l.id === logicId)
      if (!logic) return prev
      const copy: BulkLogic = {
        ...JSON.parse(JSON.stringify(logic)),
        id: `logic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }
      const idx = prev.findIndex((l) => l.id === logicId)
      const updated = [...prev]
      updated.splice(idx + 1, 0, copy)
      return updated
    })
  }, [])

  const updateBulkLogic = useCallback((logicId: string, field: string, value: any) => {
    setBulkLogics((prev) =>
      prev.map((l) => (l.id === logicId ? { ...l, [field]: value } : l))
    )
  }, [])

  const updateBulkLogicNotification = useCallback((logicId: string, partial: any) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? { ...l, notification: { ...l.notification, ...partial } }
          : l
      )
    )
  }, [])

  const updateBulkLogicFollowUp = useCallback((logicId: string, partial: any) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? { ...l, follow_up: { ...l.follow_up, ...partial } }
          : l
      )
    )
  }, [])

  // Sub-question management within a bulk logic
  const addSubQuestionToLogic = useCallback((logicId: string, type: QuestionType) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? {
              ...l,
              subQuestions: [
                ...l.subQuestions,
                {
                  id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  type,
                  title: "",
                  required: false,
                  subQuestions: [],
                  ...(OPTION_TYPES.includes(type) ? { options: ["", ""] } : {}),
                  ...(type === "linear_scale" ? { from: 1, to: 5 } : {}),
                },
              ],
            }
          : l
      )
    )
  }, [])

  const updateSubQuestionInLogic = useCallback((
    logicId: string,
    subQId: string,
    field: keyof Question,
    value: any
  ) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? {
              ...l,
              subQuestions: l.subQuestions.map((sq) =>
                sq.id === subQId ? { ...sq, [field]: value } : sq
              ),
            }
          : l
      )
    )
  }, [])

  const deleteSubQuestionFromLogic = useCallback((logicId: string, subQId: string) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? { ...l, subQuestions: l.subQuestions.filter((sq) => sq.id !== subQId) }
          : l
      )
    )
  }, [])

  const addOptionToSubQuestionInLogic = useCallback((logicId: string, subQId: string) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? {
              ...l,
              subQuestions: l.subQuestions.map((sq) =>
                sq.id === subQId
                  ? { ...sq, options: [...(sq.options || []), ""] }
                  : sq
              ),
            }
          : l
      )
    )
  }, [])

  const updateOptionInSubQuestionInLogic = useCallback((
    logicId: string,
    subQId: string,
    optIdx: number,
    value: string
  ) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? {
              ...l,
              subQuestions: l.subQuestions.map((sq) =>
                sq.id === subQId
                  ? {
                      ...sq,
                      options: (sq.options || []).map((opt, i) =>
                        i === optIdx ? value : opt
                      ),
                    }
                  : sq
              ),
            }
          : l
      )
    )
  }, [])

  const deleteOptionFromSubQuestionInLogic = useCallback((
    logicId: string,
    subQId: string,
    optIdx: number
  ) => {
    setBulkLogics((prev) =>
      prev.map((l) =>
        l.id === logicId
          ? {
              ...l,
              subQuestions: l.subQuestions.map((sq) =>
                sq.id === subQId
                  ? {
                      ...sq,
                      options: (sq.options || []).filter((_, i) => i !== optIdx),
                    }
                  : sq
              ),
            }
          : l
      )
    )
  }, [])

  // ─── Duplicate a sub-question within a logic rule ───────────────────────────
  const duplicateSubQuestionInLogic = useCallback((logicId: string, subQId: string) => {
    setBulkLogics((prev) =>
      prev.map((l) => {
        if (l.id !== logicId) return l
        const subQ = l.subQuestions.find((sq) => sq.id === subQId)
        if (!subQ) return l
        const newId = `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const dup: Question = {
          ...subQ,
          id: newId,
          subQuestions: [],
          options: subQ.options ? [...subQ.options] : undefined,
          auditOptions: subQ.auditOptions ? subQ.auditOptions.map((o) => ({ ...o })) : undefined,
        }
        const idx = l.subQuestions.findIndex((sq) => sq.id === subQId)
        const newSubQs = [...l.subQuestions]
        newSubQs.splice(idx + 1, 0, dup)
        return { ...l, subQuestions: newSubQs }
      })
    )
  }, [])

  // ─── Move sub-question up/down within a logic rule ──────────────────────────
  const moveSubQuestionInLogic = useCallback((logicId: string, subQId: string, dir: "up" | "down") => {
    setBulkLogics((prev) =>
      prev.map((l) => {
        if (l.id !== logicId) return l
        const idx = l.subQuestions.findIndex((sq) => sq.id === subQId)
        if (idx < 0) return l
        const newIdx = dir === "up" ? idx - 1 : idx + 1
        if (newIdx < 0 || newIdx >= l.subQuestions.length) return l
        const newSubQs = [...l.subQuestions]
        ;[newSubQs[idx], newSubQs[newIdx]] = [newSubQs[newIdx], newSubQs[idx]]
        return { ...l, subQuestions: newSubQs }
      })
    )
  }, [])

  // ─── Reorder options within a sub-question ──────────────────────────────────
  const reorderOptionsInSubQuestion = useCallback((logicId: string, subQId: string, fromIdx: number, toIdx: number) => {
    setBulkLogics((prev) =>
      prev.map((l) => {
        if (l.id !== logicId) return l
        return {
          ...l,
          subQuestions: l.subQuestions.map((sq) => {
            if (sq.id !== subQId || !sq.options) return sq
            const opts = [...sq.options]
            const [moved] = opts.splice(fromIdx, 1)
            opts.splice(toIdx, 0, moved)
            return { ...sq, options: opts }
          }),
        }
      })
    )
  }, [])

  // ─── Reorder audit options within a sub-question ────────────────────────────
  const reorderAuditOptionsInSubQuestion = useCallback((logicId: string, subQId: string, fromIdx: number, toIdx: number) => {
    setBulkLogics((prev) =>
      prev.map((l) => {
        if (l.id !== logicId) return l
        return {
          ...l,
          subQuestions: l.subQuestions.map((sq) => {
            if (sq.id !== subQId || !sq.auditOptions) return sq
            const opts = [...sq.auditOptions]
            const [moved] = opts.splice(fromIdx, 1)
            opts.splice(toIdx, 0, moved)
            return { ...sq, auditOptions: opts }
          }),
        }
      })
    )
  }, [])

  // ─── Get question type icon (simplified version) ────────────────────────────
  const getQTypeIcon = useCallback((type: QuestionType): React.ReactElement => {
    const cls = "h-4 w-4"
    switch (type) {
      case "short_answer":
      case "text":
        return <Type className={cls} />
      case "long_answer":
      case "title_and_description":
      case "signature":
        return <FileText className={cls} />
      case "multiple_choice":
      case "checkboxes":
        return <CheckSquare className={cls} />
      case "dropdown":
      case "audit":
        return <CircleChevronDown className={cls} />
      case "linear_scale":
        return <Ruler className={cls} />
      case "date":
      case "datetime":
        return <Calendar className={cls} />
      case "time":
        return <Clock className={cls} />
      case "formula":
        return <Calculator className={cls} />
      case "upload_image":
        return <ImageIcon className={cls} />
      case "upload_video":
        return <VideoIcon className={cls} />
      case "upload_file":
        return <FileIcon className={cls} />
      case "qr_code":
        return <QrCode className={cls} />
      case "location":
        return <MapPin className={cls} />
      case "user":
        return <User className={cls} />
      case "division":
      case "sub_division":
        return <Layers className={cls} />
      default:
        return <FileText className={cls} />
    }
  }, [])

  // ─── Adapter handlers for QuestionEditor (stageId=logicId, questionId=subQId) ─
  const adapterHandlers = useMemo(() => ({
    handleQuestionUpdate: (stageId: string, questionId: string, field: keyof Question, value: any) =>
      updateSubQuestionInLogic(stageId, questionId, field, value),
    handleAddSubQuestion: (stageId: string, _parentQuestionId: string, type: QuestionType) =>
      addSubQuestionToLogic(stageId, type),
    handleUpdateSubQuestion: (stageId: string, _parentQuestionId: string, subQuestionId: string, field: keyof Question, value: any) =>
      updateSubQuestionInLogic(stageId, subQuestionId, field, value),
    handleDeleteSubQuestion: (stageId: string, _parentQuestionId: string, subQuestionId: string) =>
      deleteSubQuestionFromLogic(stageId, subQuestionId),
    handleUpdateOption: (stageId: string, _parentQuestionId: string, subQuestionId: string | null, optionIndex: number, value: string) => {
      if (subQuestionId) {
        updateOptionInSubQuestionInLogic(stageId, subQuestionId, optionIndex, value)
      }
    },
    addOptionToParentQuestion: (stageId: string, questionId: string) =>
      addOptionToSubQuestionInLogic(stageId, questionId),
    addOptionToSubQuestion: (stageId: string, _parentQuestionId: string, subQuestionId: string) =>
      addOptionToSubQuestionInLogic(stageId, subQuestionId),
    deleteOptionFromParentQuestion: (stageId: string, questionId: string, optionIndex: number) =>
      deleteOptionFromSubQuestionInLogic(stageId, questionId, optionIndex),
    deleteOptionFromSubQuestion: (stageId: string, _parentQuestionId: string, subQuestionId: string, optionIndex: number) =>
      deleteOptionFromSubQuestionInLogic(stageId, subQuestionId, optionIndex),
    handleMoveQuestionUp: (stageId: string, _parentQuestionId: string, subQuestionId: string) =>
      moveSubQuestionInLogic(stageId, subQuestionId, "up"),
    handleMoveQuestionDown: (stageId: string, _parentQuestionId: string, subQuestionId: string) =>
      moveSubQuestionInLogic(stageId, subQuestionId, "down"),
    handleDuplicateQuestion: (stageId: string, _parentQuestionId: string, subQuestionId: string) =>
      duplicateSubQuestionInLogic(stageId, subQuestionId),
    handleDuplicateSubQuestion: (stageId: string, _parentQuestionId: string, subQuestionId: string) =>
      duplicateSubQuestionInLogic(stageId, subQuestionId),
    handleReorderOptions: (stageId: string, questionId: string, fromIndex: number, toIndex: number) =>
      reorderOptionsInSubQuestion(stageId, questionId, fromIndex, toIndex),
    handleReorderAuditOptions: (stageId: string, questionId: string, fromIndex: number, toIndex: number) =>
      reorderAuditOptionsInSubQuestion(stageId, questionId, fromIndex, toIndex),
    getQuestionTypeIcon: getQTypeIcon,
    MoveUpIcon: MoveUp,
    MoveDownIcon: MoveDown,
    CopyIcon: Copy,
  }), [
    addOptionToSubQuestionInLogic,
    addSubQuestionToLogic,
    deleteOptionFromSubQuestionInLogic,
    deleteSubQuestionFromLogic,
    duplicateSubQuestionInLogic,
    getQTypeIcon,
    moveSubQuestionInLogic,
    reorderAuditOptionsInSubQuestion,
    reorderOptionsInSubQuestion,
    updateOptionInSubQuestionInLogic,
    updateSubQuestionInLogic,
  ])

  // ─── Step 3: Apply bulk logics to selected questions ────────────────────────
  const applyBulkLogics = () => {
    if (selectedQuestionIds.size === 0) {
      hotToaster.error("Please select at least one question to apply logic to.")
      return
    }
    if (bulkLogics.length === 0) {
      hotToaster.error("Please add at least one logic rule.")
      return
    }

    // Validate logics
    for (const logic of bulkLogics) {
      if (!logic.logic_value || logic.logic_value.trim() === "") {
        hotToaster.error("All logic rules must have a value set.")
        return
      }
      if (!logic.subQuestions || logic.subQuestions.length === 0) {
        hotToaster.error("All logic rules must have at least one sub-question.")
        return
      }
      for (const subQ of logic.subQuestions) {
        if (!subQ.title || subQ.title.trim() === "") {
          hotToaster.error("All sub-questions must have a title.")
          return
        }
      }
    }

    // Helper: deep-clone a single logic with fresh IDs for sub-questions
    const cloneLogicWithUniqueIds = (bl: BulkLogic): any => {
      const logicCopy: any = JSON.parse(JSON.stringify(bl))
      delete logicCopy.id
      logicCopy.subQuestions = logicCopy.subQuestions.map((sq: any) => ({
        ...sq,
        id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }))
      if (Array.isArray(logicCopy.follow_up?.task_close_questions)) {
        logicCopy.follow_up.task_close_questions = logicCopy.follow_up.task_close_questions.map((closeQuestion: any) => ({
          ...closeQuestion,
          question_uuid: `close-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }))
      }
      return logicCopy
    }

    setFormData((prev) => applyFinalNumbering({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        questions: stage.questions.map((q) => {
          if (selectedQuestionIds.has(q.id)) {
            // Clone logics fresh for EACH question so sub-question IDs are unique per question
            const freshLogics = bulkLogics.map(cloneLogicWithUniqueIds)
            return {
              ...q,
              conditionalLogics: [
                ...(q.conditionalLogics || []),
                ...freshLogics,
              ],
            }
          }
          return q
        }),
      })),
    }))

    hotToaster.success(
      `Logic applied to ${selectedQuestionIds.size} question${selectedQuestionIds.size > 1 ? "s" : ""}!`
    )
    resetState()
    onOpenChange(false)
  }

  // ─── Get question type label ────────────────────────────────────────────────
  const getQTypeLabel = useCallback((type: QuestionType) => {
    return questionTypesObj.find((q) => q.value === type)?.label || QUESTION_TYPE_LABELS[type] || "Unknown"
  }, [questionTypesObj])

  // ─── Memoized Step 2 question selection list ────────────────────────────────
  const questionSelectionList = useMemo(() => {
    const stagesWithLogic = formData.stages.filter((stage) =>
      stage.questions.some((q) => LOGIC_TYPES.includes(q.type))
    )

    if (stagesWithLogic.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No questions with logic-compatible types found.</p>
          <p className="text-sm mt-1">
            Import questions from Step 1 first, or add questions manually.
          </p>
        </div>
      )
    }

    return (
      <>
        {stagesWithLogic.map((stage) => {
          const logicQuestions = stage.questions.filter((q) =>
            LOGIC_TYPES.includes(q.type)
          )
          const isCollapsed = collapsedGroups.has(stage.id)
          const allSelected = logicQuestions.every((q) =>
            selectedQuestionIds.has(q.id)
          )

          return (
            <div key={stage.id} className="border rounded-lg">
              {/* Group header */}
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-t-lg">
                <button
                  onClick={() => toggleGroupCollapse(stage.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedQuestionIds((prev) => {
                        const next = new Set(prev)
                        logicQuestions.forEach((q) => next.add(q.id))
                        return next
                      })
                    } else {
                      setSelectedQuestionIds((prev) => {
                        const next = new Set(prev)
                        logicQuestions.forEach((q) => next.delete(q.id))
                        return next
                      })
                    }
                  }}
                />
                <span className="font-medium text-sm">{stage.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {logicQuestions.length} questions
                </Badge>
              </div>

              {/* Questions list */}
              {!isCollapsed && (
                <div className="p-2 space-y-1">
                  {logicQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded text-sm"
                    >
                      <Checkbox
                        checked={selectedQuestionIds.has(q.id)}
                        onCheckedChange={() => toggleQuestionSelection(q.id)}
                      />
                      <span className="flex-1 truncate">
                        {q.title || "(untitled)"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getQTypeLabel(q.type)}
                      </Badge>
                      {q.options && q.options.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {q.options.filter((o) => o).length} options
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }, [formData.stages, collapsedGroups, selectedQuestionIds, getQTypeLabel, toggleGroupCollapse, toggleQuestionSelection])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(v) => {
        if (!v) {
          setShowDiscardDialog(true)
        } else {
          onOpenChange(v)
        }
      }}>
        <DialogContent
          className={`
            w-full
            max-w-lg
            sm:max-w-2xl
            md:max-w-4xl
            lg:max-w-6xl
            max-h-[90vh]
            overflow-y-auto
            rounded-lg
            p-0
            ${open ? "bg-gray-200" : "bg-white"}
            [&>button]:hidden
          `}
          style={{ padding: 0 }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle>Bulk Import</DialogTitle>
                <DialogDescription className="sr-only">
                  Bulk import questions and configure conditional logic
                </DialogDescription>
                {/* Step indicator */}
                <div className="flex items-center gap-2 ml-4">
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 1 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                    <span className="font-medium">Step 1: Upload</span>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 2 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                    <span className="font-medium">Step 2: Select Questions</span>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 3 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                    <span className="font-medium">Step 3: Logic</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDiscardDialog(true)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {/* ─── Step 1: Upload ──────────────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-4 pt-4">
                  {/* Download template */}
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-blue-900">Download Template</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          Download the Excel template with Question type as the first column, followed by Group name,
                          Question, Options (1-{MAX_OPTIONS}), Option Marks (1-{MAX_OPTIONS}), Reference Video,
                          Reference Image, Required, Critical
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        onClick={handleDownloadTemplate}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>

                  {/* Upload area */}
                  <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop your file here, or click to browse
                    </p>
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Browse Files
                    </Button>
                  </div>

                  {file && (
                    <div className="rounded-md bg-muted p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setFile(null)
                          setParsedGroups([])
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Parsed preview */}
                  {parsedGroups.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <h3 className="font-medium text-green-700">
                          Parsed {parsedGroups.length} groups with{" "}
                          {parsedGroups.reduce((s, g) => s + g.questions.length, 0)} questions
                        </h3>
                      </div>

                      <div className="max-h-[300px] overflow-y-auto space-y-3 rounded-lg border bg-white p-3">
                        {parsedGroups.map((pg, gi) => {
                          const groupOffset = formData.stages.filter((_, index) => formData.type !== "audit" || index !== 0).length
                          const groupNumber = groupOffset + gi + 1

                          return (
                          <div key={gi} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary">{groupNumber}. {stripNumbering(pg.groupName) || pg.groupName}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {pg.questions.length} question{pg.questions.length > 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {pg.questions.map((pq, qi) => (
                                <div
                                  key={qi}
                                  className="flex items-center justify-between text-sm py-1 px-2 hover:bg-gray-50 rounded"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="truncate">{groupNumber}.{qi + 1} {stripNumbering(pq.title) || pq.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline" className="text-xs">
                                      {getQTypeLabel(pq.type)}
                                    </Badge>
                                    {pq.required && (
                                      <Badge variant="outline" className="text-xs text-red-600">
                                        Required
                                      </Badge>
                                    )}
                                    {pq.critical && (
                                      <Badge variant="outline" className="text-xs text-orange-600">
                                        Critical
                                      </Badge>
                                    )}
                                    {pq.options.length > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {pq.options.length} options
                                      </span>
                                    )}
                                    {pq.type === "audit" && (
                                      <span className="text-xs text-muted-foreground">
                                        Marks: {pq.optionMarks.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Info box */}
                  <div className="rounded-md bg-yellow-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Template Requirements
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <ul className="list-disc pl-5 space-y-1">
                            <li>File must be in CSV or Excel format (.xlsx, .xls)</li>
                            <li>Required columns: Question type, Group name, Question</li>
                            <li>Question type values: Audit, Multiple Choice, Dropdown, Checkboxes</li>
                            <li>Options are required for all supported question types</li>
                            <li>For Audit, each Option Mark is saved with its matching option and used for scoring</li>
                            <li>Required and Critical columns accept "Yes" or "No"</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 2: Select Questions ────────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-4 pt-4">
                  {/* Question selection */}
                  <div className="rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Select Questions for Logic</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllQuestions}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={deselectAllQuestions}>
                          Deselect All
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Only questions with types that support conditional logic are shown
                      (Multiple Choice, Dropdown, Checkboxes, Short Answer, Linear Scale, Audit).
                    </p>

                    <div className="max-h-[450px] overflow-y-auto space-y-2">
                      {questionSelectionList}
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      {selectedQuestionIds.size} question{selectedQuestionIds.size !== 1 ? "s" : ""} selected
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Logic Configuration ────────────────────────────── */}
              {step === 3 && (
                <div className="space-y-4 pt-4">
                  {/* Selected questions summary */}
                  <div className="rounded-lg border bg-blue-50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {selectedQuestionIds.size} question{selectedQuestionIds.size !== 1 ? "s" : ""} selected for logic
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                      Change Selection
                    </Button>
                  </div>

                  {/* Bulk logic configuration */}
                  <div className="rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Conditional Logic Rules</h3>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-teal-600 text-white hover:bg-teal-700"
                        onClick={addBulkLogic}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add Logic
                      </Button>
                    </div>

                    {bulkLogics.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No logic rules added yet.</p>
                        <p className="text-sm mt-1">
                          Click "Add Logic" to create a conditional logic rule that will be applied to all selected questions.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {bulkLogics.map((logic, idx) => (
                          <div
                            key={logic.id}
                            className="border-l-4 border-blue-400 rounded-lg p-4 bg-gray-50"
                          >
                            {/* Logic header */}
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-lg font-medium">Logic {idx + 1}</Label>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-blue-500 hover:bg-blue-300 text-white"
                                  onClick={() => duplicateBulkLogic(logic.id)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-red-500 hover:bg-red-300 text-white"
                                  onClick={() => removeBulkLogic(logic.id)}
                                >
                                  <CircleX className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Condition + Value */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div>
                                <Label htmlFor={`bulk-logic-${idx}-condition`}>Condition</Label>
                                <Select
                                  value={logic.logic_type}
                                  onValueChange={(value) =>
                                    updateBulkLogic(logic.id, "logic_type", value)
                                  }
                                >
                                  <SelectTrigger id={`bulk-logic-${idx}-condition`} className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="is">Is</SelectItem>
                                    <SelectItem value="is_not">Is Not</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`bulk-logic-${idx}-value`}>Value</Label>
                                {availableOptions.length > 0 ? (
                                  <Select
                                    value={logic.logic_value || ""}
                                    onValueChange={(value) =>
                                      updateBulkLogic(logic.id, "logic_value", value)
                                    }
                                  >
                                    <SelectTrigger id={`bulk-logic-${idx}-value`} className="mt-1">
                                      <SelectValue placeholder="Select a value" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableOptions.map((opt, oi) => (
                                        <SelectItem key={oi} value={opt}>
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    id={`bulk-logic-${idx}-value`}
                                    value={logic.logic_value}
                                    onChange={(e) =>
                                      updateBulkLogic(logic.id, "logic_value", e.target.value)
                                    }
                                    className="mt-1"
                                    placeholder="Select questions first to see options"
                                  />
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {availableOptions.length > 0
                                    ? `${availableOptions.length} unique option(s) from all imported questions`
                                    : "No options found. Import questions with options in Step 1."}
                                </p>
                              </div>
                            </div>

                            {/* Sub-questions */}
                            <div className="border rounded-lg p-3 bg-white mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">
                                  Sub-Questions (Follow-up Questions)
                                </Label>
                                <Select
                                  value=""
                                  onValueChange={(value) =>
                                    addSubQuestionToLogic(logic.id, value as QuestionType)
                                  }
                                >
                                  <SelectTrigger className="w-auto h-8 text-xs">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Sub-Question
                                  </SelectTrigger>
                                  <SelectContent>
                                    {questionTypes.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {getQTypeLabel(type as QuestionType)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {logic.subQuestions.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">
                                  No sub-questions added. Add at least one follow-up question.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {logic.subQuestions.map((subQ, subIdx) => (
                                    <div
                                      key={subQ.id}
                                      className="border rounded-lg p-3 bg-gray-50"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium">
                                          Sub-Question {subIdx + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={subIdx === 0}
                                            onClick={() =>
                                              moveSubQuestionInLogic(logic.id, subQ.id, "up")
                                            }
                                          >
                                            <MoveUp className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            disabled={subIdx === logic.subQuestions.length - 1}
                                            onClick={() =>
                                              moveSubQuestionInLogic(logic.id, subQ.id, "down")
                                            }
                                          >
                                            <MoveDown className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() =>
                                              duplicateSubQuestionInLogic(logic.id, subQ.id)
                                            }
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() =>
                                              deleteSubQuestionFromLogic(logic.id, subQ.id)
                                            }
                                          >
                                            <Trash className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Sub-question type selector */}
                                      <div className="mb-2">
                                        <Label className="text-xs">Type</Label>
                                        <Select
                                          value={subQ.type}
                                          onValueChange={(value) =>
                                            updateSubQuestionInLogic(
                                              logic.id,
                                              subQ.id,
                                              "type",
                                              value as QuestionType
                                            )
                                          }
                                        >
                                          <SelectTrigger className="mt-1 h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {questionTypes.map((type) => (
                                              <SelectItem key={type} value={type}>
                                                {getQTypeLabel(type as QuestionType)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {/* Full QuestionEditor for all type-specific features */}
                                      <QuestionEditor
                                        validationError={false}
                                        validationErrors={{}}
                                        questions={logic.subQuestions}
                                        question={subQ}
                                        stageId={logic.id}
                                        questionTypes={questionTypes}
                                        questionTypesObj={questionTypesObj}
                                        handleQuestionUpdate={adapterHandlers.handleQuestionUpdate}
                                        handleAddSubQuestion={adapterHandlers.handleAddSubQuestion}
                                        handleUpdateSubQuestion={adapterHandlers.handleUpdateSubQuestion}
                                        handleDeleteSubQuestion={adapterHandlers.handleDeleteSubQuestion}
                                        handleUpdateOption={adapterHandlers.handleUpdateOption}
                                        addOptionToParentQuestion={adapterHandlers.addOptionToParentQuestion}
                                        addOptionToSubQuestion={adapterHandlers.addOptionToSubQuestion}
                                        deleteOptionFromParentQuestion={adapterHandlers.deleteOptionFromParentQuestion}
                                        deleteOptionFromSubQuestion={adapterHandlers.deleteOptionFromSubQuestion}
                                        handleMoveQuestionUp={adapterHandlers.handleMoveQuestionUp}
                                        handleMoveQuestionDown={adapterHandlers.handleMoveQuestionDown}
                                        handleDuplicateQuestion={adapterHandlers.handleDuplicateQuestion}
                                        handleDuplicateSubQuestion={adapterHandlers.handleDuplicateSubQuestion}
                                        handleReorderOptions={adapterHandlers.handleReorderOptions}
                                        handleReorderAuditOptions={adapterHandlers.handleReorderAuditOptions}
                                        getQuestionTypeIcon={adapterHandlers.getQuestionTypeIcon}
                                        MoveUpIcon={adapterHandlers.MoveUpIcon}
                                        MoveDownIcon={adapterHandlers.MoveDownIcon}
                                        CopyIcon={adapterHandlers.CopyIcon}
                                      />

                                      {/* Sub-question required toggle */}
                                      <div className="flex items-center gap-2 mt-2">
                                        <Switch
                                          checked={subQ.required}
                                          onCheckedChange={(checked) =>
                                            updateSubQuestionInLogic(
                                              logic.id,
                                              subQ.id,
                                              "required",
                                              checked
                                            )
                                          }
                                        />
                                        <Label className="text-xs">Required</Label>
                                      </div>

                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Notification */}
                            <div className="border rounded-lg p-3 bg-white mb-3">
                              <LogicNotificationAccordion
                                enabled={logic.notification.enabled}
                                setEnabled={(v) =>
                                  updateBulkLogicNotification(logic.id, { enabled: v })
                                }
                                users={users}
                                groups={groups}
                                selectedUsers={logic.notification.users}
                                setSelectedUsers={(v) =>
                                  updateBulkLogicNotification(logic.id, { users: v })
                                }
                                selectedGroups={logic.notification.groups}
                                setSelectedGroups={(v) =>
                                  updateBulkLogicNotification(logic.id, { groups: v })
                                }
                                emails={logic.notification.emails}
                                setEmails={(v) =>
                                  updateBulkLogicNotification(logic.id, { emails: v })
                                }
                              />
                            </div>

                            {/* Follow-up */}
                            <div className="border rounded-lg p-3 bg-white">
                              <LogicFollowUpAccordion
                                followup_toggle={logic.follow_up.followup_toggle ?? false}
                                setFollowupToggle={(v: boolean) =>
                                  updateBulkLogicFollowUp(logic.id, {
                                    followup_toggle: v,
                                    enabled: v,
                                  })
                                }
                                title={logic.follow_up.title}
                                setTitle={(v: string) =>
                                  updateBulkLogicFollowUp(logic.id, { title: v })
                                }
                                description={logic.follow_up.description || ""}
                                setDescription={(v: string) =>
                                  updateBulkLogicFollowUp(logic.id, { description: v })
                                }
                                deadline={logic.follow_up.deadline}
                                setDeadline={(v: number) =>
                                  updateBulkLogicFollowUp(logic.id, { deadline: v })
                                }
                                users={users}
                                groups={groups}
                                assign_form={logic.follow_up.assign_form || ""}
                                setAssign_form={(v: string) =>
                                  updateBulkLogicFollowUp(logic.id, { assign_form: v })
                                }
                                allForms={allForms}
                                assignFormSubmitter={!!logic.follow_up.assignFormSubmitter}
                                setAssignFormSubmitter={(v: boolean) =>
                                  updateBulkLogicFollowUp(logic.id, {
                                    assignFormSubmitter: v,
                                  })
                                }
                                assignUsers={logic.follow_up.assignUsers || []}
                                setAssignUsers={(v) =>
                                  updateBulkLogicFollowUp(logic.id, {
                                    assignUsers:
                                      typeof v === "function"
                                        ? v(logic.follow_up.assignUsers || [])
                                        : v,
                                  })
                                }
                                assignGroups={logic.follow_up.assignGroups || []}
                                setAssignGroups={(v) =>
                                  updateBulkLogicFollowUp(logic.id, {
                                    assignGroups:
                                      typeof v === "function"
                                        ? v(logic.follow_up.assignGroups || [])
                                        : v,
                                  })
                                }
                                closeQuestions={
                                  Array.isArray(logic.follow_up.task_close_questions)
                                    ? logic.follow_up.task_close_questions
                                    : []
                                }
                                setCloseQuestions={(v) =>
                                  updateBulkLogicFollowUp(logic.id, {
                                    task_close_questions:
                                      typeof v === "function"
                                        ? v(
                                            Array.isArray(logic.follow_up.task_close_questions)
                                              ? logic.follow_up.task_close_questions
                                              : []
                                          )
                                        : v,
                                  })
                                }
                                questionTypes={questionTypes}
                                questionTypesObj={questionTypesObj}
                                formId={formId}
                                stageId="bulk-import"
                                questionId={logic.id}
                                logicId={logic.id}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 pb-6 flex items-center justify-between">
              <div className="flex gap-2">
                {step === 2 && (
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    Back to Step 1
                  </Button>
                )}
                {step === 3 && (
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                  >
                    Back to Step 2
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDiscardDialog(true)}
                >
                  Cancel
                </Button>
                {step === 1 && (
                  <Button
                    className="text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition"
                    onClick={applyParsedData}
                    disabled={parsedGroups.length === 0}
                  >
                    Done — Proceed to Step 2
                  </Button>
                )}
                {step === 2 && (
                  <Button
                    className="text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition"
                    onClick={proceedToLogic}
                    disabled={selectedQuestionIds.size === 0}
                  >
                    Proceed to Step 3 — Logic
                  </Button>
                )}
                {step === 3 && (
                  <Button
                    className="text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition"
                    onClick={applyBulkLogics}
                  >
                    Apply Logic & Finish
                  </Button>
                )}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard all changes? Any imported questions and logic rules will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetState()
                onOpenChange(false)
                setShowDiscardDialog(false)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default BulkImportModal
