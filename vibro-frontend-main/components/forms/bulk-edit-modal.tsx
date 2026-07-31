"use client"

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Upload, FileText, Download, Check, X, Plus, Trash, Copy, Pencil,
  ChevronDown, ChevronRight, Settings, CircleX, MoveUp, MoveDown,
  Type, CheckSquare, CircleChevronDown, Ruler, Calendar, Clock, Calculator,
  ImageIcon, VideoIcon, FileIcon, QrCode, MapPin, User, Layers, AlertCircle,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"
import hotToaster from "react-hot-toast"
import { Question, QuestionType, Stage, FormData } from "./form-creator"
import LogicFollowUpAccordion from "./logic-follow-up"
import { LogicNotificationAccordion } from "./logic-notification"
import QuestionEditor from "./question-editor"

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: "Short Answer", long_answer: "Long Answer",
  multiple_choice: "Multiple Choice", checkboxes: "Checkboxes",
  dropdown: "Dropdown", linear_scale: "Linear Scale",
  date: "Date", time: "Time", datetime: "Datetime",
  signature: "Signature", upload_image: "Upload Image",
  upload_video: "Upload Video", upload_file: "Upload File",
  qr_code: "QR Code", formula: "Formula", user: "User",
  location: "Location", division: "Division", sub_division: "Sub Division",
  title_and_description: "Title and Description", table: "Table",
  audit: "Audit", text: "Text", rating: "Rating", checkbox: "Checkbox",
}

const LABEL_TO_TYPE: Record<string, QuestionType> = Object.entries(
  QUESTION_TYPE_LABELS
).reduce((acc, [type, label]) => { acc[label.toLowerCase()] = type as QuestionType; return acc }, {} as Record<string, QuestionType>)

const MAX_OPTIONS = 10
const stripNumbering = (value: string) => value.replace(/^\d+\.(?:\d+\.?)*\s*/, "").trim()
const applyStageNumbering = (stages: Stage[], formType: FormData["type"]): Stage[] => {
  let groupNumber = 0

  return stages.map((stage, stageIndex) => {
    if (formType === "audit" && stageIndex === 0) return stage

    groupNumber += 1
    return {
      ...stage,
      title: `${groupNumber}. ${stripNumbering(stage.title) || stage.title}`,
      questions: stage.questions.map((question, questionIndex) => ({
        ...question,
        title: `${groupNumber}.${questionIndex + 1} ${stripNumbering(question.title) || question.title}`,
      })),
    }
  })
}
const OPTION_TYPES = ["multiple_choice", "checkboxes", "dropdown"]
const LOGIC_TYPES = ["multiple_choice", "dropdown", "checkboxes", "short_answer", "linear_scale", "audit"]

interface ParsedGroup { groupName: string; questions: ParsedQuestion[] }
interface ParsedQuestion {
  title: string; type: QuestionType; options: string[]; optionMarks: number[];
  referenceVideo: string; referenceImage: string; required: boolean; critical: boolean;
}

interface BulkLogic {
  id: string
  logic_type: "is" | "is_not"
  comparision: string
  logic_value: string
  subQuestions: Question[]
  notification: { enabled: boolean; users: string[]; groups: string[]; emails: string }
  follow_up: {
    enabled: boolean; followup_toggle: boolean; title: string; description: string;
    deadline: number; assign_to: "form_submitter"; assign_form: string;
    assignFormUser: string; assignFormSubmitter: boolean; assignUsers: string[];
    assignGroups: string[]; task_close_questions: any[]
  }
}

