"use client";

import React, { useState } from "react";
import { Plus, Trash2, Download, Upload, AlertCircle } from "lucide-react";

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: "mcq",
  TRUE_FALSE: "truefalse",
  FILL_IN_BLANK: "fillblank",
  NPS_SCALE: "nps",
} as const;

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  [QUESTION_TYPES.MULTIPLE_CHOICE]: "Multiple Choice",
  [QUESTION_TYPES.TRUE_FALSE]: "True / False",
  [QUESTION_TYPES.FILL_IN_BLANK]: "Fill in the Blank",
  [QUESTION_TYPES.NPS_SCALE]: "NPS / Linear Scale",
};

export const SUPPORTED_LANGUAGES = [
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
];

export interface BranchRule {
  condition: string;
  value: string;
  targetQuestionId: string;
}

export interface Question {
  id: string;
  type: string;
  question: string;
  options?: string[];
  correctAnswer?: number | null;
  correctText?: string;
  caseSensitive?: boolean;
  npsMin?: number;
  npsMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  randomizeOptions?: boolean;
  branchRules: BranchRule[];
  questionTranslations: Record<string, string>;
  optionTranslations: Record<string, string>[];
}

export const createDefaultQuestion = (type: string = QUESTION_TYPES.MULTIPLE_CHOICE): Question => {
  const id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const base: Question = {
    id,
    question: "",
    type,
    randomizeOptions: false,
    branchRules: [],
    questionTranslations: {},
    optionTranslations: [],
  };
  switch (type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
      return { ...base, options: ["", "", "", ""], correctAnswer: 0 };
    case QUESTION_TYPES.TRUE_FALSE:
      return { ...base, options: ["True", "False"], correctAnswer: 0 };
    case QUESTION_TYPES.FILL_IN_BLANK:
      return { ...base, correctText: "", caseSensitive: false };
    case QUESTION_TYPES.NPS_SCALE:
      return { ...base, npsMin: 0, npsMax: 10, scaleMinLabel: "Not at all likely", scaleMaxLabel: "Extremely likely", correctAnswer: null };
    default:
      return { ...base, options: ["", "", "", ""], correctAnswer: 0 };
  }
};

export const isQuestionValid = (q: Question): boolean => {
  if (!q.question?.trim()) return false;
  switch (q.type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
      return (q.options?.every((opt) => opt?.trim()) ?? false) && (q.options?.length ?? 0) >= 2;
    case QUESTION_TYPES.TRUE_FALSE:
      return true;
    case QUESTION_TYPES.FILL_IN_BLANK:
      return !!q.correctText?.trim();
    case QUESTION_TYPES.NPS_SCALE:
      return true;
    default:
      return false;
  }
};

interface QuestionBuilderProps {
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
}