const createDefaultLogic = (): BulkLogic => ({
  id: `logic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  logic_type: "is",
  comparision: "equals",
  logic_value: "",
  subQuestions: [] as Question[],
  notification: { enabled: false, users: [] as string[], groups: [] as string[], emails: "" },
  follow_up: {
    enabled: false, followup_toggle: false, title: "", description: "",
    deadline: 0, assign_to: "form_submitter", assign_form: "",
    assignFormUser: "", assignFormSubmitter: false, assignUsers: [] as string[],
    assignGroups: [] as string[], task_close_questions: [] as any[],
  },
})

interface BulkEditModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  questionTypes: any[]
  questionTypesObj: any[]
  users: any[]
  groups: any[]
  allForms: any[]
  formId: number
}

export function BulkEditModal({
  open, onOpenChange, formData, setFormData,
  questionTypes, questionTypesObj, users, groups, allForms, formId,
}: BulkEditModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [localStages, setLocalStages] = useState<Stage[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [parsedGroups, setParsedGroups] = useState<ParsedGroup[]>([])
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  const [bulkLogics, setBulkLogics] = useState<BulkLogic[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      const stagesCopy: Stage[] = JSON.parse(JSON.stringify(formData.stages))
      setLocalStages(stagesCopy)
      setStep(1); setFile(null); setParsedGroups([]); setCollapsedStages(new Set())
      setBulkLogics([]); setSelectedQuestionIds(new Set()); setCollapsedGroups(new Set()); setEditingQuestionId(null)

      // Extract existing logics from the first question that has them
      for (const stage of stagesCopy) {
        for (const q of stage.questions) {
          if (q.conditionalLogics && q.conditionalLogics.length > 0) {
            const existingLogics: BulkLogic[] = q.conditionalLogics.map((l: any) => ({
              id: `logic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              logic_type: l.logic_type || "is",
              comparision: l.comparision || "equals",
              logic_value: l.logic_value || "",
              subQuestions: (l.subQuestions || []).map((sq: any) => ({ ...sq })),
              notification: l.notification || { enabled: false, users: [], groups: [], emails: "" },
              follow_up: l.follow_up || {
                enabled: false, followup_toggle: false, title: "", description: "",
                deadline: 0, assign_to: "form_submitter", assign_form: "",
                assignFormUser: "", assignFormSubmitter: false, assignUsers: [],
                assignGroups: [], task_close_questions: [],
              },
            }))
            setBulkLogics(existingLogics)
            // Select all questions that have the same logic type
            const allLogicQs = stagesCopy.flatMap(s => s.questions.filter(qq => LOGIC_TYPES.includes(qq.type)))
            setSelectedQuestionIds(new Set(allLogicQs.map(qq => qq.id)))
            return
          }
        }
      }
      // If no existing logics, select all logic-compatible questions by default
      const allLogicQs = stagesCopy.flatMap(s => s.questions.filter(q => LOGIC_TYPES.includes(q.type)))
      setSelectedQuestionIds(new Set(allLogicQs.map(q => q.id)))
    }
  }, [open])

  const updateStage = useCallback((stageId: string, updater: (s: Stage) => Stage) => {
    setLocalStages(prev => prev.map(s => s.id === stageId ? updater(s) : s))
  }, [])

  const updateQuestion = useCallback((stageId: string, questionId: string, updater: (q: Question) => Question) => {
    updateStage(stageId, s => ({ ...s, questions: s.questions.map(q => q.id === questionId ? updater(q) : q) }))
  }, [updateStage])

  const deleteQuestion = useCallback((stageId: string, questionId: string) => {
    updateStage(stageId, s => ({ ...s, questions: s.questions.filter(q => q.id !== questionId) }))
  }, [updateStage])

  const updateStageTitle = useCallback((stageId: string, title: string) => {
    updateStage(stageId, s => ({ ...s, title }))
  }, [updateStage])

  const addQuestionOption = useCallback((stageId: string, questionId: string) => {
    updateQuestion(stageId, questionId, q => ({ ...q, options: [...(q.options || []), ""] }))
  }, [updateQuestion])

  const updateQuestionOption = useCallback((stageId: string, questionId: string, optIdx: number, value: string) => {
    updateQuestion(stageId, questionId, q => ({ ...q, options: (q.options || []).map((o, i) => i === optIdx ? value : o) }))
  }, [updateQuestion])

  const deleteQuestionOption = useCallback((stageId: string, questionId: string, optIdx: number) => {
    updateQuestion(stageId, questionId, q => ({ ...q, options: (q.options || []).filter((_, i) => i !== optIdx) }))
  }, [updateQuestion])

  const deleteStage = useCallback((stageId: string) => {
    setLocalStages(prev => prev.filter(s => s.id !== stageId))
  }, [])

  const toggleStageCollapse = useCallback((stageId: string) => {
    setCollapsedStages(prev => { const n = new Set(prev); if (n.has(stageId)) n.delete(stageId); else n.add(stageId); return n })
  }, [])

  const toggleGroupCollapse = useCallback((stageId: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); if (n.has(stageId)) n.delete(stageId); else n.add(stageId); return n })
  }, [])

  const toggleQuestionSelection = useCallback((qId: string) => {
    setSelectedQuestionIds(prev => { const n = new Set(prev); if (n.has(qId)) n.delete(qId); else n.add(qId); return n })
  }, [])

  const selectAllQuestions = useCallback(() => {
    setSelectedQuestionIds(prev => {
      const n = new Set(prev)
      localStages.forEach(s => s.questions.forEach(q => { if (LOGIC_TYPES.includes(q.type)) n.add(q.id) }))
      return n
    })
  }, [localStages])

  const deselectAllQuestions = useCallback(() => {
    setSelectedQuestionIds(new Set())
  }, [])

  // ─── Available options from all questions ─────────────────────────────────
  const availableOptions = useMemo(() => {
    const opts: string[] = []
    const seen = new Set<string>()
    localStages.forEach((stage) => {
      stage.questions.forEach((q) => {
        const qOpts = q.type === "audit"
          ? (q.auditOptions || []).map((o) => o.option)
          : (q.options || [])
        qOpts.forEach((opt) => {
          const trimmed = opt?.trim()
          if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); opts.push(trimmed) }
        })
      })
    })
    return opts
  }, [localStages])

  // ─── Bulk logic management ────────────────────────────────────────────────
  const addBulkLogic = useCallback(() => {
    setBulkLogics(prev => [...prev, createDefaultLogic()])
  }, [])

  const removeBulkLogic = useCallback((logicId: string) => {
    setBulkLogics(prev => prev.filter(l => l.id !== logicId))
  }, [])

  const duplicateBulkLogic = useCallback((logicId: string) => {
    setBulkLogics(prev => {
      const logic = prev.find(l => l.id === logicId); if (!logic) return prev
      const copy: BulkLogic = { ...JSON.parse(JSON.stringify(logic)), id: `logic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
      copy.subQuestions = copy.subQuestions.map((sq) => ({ ...sq, id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }))
      const idx = prev.findIndex(l => l.id === logicId)
      const updated = [...prev]; updated.splice(idx + 1, 0, copy)
      return updated
    })
  }, [])

  const updateBulkLogic = useCallback((logicId: string, field: string, value: any) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, [field]: value } : l))
  }, [])

  const updateBulkLogicNotification = useCallback((logicId: string, partial: any) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, notification: { ...l.notification, ...partial } } : l))
  }, [])

  const updateBulkLogicFollowUp = useCallback((logicId: string, partial: any) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, follow_up: { ...l.follow_up, ...partial } } : l))
  }, [])

  // ─── Sub-question management within bulk logic ────────────────────────────
  const addSubQuestionToLogic = useCallback((logicId: string, type: QuestionType) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, subQuestions: [...l.subQuestions, { id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, title: "", required: false, subQuestions: [], ...(OPTION_TYPES.includes(type) ? { options: ["", ""] } : {}), ...(type === "linear_scale" ? { from: 1, to: 5 } : {}) }] } : l))
  }, [])

  const updateSubQuestionInLogic = useCallback((logicId: string, subQId: string, field: keyof Question, value: any) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, subQuestions: l.subQuestions.map((sq: any) => sq.id === subQId ? { ...sq, [field]: value } : sq) } : l))
  }, [])

  const deleteSubQuestionFromLogic = useCallback((logicId: string, subQId: string) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, subQuestions: l.subQuestions.filter((sq: any) => sq.id !== subQId) } : l))
  }, [])

  const addOptionToSubQuestionInLogic = useCallback((logicId: string, subQId: string) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, subQuestions: l.subQuestions.map((sq: any) => sq.id === subQId ? { ...sq, options: [...(sq.options || []), ""] } : sq) } : l))
  }, [])

  const updateOptionInSubQuestionInLogic = useCallback((logicId: string, subQId: string, optIdx: number, value: string) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, subQuestions: l.subQuestions.map((sq: any) => sq.id === subQId ? { ...sq, options: (sq.options || []).map((o: any, i: any) => i === optIdx ? value : o) } : sq) } : l))
  }, [])

  const deleteOptionFromSubQuestionInLogic = useCallback((logicId: string, subQId: string, optIdx: number) => {
    setBulkLogics(prev => prev.map(l => l.id === logicId ? { ...l, subQuestions: l.subQuestions.map((sq: any) => sq.id === subQId ? { ...sq, options: (sq.options || []).filter((_: any, i: any) => i !== optIdx) } : sq) } : l))
  }, [])

  const duplicateSubQuestionInLogic = useCallback((logicId: string, subQId: string) => {
    setBulkLogics(prev => prev.map(l => {
      if (l.id !== logicId) return l
      const subQ = l.subQuestions.find((sq: any) => sq.id === subQId); if (!subQ) return l
      const dup: Question = { ...subQ, id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: `${subQ.title} (Copy)`, subQuestions: [], options: subQ.options ? [...subQ.options] : undefined, auditOptions: subQ.auditOptions ? subQ.auditOptions.map((o: any) => ({ ...o })) : undefined }
      const idx = l.subQuestions.findIndex((sq: any) => sq.id === subQId); const newSubQs = [...l.subQuestions]; newSubQs.splice(idx + 1, 0, dup)
      return { ...l, subQuestions: newSubQs }
    }))
  }, [])

  const moveSubQuestionInLogic = useCallback((logicId: string, subQId: string, dir: "up" | "down") => {
    setBulkLogics(prev => prev.map(l => {
      if (l.id !== logicId) return l
      const idx = l.subQuestions.findIndex((sq: any) => sq.id === subQId); if (idx < 0) return l
      const newIdx = dir === "up" ? idx - 1 : idx + 1; if (newIdx < 0 || newIdx >= l.subQuestions.length) return l
      const n = [...l.subQuestions]; [n[idx], n[newIdx]] = [n[newIdx], n[idx]]; return { ...l, subQuestions: n }
    }))
  }, [])

  const reorderOptionsInSubQuestion = useCallback((logicId: string, subQId: string, fromIdx: number, toIdx: number) => {
    setBulkLogics(prev => prev.map(l => {
      if (l.id !== logicId) return l
      return { ...l, subQuestions: l.subQuestions.map((sq: any) => { if (sq.id !== subQId || !sq.options) return sq; const o = [...sq.options]; const [m] = o.splice(fromIdx, 1); o.splice(toIdx, 0, m); return { ...sq, options: o } }) }
    }))
  }, [])

  const reorderAuditOptionsInSubQuestion = useCallback((logicId: string, subQId: string, fromIdx: number, toIdx: number) => {
    setBulkLogics(prev => prev.map(l => {
      if (l.id !== logicId) return l
      return { ...l, subQuestions: l.subQuestions.map((sq: any) => { if (sq.id !== subQId || !sq.auditOptions) return sq; const o = [...sq.auditOptions]; const [m] = o.splice(fromIdx, 1); o.splice(toIdx, 0, m); return { ...sq, auditOptions: o } }) }
    }))
  }, [])

  const handleDownloadTemplate = () => {
    const headers: string[] = ["Group name", "Question", "Question type"]
    for (let i = 1; i <= MAX_OPTIONS; i++) headers.push(`Option ${i}`)
    for (let i = 1; i <= MAX_OPTIONS; i++) headers.push(`Option Mark ${i}`)
    headers.push("Reference Video", "Reference Image", "Required", "Critical")
    const sampleRow: (string | number)[] = ["Group 1", "Sample question text", "Multiple Choice", "Option A", "Option B", "Option C", ...Array(7).fill(""), ...Array(10).fill(""), "", "", "Yes", "No"]
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow])
    ws["!cols"] = headers.map(h => ({ wch: h.startsWith("Option") ? 12 : 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Questions Template")
    XLSX.writeFile(wb, "form_questions_template.xlsx")
    hotToaster.success("Template downloaded successfully")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; setFile(f); parseExcelFile(f)
  }

  const parseExcelFile = (selectedFile: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" })
        if (rows.length < 2) { hotToaster.error("Template is empty"); return }
        const headers = rows[0].map((h: any) => String(h).trim().toLowerCase())
        const colMap: Record<string, number> = {}
        headers.forEach((h: string, i: number) => { colMap[h] = i })
        const optCols: number[] = []; const markCols: number[] = []
        for (let i = 1; i <= MAX_OPTIONS; i++) { if (colMap[`option ${i}`] !== undefined) optCols.push(colMap[`option ${i}`]); if (colMap[`option mark ${i}`] !== undefined) markCols.push(colMap[`option mark ${i}`]) }
        const gIdx = colMap["group name"], qIdx = colMap["question"] ?? colMap["questions"], tIdx = colMap["question type"]
        if (gIdx === undefined || qIdx === undefined || tIdx === undefined) { hotToaster.error("Missing required columns"); return }
        const groupMap = new Map<string, ParsedQuestion[]>()
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r]; const gName = String(row[gIdx] || "").trim(); const qTitle = String(row[qIdx] || "").trim()
          if (!gName && !qTitle) continue; if (!qTitle) continue
          const tLabel = String(row[tIdx] || "").trim().toLowerCase()
          const qType: QuestionType = LABEL_TO_TYPE[tLabel] || "short_answer"
          const options: string[] = []; for (const idx of optCols) { const v = String(row[idx] || "").trim(); if (v) options.push(v) }
          const optionMarks: number[] = []; for (const idx of markCols) { const v = row[idx]; if (v !== "" && v != null) optionMarks.push(Number(v) || 0) }
          const refV = colMap["reference video"] !== undefined ? String(row[colMap["reference video"]] || "").trim() : ""
          const refI = colMap["reference image"] !== undefined ? String(row[colMap["reference image"]] || "").trim() : ""
          const reqV = colMap["required"] !== undefined ? String(row[colMap["required"]] || "").trim().toLowerCase() : ""
          const critV = colMap["critical"] !== undefined ? String(row[colMap["critical"]] || "").trim().toLowerCase() : ""
          const pq: ParsedQuestion = { title: qTitle, type: qType, options: options.length > 0 ? options : OPTION_TYPES.includes(qType) ? ["", ""] : [], optionMarks, referenceVideo: refV, referenceImage: refI, required: reqV === "yes" || reqV === "true", critical: critV === "yes" || critV === "true" }
          const gn = gName || "Group 1"; if (!groupMap.has(gn)) groupMap.set(gn, []); groupMap.get(gn)!.push(pq)
        }
        const groupsArr: ParsedGroup[] = Array.from(groupMap.entries()).map(([name, questions]) => ({ groupName: name, questions }))
        setParsedGroups(groupsArr)
        hotToaster.success(`Parsed ${groupsArr.length} groups with ${groupsArr.reduce((s, g) => s + g.questions.length, 0)} questions`)
      } catch { hotToaster.error("Failed to parse the uploaded file") }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  const applyParsedData = () => {
    if (parsedGroups.length === 0) { hotToaster.error("No data to apply."); return }
    setLocalStages(prev => {
      const newStages = [...prev]
      parsedGroups.forEach(pg => {
        const groupName = stripNumbering(pg.groupName) || pg.groupName
        const existingIdx = newStages.findIndex((s, index) => (formData.type !== "audit" || index !== 0)
          && stripNumbering(s.title).toLowerCase() === groupName.toLowerCase())
        const questions: Question[] = pg.questions.map(pq => {
          const qId = `q${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const baseQ: Question = { id: qId, type: pq.type, title: pq.title, required: pq.required, critical: pq.critical, subQuestions: [], conditionalLogics: [] }
          if (OPTION_TYPES.includes(pq.type)) baseQ.options = pq.options.length > 0 ? pq.options : ["", ""]
          if (pq.type === "linear_scale") { baseQ.from = 1; baseQ.to = 5 }
          if (pq.type === "audit" && pq.options.length > 0) { baseQ.auditOptions = pq.options.map((opt, i) => ({ option: opt, score: pq.optionMarks[i] ?? 0, order: i + 1 })); baseQ.maxScore = Math.max(...pq.optionMarks.map(m => Number(m) || 0), 0) }
          if (pq.referenceVideo) { baseQ.referenceVideoEnabled = true; baseQ.referenceVideos = [pq.referenceVideo] }
          if (pq.referenceImage) { baseQ.referenceImageEnabled = true; baseQ.referenceImages = [pq.referenceImage] }
          return baseQ
        })
        if (existingIdx >= 0) newStages[existingIdx] = { ...newStages[existingIdx], questions: [...newStages[existingIdx].questions, ...questions] }
        else { const sid = `stage${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; newStages.push({ id: sid, originalId: sid, title: groupName, questions }) }
      })
      return applyStageNumbering(newStages, formData.type)
    })
    setFile(null); setParsedGroups([]); hotToaster.success("Questions added successfully!")
  }

  const getQTypeIcon = useCallback((type: QuestionType): React.ReactElement => {
    const c = "h-4 w-4"
    switch (type) {
      case "short_answer": case "text": return <Type className={c} />
      case "long_answer": case "title_and_description": case "signature": return <FileText className={c} />
      case "multiple_choice": case "checkboxes": return <CheckSquare className={c} />
      case "dropdown": case "audit": return <CircleChevronDown className={c} />
      case "linear_scale": return <Ruler className={c} />
      case "date": case "datetime": return <Calendar className={c} />
      case "time": return <Clock className={c} />
      case "formula": return <Calculator className={c} />
      case "upload_image": return <ImageIcon className={c} />
      case "upload_video": return <VideoIcon className={c} />
      case "upload_file": return <FileIcon className={c} />
      case "qr_code": return <QrCode className={c} />
      case "location": return <MapPin className={c} />
      case "user": return <User className={c} />
      case "division": case "sub_division": return <Layers className={c} />
      default: return <FileText className={c} />
    }
  }, [])

  const getQTypeLabel = useCallback((type: QuestionType) => questionTypesObj.find((q) => q.value === type)?.label || QUESTION_TYPE_LABELS[type] || "Unknown", [questionTypesObj])

  const adapterHandlers = useMemo(() => ({
    handleQuestionUpdate: (logicId: string, subQId: string, field: keyof Question, value: any) => updateSubQuestionInLogic(logicId, subQId, field, value),
    handleAddSubQuestion: (logicId: string, _p: string, type: QuestionType) => addSubQuestionToLogic(logicId, type),
    handleUpdateSubQuestion: (logicId: string, _p: string, subQId: string, field: keyof Question, value: any) => updateSubQuestionInLogic(logicId, subQId, field, value),
    handleDeleteSubQuestion: (logicId: string, _p: string, subQId: string) => deleteSubQuestionFromLogic(logicId, subQId),
    handleUpdateOption: (logicId: string, _p: string, subQId: string | null, optIdx: number, value: string) => { if (subQId) updateOptionInSubQuestionInLogic(logicId, subQId, optIdx, value) },
    addOptionToParentQuestion: (logicId: string, qId: string) => addOptionToSubQuestionInLogic(logicId, qId),
    addOptionToSubQuestion: (logicId: string, _p: string, subQId: string) => addOptionToSubQuestionInLogic(logicId, subQId),
    deleteOptionFromParentQuestion: (logicId: string, qId: string, optIdx: number) => deleteOptionFromSubQuestionInLogic(logicId, qId, optIdx),
    deleteOptionFromSubQuestion: (logicId: string, _p: string, subQId: string, optIdx: number) => deleteOptionFromSubQuestionInLogic(logicId, subQId, optIdx),
    handleMoveQuestionUp: (logicId: string, _p: string, subQId: string) => moveSubQuestionInLogic(logicId, subQId, "up"),
    handleMoveQuestionDown: (logicId: string, _p: string, subQId: string) => moveSubQuestionInLogic(logicId, subQId, "down"),
    handleDuplicateQuestion: (logicId: string, _p: string, subQId: string) => duplicateSubQuestionInLogic(logicId, subQId),
    handleDuplicateSubQuestion: (logicId: string, _p: string, subQId: string) => duplicateSubQuestionInLogic(logicId, subQId),
    handleReorderOptions: (logicId: string, qId: string, fromIdx: number, toIdx: number) => reorderOptionsInSubQuestion(logicId, qId, fromIdx, toIdx),
    handleReorderAuditOptions: (logicId: string, qId: string, fromIdx: number, toIdx: number) => reorderAuditOptionsInSubQuestion(logicId, qId, fromIdx, toIdx),
    getQuestionTypeIcon: getQTypeIcon, MoveUpIcon: MoveUp, MoveDownIcon: MoveDown, CopyIcon: Copy,
  }), [addOptionToSubQuestionInLogic, addSubQuestionToLogic, deleteOptionFromSubQuestionInLogic, deleteSubQuestionFromLogic, duplicateSubQuestionInLogic, getQTypeIcon, moveSubQuestionInLogic, reorderAuditOptionsInSubQuestion, reorderOptionsInSubQuestion, updateOptionInSubQuestionInLogic, updateSubQuestionInLogic])

  const cloneLogicWithUniqueIds = (bl: BulkLogic): any => {
    const logicCopy: any = JSON.parse(JSON.stringify(bl))
    delete logicCopy.id
    logicCopy.subQuestions = logicCopy.subQuestions.map((sq: any) => ({ ...sq, id: `sub-q${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }))
    return logicCopy
  }

  const handleSave = () => {
    const stagesWithLogics = localStages.map(stage => ({
      ...stage,
      questions: stage.questions.map(q => {
        if (selectedQuestionIds.has(q.id) && bulkLogics.length > 0) {
          const freshLogics = bulkLogics.map(cloneLogicWithUniqueIds)
          return { ...q, conditionalLogics: freshLogics }
        }
        if (selectedQuestionIds.has(q.id) && bulkLogics.length === 0) {
          return { ...q, conditionalLogics: [] }
        }
        return q
      })
    }))
    setFormData(prev => ({ ...prev, stages: applyStageNumbering(stagesWithLogics, prev.type) }))
    hotToaster.success("Changes applied successfully!")
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) setShowDiscardDialog(true); else onOpenChange(v) }}>
        <DialogContent
          className="w-full max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-y-auto rounded-lg p-0 bg-gray-200 [&>button]:hidden"
          style={{ padding: 0 }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col h-full">
            <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle>Bulk Edit</DialogTitle>
                <DialogDescription className="sr-only">Edit questions and conditional logic</DialogDescription>
                <div className="flex items-center gap-2 ml-4">
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 1 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                    <span className="font-medium">Step 1: Questions</span>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 2 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                    <span className="font-medium">Step 2: Logic</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowDiscardDialog(true)} className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {/* ─── Step 1: Questions ─────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-4 pt-4">
                  <div className="rounded-lg border bg-white p-4">
                    <h3 className="font-medium mb-3">Existing Questions</h3>
                    {localStages.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No questions found. Use the upload below to add questions.</p>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {localStages.map((stage) => {
                          const isCollapsed = collapsedStages.has(stage.id)
                          return (
                            <div key={stage.id} className="border rounded-lg">
                              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-t-lg">
                                <button onClick={() => toggleStageCollapse(stage.id)} className="p-1 hover:bg-gray-200 rounded">
                                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                <Input
                                  className="flex-1 h-7 text-sm font-medium bg-transparent border-transparent hover:border-gray-300 focus:border-gray-400"
                                  value={stage.title}
                                  onChange={(e) => updateStageTitle(stage.id, e.target.value)}
                                />
                                <Badge variant="secondary" className="text-xs">{stage.questions.length} questions</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => deleteStage(stage.id)}>
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </div>
                              {!isCollapsed && (
                                <div className="p-2 space-y-1">
                                  {stage.questions.map((q) => (
                                    <div key={q.id}>
                                      <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded text-sm">
                                        {getQTypeIcon(q.type)}
                                        <span className="flex-1 truncate">{q.title || "(untitled)"}</span>
                                        <Badge variant="outline" className="text-xs">{getQTypeLabel(q.type)}</Badge>
                                        {q.required && <Badge variant="outline" className="text-xs text-red-600">Required</Badge>}
                                        {q.conditionalLogics && q.conditionalLogics.length > 0 && (
                                          <Badge variant="outline" className="text-xs text-blue-600">{q.conditionalLogics.length} logic{q.conditionalLogics.length > 1 ? "s" : ""}</Badge>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:text-blue-700" onClick={() => setEditingQuestionId(editingQuestionId === q.id ? null : q.id)}>
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => deleteQuestion(stage.id, q.id)}>
                                          <Trash className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      {editingQuestionId === q.id && (
                                        <div className="border rounded-lg p-3 mt-1 mb-2 bg-gray-50 space-y-3">
                                          <div>
                                            <Label className="text-xs">Question Title</Label>
                                            <Input className="mt-1 h-8 text-sm" value={q.title} onChange={(e) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, title: e.target.value }))} placeholder="Enter question title" />
                                          </div>
                                          <div>
                                            <Label className="text-xs">Question Type</Label>
                                            <Select value={q.type} onValueChange={(v) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, type: v as QuestionType, ...(OPTION_TYPES.includes(v as QuestionType) && !qq.options ? { options: ["", ""] } : {}), ...(v === "linear_scale" && qq.from === undefined ? { from: 1, to: 5 } : {}) }))}>
                                              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                {questionTypes.map((type) => (<SelectItem key={type} value={type}>{getQTypeLabel(type as QuestionType)}</SelectItem>))
                                                }
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          {OPTION_TYPES.includes(q.type) && (
                                            <div>
                                              <div className="flex items-center justify-between mb-1">
                                                <Label className="text-xs">Options</Label>
                                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addQuestionOption(stage.id, q.id)}>
                                                  <Plus className="h-3 w-3 mr-1" /> Add Option
                                                </Button>
                                              </div>
                                              <div className="space-y-1">
                                                {(q.options || []).map((opt, oi) => (
                                                  <div key={oi} className="flex items-center gap-2">
                                                    <Input className="h-7 text-xs flex-1" value={opt} onChange={(e) => updateQuestionOption(stage.id, q.id, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" disabled={(q.options || []).length <= 2} onClick={() => deleteQuestionOption(stage.id, q.id, oi)}>
                                                      <X className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {q.type === "audit" && (
                                            <div>
                                              <div className="flex items-center justify-between mb-1">
                                                <Label className="text-xs">Audit Options (Option | Score)</Label>
                                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, auditOptions: [...(qq.auditOptions || []), { option: "", score: 0, order: (qq.auditOptions?.length || 0) + 1 }] }))}>
                                                  <Plus className="h-3 w-3 mr-1" /> Add Option
                                                </Button>
                                              </div>
                                              <div className="space-y-1">
                                                {(q.auditOptions || []).map((ao, ai) => (
                                                  <div key={ai} className="flex items-center gap-2">
                                                    <Input className="h-7 text-xs flex-1" value={ao.option} onChange={(e) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, auditOptions: (qq.auditOptions || []).map((o, i) => i === ai ? { ...o, option: e.target.value } : o) }))} placeholder={`Option ${ai + 1}`} />
                                                    <Input type="number" className="h-7 text-xs w-20" value={ao.score} onChange={(e) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, auditOptions: (qq.auditOptions || []).map((o, i) => i === ai ? { ...o, score: Number(e.target.value) || 0 } : o) }))} placeholder="Score" />
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" disabled={(q.auditOptions || []).length <= 2} onClick={() => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, auditOptions: (qq.auditOptions || []).filter((_, i) => i !== ai) }))}>
                                                      <X className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {q.type === "linear_scale" && (
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <Label className="text-xs">From</Label>
                                                <Input type="number" className="mt-1 h-8 text-sm" value={q.from ?? 1} onChange={(e) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, from: Number(e.target.value) || 1 }))} />
                                              </div>
                                              <div>
                                                <Label className="text-xs">To</Label>
                                                <Input type="number" className="mt-1 h-8 text-sm" value={q.to ?? 5} onChange={(e) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, to: Number(e.target.value) || 5 }))} />
                                              </div>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                              <Switch checked={q.required} onCheckedChange={(checked) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, required: checked }))} />
                                              <Label className="text-xs">Required</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Switch checked={q.critical ?? false} onCheckedChange={(checked) => updateQuestion(stage.id, q.id, (qq) => ({ ...qq, critical: checked }))} />
                                              <Label className="text-xs">Critical</Label>
                                            </div>
                                          </div>
                                          <Button variant="outline" size="sm" className="w-full" onClick={() => setEditingQuestionId(null)}>
                                            <Check className="h-3 w-3 mr-1" /> Done
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Add More Questions via Upload</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <Button variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleDownloadTemplate}>
                        <Download className="mr-2 h-4 w-4" /> Download Template
                      </Button>
                    </div>
                    <div className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center">
                      <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">Upload CSV/Excel to add more questions</p>
                      <Input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                      <Button variant="secondary" type="button" onClick={() => fileInputRef.current?.click()}>
                        <FileText className="mr-2 h-4 w-4" /> Browse Files
                      </Button>
                    </div>
                    {file && (
                      <div className="rounded-md bg-white p-2 flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setFile(null); setParsedGroups([]) }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {parsedGroups.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">
                            Parsed {parsedGroups.length} groups with {parsedGroups.reduce((s, g) => s + g.questions.length, 0)} questions
                          </span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-2 rounded-lg border bg-white p-2">
                          {parsedGroups.map((pg, gi) => (
                            <div key={gi} className="border rounded p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary">{pg.groupName}</Badge>
                                <span className="text-xs text-muted-foreground">{pg.questions.length} questions</span>
                              </div>
                              {pg.questions.map((pq, qi) => (
                                <div key={qi} className="flex items-center justify-between text-xs py-1 px-2">
                                  <span className="truncate">{pq.title}</span>
                                  <Badge variant="outline" className="text-xs">{getQTypeLabel(pq.type)}</Badge>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <Button className="bg-green-600 text-white hover:bg-green-700" onClick={applyParsedData}>
                          <Plus className="mr-2 h-4 w-4" /> Add to Form
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Step 2: Logic ─────────────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-4 pt-4">
                  {localStages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No questions found. Add questions in Step 1 first.</p>
                    </div>
                  ) : (
                    <>
                      {/* Question selection */}
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium">Select Questions for Logic</h3>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={selectAllQuestions}>Select All</Button>
                            <Button variant="outline" size="sm" onClick={deselectAllQuestions}>Deselect All</Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          The logic rules below will be applied to all selected questions. Only logic-compatible types are shown.
                        </p>
                        <div className="max-h-[250px] overflow-y-auto space-y-2">
                          {localStages.filter(s => s.questions.some(q => LOGIC_TYPES.includes(q.type))).map((stage) => {
                            const logicQuestions = stage.questions.filter(q => LOGIC_TYPES.includes(q.type))
                            const isCollapsed = collapsedGroups.has(stage.id)
                            const allSelected = logicQuestions.every(q => selectedQuestionIds.has(q.id))
                            return (
                              <div key={stage.id} className="border rounded-lg">
                                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-t-lg">
                                  <button onClick={() => toggleGroupCollapse(stage.id)} className="p-1 hover:bg-gray-200 rounded">
                                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                  <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedQuestionIds(prev => { const n = new Set(prev); logicQuestions.forEach(q => n.add(q.id)); return n })
                                      } else {
                                        setSelectedQuestionIds(prev => { const n = new Set(prev); logicQuestions.forEach(q => n.delete(q.id)); return n })
                                      }
                                    }}
                                  />
                                  <span className="font-medium text-sm">{stage.title}</span>
                                  <Badge variant="secondary" className="text-xs">{logicQuestions.length} questions</Badge>
                                </div>
                                {!isCollapsed && (
                                  <div className="p-2 space-y-1">
                                    {logicQuestions.map((q) => (
                                      <div key={q.id} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded text-sm">
                                        <Checkbox checked={selectedQuestionIds.has(q.id)} onCheckedChange={() => toggleQuestionSelection(q.id)} />
                                        <span className="flex-1 truncate">{q.title || "(untitled)"}</span>
                                        <Badge variant="outline" className="text-xs">{getQTypeLabel(q.type)}</Badge>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {selectedQuestionIds.size} question{selectedQuestionIds.size !== 1 ? "s" : ""} selected
                        </div>
                      </div>

                      {/* Bulk logic configuration */}
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium">Conditional Logic Rules</h3>
                          <Button variant="secondary" size="sm" className="bg-teal-600 text-white hover:bg-teal-700" onClick={addBulkLogic}>
                            <Plus className="mr-1 h-4 w-4" /> Add Logic
                          </Button>
                        </div>

                        {bulkLogics.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No logic rules added yet.</p>
                            <p className="text-sm mt-1">
                              Click &quot;Add Logic&quot; to create a conditional logic rule that will be applied to all selected questions.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {bulkLogics.map((logic, idx) => (
                              <div key={logic.id} className="border-l-4 border-blue-400 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                  <Label className="text-lg font-medium">Logic {idx + 1}</Label>
                                  <div className="flex gap-2">
                                    <Button size="sm" className="bg-blue-500 hover:bg-blue-300 text-white" onClick={() => duplicateBulkLogic(logic.id)}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" className="bg-red-500 hover:bg-red-300 text-white" onClick={() => removeBulkLogic(logic.id)}>
                                      <CircleX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-4">
                                  <div>
                                    <Label htmlFor={`bulk-edit-logic-${idx}-condition`}>Condition</Label>
                                    <Select value={logic.logic_type} onValueChange={(v) => updateBulkLogic(logic.id, "logic_type", v)}>
                                      <SelectTrigger id={`bulk-edit-logic-${idx}-condition`} className="mt-1"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="is">Is</SelectItem>
                                        <SelectItem value="is_not">Is Not</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor={`bulk-edit-logic-${idx}-value`}>Value</Label>
                                    {availableOptions.length > 0 ? (
                                      <Select value={logic.logic_value || ""} onValueChange={(v) => updateBulkLogic(logic.id, "logic_value", v)}>
                                        <SelectTrigger id={`bulk-edit-logic-${idx}-value`} className="mt-1"><SelectValue placeholder="Select a value" /></SelectTrigger>
                                        <SelectContent>
                                          {availableOptions.map((opt, oi) => (<SelectItem key={oi} value={opt}>{opt}</SelectItem>))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input id={`bulk-edit-logic-${idx}-value`} className="mt-1" value={logic.logic_value} onChange={(e) => updateBulkLogic(logic.id, "logic_value", e.target.value)} placeholder="Enter value" />
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {availableOptions.length > 0 ? `${availableOptions.length} unique option(s) from all questions` : "No options found in questions."}
                                    </p>
                                  </div>
                                </div>

                                {/* Sub-questions */}
                                <div className="border rounded-lg p-3 bg-white mb-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium">Sub-Questions (Follow-up Questions)</Label>
                                    <Select value="" onValueChange={(v) => addSubQuestionToLogic(logic.id, v as QuestionType)}>
                                      <SelectTrigger className="w-auto h-8 text-xs"><Plus className="h-3 w-3 mr-1" /> Add Sub-Question</SelectTrigger>
                                      <SelectContent>
                                        {questionTypes.map((type) => (<SelectItem key={type} value={type}>{getQTypeLabel(type as QuestionType)}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {logic.subQuestions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2">No sub-questions added. Add at least one follow-up question.</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {logic.subQuestions.map((subQ, subIdx) => (
                                        <div key={subQ.id} className="border rounded-lg p-3 bg-gray-50">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium">Sub-Question {subIdx + 1}</span>
                                            <div className="flex items-center gap-1">
                                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={subIdx === 0} onClick={() => moveSubQuestionInLogic(logic.id, subQ.id, "up")}><MoveUp className="h-3 w-3" /></Button>
                                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={subIdx === logic.subQuestions.length - 1} onClick={() => moveSubQuestionInLogic(logic.id, subQ.id, "down")}><MoveDown className="h-3 w-3" /></Button>
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicateSubQuestionInLogic(logic.id, subQ.id)}><Copy className="h-3 w-3" /></Button>
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubQuestionFromLogic(logic.id, subQ.id)}><Trash className="h-3 w-3" /></Button>
                                            </div>
                                          </div>
                                          <div className="mb-2">
                                            <Label className="text-xs">Type</Label>
                                            <Select value={subQ.type} onValueChange={(v) => updateSubQuestionInLogic(logic.id, subQ.id, "type", v as QuestionType)}>
                                              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                {questionTypes.map((type) => (<SelectItem key={type} value={type}>{getQTypeLabel(type as QuestionType)}</SelectItem>))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <QuestionEditor
                                            validationError={false} validationErrors={{}}
                                            questions={logic.subQuestions} question={subQ}
                                            stageId={logic.id} questionTypes={questionTypes} questionTypesObj={questionTypesObj}
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
                                            MoveUpIcon={adapterHandlers.MoveUpIcon} MoveDownIcon={adapterHandlers.MoveDownIcon} CopyIcon={adapterHandlers.CopyIcon}
                                          />
                                          <div className="flex items-center gap-2 mt-2">
                                            <Switch checked={subQ.required} onCheckedChange={(checked) => updateSubQuestionInLogic(logic.id, subQ.id, "required", checked)} />
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
                                    setEnabled={(v) => updateBulkLogicNotification(logic.id, { enabled: v })}
                                    users={users} groups={groups}
                                    selectedUsers={logic.notification.users}
                                    setSelectedUsers={(v) => updateBulkLogicNotification(logic.id, { users: v })}
                                    selectedGroups={logic.notification.groups}
                                    setSelectedGroups={(v) => updateBulkLogicNotification(logic.id, { groups: v })}
                                    emails={logic.notification.emails}
                                    setEmails={(v) => updateBulkLogicNotification(logic.id, { emails: v })}
                                  />
                                </div>

                                {/* Follow-up */}
                                <div className="border rounded-lg p-3 bg-white">
                                  <LogicFollowUpAccordion
                                    followup_toggle={logic.follow_up.followup_toggle ?? false}
                                    setFollowupToggle={(v: boolean) => updateBulkLogicFollowUp(logic.id, { followup_toggle: v, enabled: v })}
                                    title={logic.follow_up.title}
                                    setTitle={(v: string) => updateBulkLogicFollowUp(logic.id, { title: v })}
                                    description={logic.follow_up.description || ""}
                                    setDescription={(v: string) => updateBulkLogicFollowUp(logic.id, { description: v })}
                                    deadline={logic.follow_up.deadline}
                                    setDeadline={(v: number) => updateBulkLogicFollowUp(logic.id, { deadline: v })}
                                    users={users} groups={groups}
                                    assign_form={logic.follow_up.assign_form || ""}
                                    setAssign_form={(v: string) => updateBulkLogicFollowUp(logic.id, { assign_form: v })}
                                    allForms={allForms}
                                    assignFormSubmitter={!!logic.follow_up.assignFormSubmitter}
                                    setAssignFormSubmitter={(v: boolean) => updateBulkLogicFollowUp(logic.id, { assignFormSubmitter: v })}
                                    assignUsers={logic.follow_up.assignUsers || []}
                                    setAssignUsers={(v) => updateBulkLogicFollowUp(logic.id, { assignUsers: typeof v === "function" ? v(logic.follow_up.assignUsers || []) : v })}
                                    assignGroups={logic.follow_up.assignGroups || []}
                                    setAssignGroups={(v) => updateBulkLogicFollowUp(logic.id, { assignGroups: typeof v === "function" ? v(logic.follow_up.assignGroups || []) : v })}
                                    closeQuestions={Array.isArray(logic.follow_up.task_close_questions) ? logic.follow_up.task_close_questions : []}
                                    setCloseQuestions={(v) => updateBulkLogicFollowUp(logic.id, { task_close_questions: typeof v === "function" ? v(Array.isArray(logic.follow_up.task_close_questions) ? logic.follow_up.task_close_questions : []) : v })}
                                    questionTypes={questionTypes} questionTypesObj={questionTypesObj}
                                    formId={formId} stageId="bulk-edit" questionId={logic.id} logicId={logic.id}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="px-6 pb-6 flex items-center justify-between">
              <div className="flex gap-2">
                {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>Back to Step 1</Button>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDiscardDialog(true)}>Cancel</Button>
                {step === 1 && (
                  <Button className="text-white bg-[#2563EB] hover:bg-[#2563EB]/80 hover:text-white transition" onClick={() => setStep(2)}>
                    Next — Step 2: Logic
                  </Button>
                )}
                {step === 2 && (
                  <Button className="text-white bg-green-600 hover:bg-green-700 transition" onClick={handleSave}>
                    Save & Close
                  </Button>
                )}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard all changes? Any modifications to questions and logic rules will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setStep(1); setFile(null); setParsedGroups([]); setCollapsedStages(new Set()); setBulkLogics([]); setSelectedQuestionIds(new Set()); setCollapsedGroups(new Set()); setEditingQuestionId(null); setShowDiscardDialog(false); onOpenChange(false) }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
export default BulkEditModal