export default function QuestionBuilder({ questions, onQuestionsChange }: QuestionBuilderProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question>(createDefaultQuestion(QUESTION_TYPES.MULTIPLE_CHOICE));
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Question[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const addQuestion = () => {
    if (!isQuestionValid(currentQuestion)) {
      alert("Please fill in the question and required fields for the selected question type.");
      return;
    }
    const questionToAdd: Question = {
      ...currentQuestion,
      id: currentQuestion.id || `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };
    onQuestionsChange([...questions, questionToAdd]);
    setCurrentQuestion(createDefaultQuestion(currentQuestion.type));
  };

  const removeQuestion = (index: number) => {
    onQuestionsChange(questions.filter((_, i) => i !== index));
  };

  // Bulk upload helpers
  const parseCSV = (text: string): { questions: Question[]; errors: string[] } => {
    const lines = text.split("\n").filter((line) => line.trim());
    const result: Question[] = [];
    const errors: string[] = [];
    const header = lines[0] || "";
    const startIndex = header.toLowerCase().includes("question") ? 1 : 0;
    const hasTypeColumn = header.toLowerCase().startsWith("type");

    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      let type: string, qText: string, options: string[] = [], correctAnswer: number | null = 0, correctText = "", caseSensitive = false, npsMin = 0, npsMax = 10;

      if (hasTypeColumn) {
        if (values.length < 8) { errors.push(`Line ${i + 1}: Invalid format - expected 8 columns`); continue; }
        type = values[0] || QUESTION_TYPES.MULTIPLE_CHOICE;
        qText = values[1];
        options = values[2] ? values[2].split("|").map((o) => o.trim()) : [];
        correctAnswer = parseInt(values[3]) || 0;
        correctText = values[4];
        caseSensitive = values[5] === "true";
        npsMin = parseInt(values[6]) || 0;
        npsMax = parseInt(values[7]) || 10;
      } else {
        if (values.length < 6) { errors.push(`Line ${i + 1}: Invalid format - expected 6 columns`); continue; }
        type = QUESTION_TYPES.MULTIPLE_CHOICE;
        qText = values[0];
        options = [values[1], values[2], values[3], values[4]];
        correctAnswer = parseInt(values[5]) - 1;
      }

      const q: Question = {
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type, question: qText, branchRules: [], questionTranslations: {}, optionTranslations: [],
        ...(type === "fillblank" ? { correctText, caseSensitive } : {}),
        ...(type === "nps" ? { npsMin, npsMax, correctAnswer: correctAnswer || null } : {}),
        ...((type === "mcq" || type === "truefalse") ? { options, correctAnswer } : {}),
      };

      if (!q.question) { errors.push(`Line ${i + 1}: Question text is empty`); }
      else if (isQuestionValid(q)) { result.push(q); }
      else { errors.push(`Line ${i + 1}: Invalid fields for question type ${q.type}`); }
    }
    return { questions: result, errors };
  };

  const parseJSON = (text: string): { questions: Question[]; errors: string[] } => {
    try {
      const data = JSON.parse(text);
      const result: Question[] = [];
      const errors: string[] = [];
      if (Array.isArray(data)) {
        data.forEach((item: any, index: number) => {
          const type = item.type || QUESTION_TYPES.MULTIPLE_CHOICE;
          const base: Question = { id: item.id || `q-${Date.now()}-${index}`, type, question: item.question, branchRules: [], questionTranslations: {}, optionTranslations: [] };
          let q: Question;
          switch (type) {
            case QUESTION_TYPES.MULTIPLE_CHOICE:
            case QUESTION_TYPES.TRUE_FALSE:
              q = { ...base, options: item.options || [], correctAnswer: parseInt(item.correctAnswer) || 0, randomizeOptions: item.randomizeOptions || false };
              break;
            case QUESTION_TYPES.FILL_IN_BLANK:
              q = { ...base, correctText: item.correctText || "", caseSensitive: item.caseSensitive || false };
              break;
            case QUESTION_TYPES.NPS_SCALE:
              q = { ...base, npsMin: item.npsMin ?? 0, npsMax: item.npsMax ?? 10, scaleMinLabel: item.scaleMinLabel || "Not at all likely", scaleMaxLabel: item.scaleMaxLabel || "Extremely likely", correctAnswer: item.correctAnswer ?? null };
              break;
            default:
              errors.push(`Item ${index + 1}: Unknown question type ${type}`);
              return;
          }
          if (isQuestionValid(q)) { result.push(q); } else { errors.push(`Item ${index + 1}: Invalid fields`); }
        });
      } else { errors.push("JSON must be an array of questions"); }
      return { questions: result, errors };
    } catch {
      return { questions: [], errors: ["Invalid JSON format"] };
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      let result: { questions: Question[]; errors: string[] };
      if (file.name.endsWith(".csv")) result = parseCSV(content);
      else if (file.name.endsWith(".json")) result = parseJSON(content);
      else { setUploadErrors(["Please upload a CSV or JSON file"]); return; }
      setPreviewData(result.questions);
      setUploadErrors(result.errors);
    };
    reader.readAsText(file);
  };

  const confirmBulkUpload = () => {
    if (previewData.length === 0) { setUploadErrors(["No valid questions to upload"]); return; }
    onQuestionsChange([...questions, ...previewData]);
    setShowBulkUpload(false);
    setUploadedFile(null);
    setPreviewData([]);
    setUploadErrors([]);
  };

  const downloadSampleCSV = () => {
    const csv = `type,question,options,correctAnswer,correctText,caseSensitive,npsMin,npsMax
mcq,"What is 2+2?","3|4|5|6",1,,,
mcq,"What is the capital of France?","London|Paris|Berlin|Madrid",1,,,
truefalse,"The sky is blue.","True|False",0,,,
fillblank,"What is H2O?",,,Water,false,,
nps,"How likely are you to recommend us?",,,,,0,10`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sample_questions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJSON = () => {
    const json = JSON.stringify([
      { type: "mcq", question: "What is 2+2?", options: ["3", "4", "5", "6"], correctAnswer: 1, randomizeOptions: false },
      { type: "truefalse", question: "The sky is blue.", options: ["True", "False"], correctAnswer: 0 },
      { type: "fillblank", question: "What is H2O?", correctText: "Water", caseSensitive: false },
      { type: "nps", question: "How likely are you to recommend us?", npsMin: 0, npsMax: 10, correctAnswer: null, scaleMinLabel: "Not at all likely", scaleMaxLabel: "Extremely likely" },
    ], null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sample_questions.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-t pt-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4">Add Questions</h3>
      <div className="space-y-4 mb-6">
        {/* Question Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
          <select
            value={currentQuestion.type}
            onChange={(e) => setCurrentQuestion(createDefaultQuestion(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="mcq">Multiple Choice</option>
            <option value="truefalse">True / False</option>
            <option value="fillblank">Fill in the Blank</option>
            <option value="nps">NPS / Linear Scale</option>
          </select>
        </div>

        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
          <textarea
            value={currentQuestion.question || ""}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Enter your question here..."
          />
        </div>

        {/* Question Translations */}
        <div className="border rounded-lg p-3 md:p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Question Translations (optional)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUPPORTED_LANGUAGES.map(({ code, label }) => (
              <div key={code}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={currentQuestion.questionTranslations?.[code] || ""}
                  onChange={(e) => {
                    const newTranslations = { ...(currentQuestion.questionTranslations || {}) };
                    newTranslations[code] = e.target.value;
                    setCurrentQuestion({ ...currentQuestion, questionTranslations: newTranslations });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder={`Question in ${label}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Multiple Choice / True False Options */}
        {(currentQuestion.type === "mcq" || currentQuestion.type === "truefalse") && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options?.map((option, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Option {index + 1}</label>
                  <input
                    type="text"
                    value={option || ""}
                    disabled={currentQuestion.type === "truefalse"}
                    onChange={(e) => {
                      const newOptions = [...(currentQuestion.options || [])];
                      newOptions[index] = e.target.value;
                      setCurrentQuestion({ ...currentQuestion, options: newOptions });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder={`Option ${index + 1}`}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
              <select
                value={currentQuestion.correctAnswer ?? 0}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currentQuestion.options?.map((option, index) => (
                  <option key={index} value={index}>{option || `Option ${index + 1}`}</option>
                ))}
              </select>
            </div>

            {/* Option Translations */}
            <div className="border rounded-lg p-3 md:p-4 bg-gray-50 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Option Translations (optional)</h4>
              {currentQuestion.options?.map((option, index) => (
                <div key={index} className="mb-3 last:mb-0">
                  <p className="text-xs text-gray-600 mb-1">Option {index + 1}: {option || `Option ${index + 1}`}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                      <input
                        key={code}
                        type="text"
                        value={currentQuestion.optionTranslations?.[index]?.[code] || ""}
                        onChange={(e) => {
                          const newOptionTranslations = [...(currentQuestion.optionTranslations || [])];
                          if (!newOptionTranslations[index]) newOptionTranslations[index] = {};
                          newOptionTranslations[index] = { ...newOptionTranslations[index], [code]: e.target.value };
                          setCurrentQuestion({ ...currentQuestion, optionTranslations: newOptionTranslations });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder={`Option ${index + 1} in ${label}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Fill in the Blank */}
        {currentQuestion.type === "fillblank" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
            <input
              type="text"
              value={currentQuestion.correctText || ""}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the correct answer"
            />
            <div className="mt-2 flex items-center">
              <input
                type="checkbox"
                id="caseSensitive"
                checked={currentQuestion.caseSensitive || false}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, caseSensitive: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="caseSensitive" className="text-sm text-gray-700">Case-sensitive matching</label>
            </div>
          </div>
        )}

        {/* NPS / Linear Scale */}
        {currentQuestion.type === "nps" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Value</label>
              <input type="number" value={currentQuestion.npsMin ?? 0} min="0" max="10"
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, npsMin: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Value</label>
              <input type="number" value={currentQuestion.npsMax ?? 10} min="1" max="10"
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, npsMax: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer (optional)</label>
              <input type="number" value={currentQuestion.correctAnswer ?? ""} min={currentQuestion.npsMin} max={currentQuestion.npsMax}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank for no correct answer" />
              <p className="text-xs text-gray-500 mt-1">Leave blank if this is a survey-style question with no right answer.</p>
            </div>
          </div>
        )}

        {/* Randomize Options */}
        {(currentQuestion.type === "mcq" || currentQuestion.type === "truefalse") && (
          <div className="flex items-center">
            <input type="checkbox" id="randomizeOptions" checked={currentQuestion.randomizeOptions || false}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, randomizeOptions: e.target.checked })} className="mr-2" />
            <label htmlFor="randomizeOptions" className="text-sm text-gray-700">Randomize answer options for each user</label>
          </div>
        )}

        {/* Branching Logic */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Branching Logic (Skip Logic)</h4>
          </div>
          {currentQuestion.branchRules.length === 0 && (
            <p className="text-xs text-gray-500 mb-2">Skip to a later question based on the answer.</p>
          )}
          {currentQuestion.branchRules.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-gray-700">If answer</span>
              <select value={rule.condition}
                onChange={(e) => { const newRules = [...currentQuestion.branchRules]; newRules[index].condition = e.target.value; setCurrentQuestion({ ...currentQuestion, branchRules: newRules }); }}
                className="px-2 py-1 border border-gray-300 rounded text-sm">
                <option value="equals">equals</option>
                <option value="notEquals">not equals</option>
                <option value="greaterThan">greater than</option>
                <option value="lessThan">less than</option>
              </select>
              <input type="text" value={rule.value || ""} placeholder="value"
                onChange={(e) => { const newRules = [...currentQuestion.branchRules]; newRules[index].value = e.target.value; setCurrentQuestion({ ...currentQuestion, branchRules: newRules }); }}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-24" />
              <span className="text-sm text-gray-700">skip to</span>
              <select value={rule.targetQuestionId}
                onChange={(e) => { const newRules = [...currentQuestion.branchRules]; newRules[index].targetQuestionId = e.target.value; setCurrentQuestion({ ...currentQuestion, branchRules: newRules }); }}
                className="px-2 py-1 border border-gray-300 rounded text-sm">
                <option value="">Next question</option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>{q.question.substring(0, 40)}...</option>
                ))}
              </select>
              <button type="button" onClick={() => { const newRules = currentQuestion.branchRules.filter((_, i) => i !== index); setCurrentQuestion({ ...currentQuestion, branchRules: newRules }); }}
                className="text-red-600 hover:text-red-800">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() => setCurrentQuestion({ ...currentQuestion, branchRules: [...currentQuestion.branchRules, { condition: "equals", value: "", targetQuestionId: "" }] })}
            className="text-sm text-blue-600 hover:text-blue-800 mt-2">
            + Add Branch Rule
          </button>
        </div>

        <button type="button" onClick={addQuestion}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200">
          Add Question
        </button>
      </div>

      {/* Questions List */}
      {questions.length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Questions Added ({questions.length})</h4>
          <div className="space-y-2">
            {questions.map((q, index) => (
              <div key={q.id || index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Q{index + 1}: {q.question}
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {q.type === "truefalse" ? "True/False" : q.type === "fillblank" ? "Fill Blank" : q.type === "nps" ? "NPS Scale" : "MCQ"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600">
                    {q.type === "fillblank" ? `Correct: "${q.correctText}"` :
                      q.type === "nps" ? `Scale ${q.npsMin ?? 0}-${q.npsMax ?? 10}${q.correctAnswer !== null && q.correctAnswer !== undefined ? ` (Correct: ${q.correctAnswer})` : ""}` :
                      `Correct: ${q.options?.[q.correctAnswer ?? 0] || `Option ${(q.correctAnswer ?? 0) + 1}`}`}
                  </p>
                  {q.randomizeOptions && <p className="text-xs text-blue-600">Randomize enabled</p>}
                  {q.branchRules?.length > 0 && <p className="text-xs text-purple-600">{q.branchRules.length} branch rule(s)</p>}
                </div>
                <button type="button" onClick={() => removeQuestion(index)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Import */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Bulk Import Questions</h3>
          <button type="button" onClick={() => setShowBulkUpload(!showBulkUpload)} className="text-sm text-blue-600 hover:text-blue-800">
            {showBulkUpload ? "Hide" : "Show"}
          </button>
        </div>
        {showBulkUpload && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="font-semibold text-blue-900 mb-2 text-sm">Instructions</h4>
              <div className="space-y-1 text-xs text-blue-800">
                <p>Upload questions in CSV or JSON format.</p>
                <p>Supported types: mcq, truefalse, fillblank, nps.</p>
                <p>CSV (typed): type, question, options (pipe-separated), correctAnswer, correctText, caseSensitive, npsMin, npsMax</p>
                <p>JSON: array of objects with type, question, and type-specific fields</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={downloadSampleCSV} className="flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm">
                <Download className="w-3 h-3 mr-1" /> CSV Template
              </button>
              <button type="button" onClick={downloadSampleJSON} className="flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm">
                <Download className="w-3 h-3 mr-1" /> JSON Template
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload File (CSV or JSON)</label>
              <input type="file" accept=".csv,.json" onChange={handleFileUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              {uploadedFile && <p className="mt-2 text-sm text-gray-600">Selected: {uploadedFile.name}</p>}
            </div>
            {uploadErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                {uploadErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-800 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {err}
                  </p>
                ))}
              </div>
            )}
            {previewData.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Preview: {previewData.length} valid questions</p>
                <button type="button" onClick={confirmBulkUpload}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  <Upload className="w-4 h-4 mr-1" /> Import {previewData.length} Questions
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
