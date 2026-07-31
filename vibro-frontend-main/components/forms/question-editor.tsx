"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Trash, Plus, X, QrCodeIcon, PencilIcon, Star, Circle, Box, Square, ImageIcon, GripVertical } from "lucide-react";
import FormulaEditorField from "./formula-editor";
import { Question, QuestionType } from "./form-creator";
import { JSX } from "react/jsx-runtime";

// Helper to get label for a question type
function getQuestionTypeLabel(type: QuestionType, questionTypesObj: any[]) {
  return questionTypesObj.find((q) => q.value === type)?.label || "Unknown Type";
}

interface QuestionEditorProps {
  question: Question;
  questions: Question[];
  readOnly?: boolean;
  stageId: string;
  validationError?: boolean;
  validationErrors: Record<string, boolean>;
  questionTypes: QuestionType[];
  questionTypesObj: any[];
  handleQuestionUpdate: (stageId: string, questionId: string, field: keyof Question, value: any) => void;
  handleAddSubQuestion: (stageId: string, parentQuestionId: string, type: QuestionType, title?: string) => void;
  handleUpdateSubQuestion: (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string,
    field: keyof Question,
    value: any
  ) => void;
  handleDeleteSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleUpdateOption: (
    stageId: string,
    parentQuestionId: string,
    subQuestionId: string | null,
    optionIndex: number,
    value: string
  ) => void;
  addOptionToParentQuestion: (stageId: string, questionId: string) => void;
  addOptionToSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  deleteOptionFromParentQuestion: (stageId: string, questionId: string, optionIndex: number) => void;
  deleteOptionFromSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string, optionIndex: number) => void;
  handleMoveQuestionUp: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleMoveQuestionDown: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleDuplicateQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleDuplicateSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleReorderOptions: (stageId: string, questionId: string, fromIndex: number, toIndex: number) => void;
  handleReorderAuditOptions: (stageId: string, questionId: string, fromIndex: number, toIndex: number) => void;
  getQuestionTypeIcon: (type: QuestionType) => JSX.Element;
  MoveUpIcon: React.ElementType;
  MoveDownIcon: React.ElementType;
  CopyIcon: React.ElementType;
}

const QuestionEditor: React.FC<QuestionEditorProps> = (props) => {
  const {
    question,
    stageId,
    questionTypes,
    questionTypesObj,
    validationError,
    handleQuestionUpdate,
    handleAddSubQuestion,
    handleUpdateSubQuestion,
    handleDeleteSubQuestion,
    handleUpdateOption,
    addOptionToParentQuestion,
    addOptionToSubQuestion,
    deleteOptionFromParentQuestion,
    deleteOptionFromSubQuestion,
    handleMoveQuestionUp,
    handleMoveQuestionDown,
    handleDuplicateQuestion,
    handleDuplicateSubQuestion,
    handleReorderOptions,
    handleReorderAuditOptions,
    MoveUpIcon,
    MoveDownIcon,
    CopyIcon,
    getQuestionTypeIcon
  } = props;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, isAudit = false) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (dragIndex !== dropIndex) {
      if (isAudit) {
        handleReorderAuditOptions(stageId, question.id, dragIndex, dropIndex);
      } else {
        handleReorderOptions(stageId, question.id, dragIndex, dropIndex);
      }
    }
  };

  switch (question.type) {
    case "short_answer":
      return (
        <div className="space-y-2">
          <Label>Question*</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <div className="flex">
            <div style={{ width: "50%" }} className="mr-2">
              <Label>Hint Text (Optional)</Label>
              <Input
                value={question.hint ?? ""}
                onChange={(e) => handleQuestionUpdate(stageId, question.id, "hint", e.target.value)}
              />
            </div>
            <div style={{ width: "50%" }} className="ml-2">
              <Label>Value Type</Label>
              <select
                value={question.valueType ?? "text"}
                onChange={(e) => handleQuestionUpdate(stageId, question.id, "valueType", e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2 text-sm"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </div>
          </div>
        </div>
      );

    case "long_answer":
      return (
        <div className="space-y-2">
          <Label>Question*</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
        </div>
      );

    case "audit": {
      // Helper for max score
      function calculateMaxScore(auditOptions: { option: string; score: number }[]): number {
        return auditOptions && auditOptions.length
          ? Math.max(...auditOptions.map(opt => Number(opt.score) || 0))
          : 0;
      }

      // Ensure at least 2 options always
      const baseAuditOptions: { option: string; score: number }[] =
        question.auditOptions && question.auditOptions.length >= 2
          ? question.auditOptions
          : [
            ...(question.auditOptions || []),
            ...Array(2 - (question.auditOptions?.length || 0)).fill({ option: "", score: 0 }),
          ];



      return (
        <div className="space-y-4">
          {/* Question Field */}
          <div>
            <Label htmlFor={`question-${question.id}-title`}>Question</Label>
            <Input
              id={`question-title-input-${question.id}`}
              value={question.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleQuestionUpdate(stageId, question.id, "title", e.target.value)
              }
              className={`mt-1 ${validationError ? "border-red-500" : ""}`}
              required
              autoFocus={!!validationError}
            />
            {validationError && (
              <div className="text-red-500 text-xs mt-1">Question title is required.</div>
            )}

            <Label>Description (Optional)</Label>
            <Input
              value={question.description || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleQuestionUpdate(stageId, question.id, "description", e.target.value)
              }
            />
          </div>

          {/* Audit Options List */}
          <div className="space-y-2">
            {baseAuditOptions.map((opt, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx, true)}
                className="flex items-center gap-2 cursor-move"
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  value={opt.option}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const newOptions = [...baseAuditOptions];
                    newOptions[idx] = { ...newOptions[idx], option: e.target.value };
                    const newMaxScore = calculateMaxScore(newOptions);
                    handleQuestionUpdate(stageId, question.id, "auditOptions", newOptions);
                    handleQuestionUpdate(stageId, question.id, "maxScore", newMaxScore);
                  }}
                  required
                />
                <Input
                  inputMode="numeric"     // Brings up numeric keyboard on mobile
                  pattern="[0-9]*"
                  value={opt.score}
                  min={0}
                  placeholder="Score"
                  className="w-24"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const newOptions = [...baseAuditOptions];
                    newOptions[idx] = { ...newOptions[idx], score: Number(e.target.value) };
                    const newMaxScore = calculateMaxScore(newOptions);
                    handleQuestionUpdate(stageId, question.id, "auditOptions", newOptions);
                    handleQuestionUpdate(stageId, question.id, "maxScore", newMaxScore);
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    if (baseAuditOptions.length > 2) {
                      // Remove the row
                      const newOptions = [...baseAuditOptions];
                      newOptions.splice(idx, 1);
                      const newMaxScore = calculateMaxScore(newOptions);
                      handleQuestionUpdate(stageId, question.id, "auditOptions", newOptions);
                      handleQuestionUpdate(stageId, question.id, "maxScore", newMaxScore);
                    } else {
                      // Just clear the row
                      const newOptions = [...baseAuditOptions];
                      newOptions[idx] = { option: "", score: 0 };
                      const newMaxScore = calculateMaxScore(newOptions);
                      handleQuestionUpdate(stageId, question.id, "auditOptions", newOptions);
                      handleQuestionUpdate(stageId, question.id, "maxScore", newMaxScore);
                    }
                  }}
                  className="text-red-500 text-sm"
                  title={
                    baseAuditOptions.length <= 2
                      ? "At least two options required; this will clear the row"
                      : "Remove"
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {props.validationErrors?.[question.id + "_options"] && (
            <p className="text-red-600 text-sm mt-2">Options and scores are required</p>
          )}

          {/* Add Option & Max Score Row */}
          <div className="flex items-center gap-2 text-sm mt-2 justify-between">
            <div>
              <button
                type="button"
                className="text-gray-700 hover:underline"
                onClick={() => {
                  const newOptions = [...baseAuditOptions, { option: "", score: 0 }];
                  const newMaxScore = calculateMaxScore(newOptions);
                  handleQuestionUpdate(stageId, question.id, "auditOptions", newOptions);
                  handleQuestionUpdate(stageId, question.id, "maxScore", newMaxScore);
                }}
              >
                Add option
              </button>
            </div>
            <div>
              <Label className="mr-2">Max Score:</Label>
              <span className="font-semibold">{question.maxScore || 0}</span>
            </div>
          </div>

          {/* <Input
            placeholder="Observations (Optional)"
            readOnly
            className="cursor-pointer"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleQuestionUpdate(stageId, question.id, "observation", e.target.value)
            }
          /> */}

          {/* <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Requires Live Photo</Label>
            <Switch
              checked={question.requiresLive || false}
              onCheckedChange={(checked: boolean) =>
                handleQuestionUpdate(stageId, question.id, "requiresLive", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Maximum number of files allowed</Label>
            <select
              value={question.maxFiles ?? 1}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handleQuestionUpdate(stageId, question.id, "maxFiles", parseInt(e.target.value))
              }
              className="block border rounded px-3 py-1 text-sm w-24"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="border-2 border-black border-dotted rounded-md p-6 flex flex-col items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              {"Tap to upload an Image"}
              <br />
              {question.maxFiles && (
                <span className="text-xs text-muted-foreground">
                  Up to {question.maxFiles} image{question.maxFiles > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div> */}

          <div className="flex items-center justify-between">
            <Label htmlFor={`question-${question.id}-critical`} className="cursor-pointer">
              Critical
            </Label>
            <Switch
              id={`question-${question.id}-critical`}
              checked={question.critical}
              onCheckedChange={(checked) =>
                handleQuestionUpdate(stageId, question.id, "critical", checked)
              }
            />
          </div>
        </div>
      );
    }


    case "checkboxes":

      const [csvCbError, setCsvCbError] = React.useState<string>("");
      const [csvCbSuccess, setCsvCbSuccess] = React.useState<string>("");
      const CbfileInputRef = React.useRef<HTMLInputElement | null>(null);
      const normalizedOptions = (question.options ?? []).map((opt) =>
        typeof opt === "string" ? opt : String(opt)
      );

      return (
        <div className="space-y-4">
          {/* Question Field */}
          <div>
            <Label htmlFor={`question-${question.id}-title`}>Question</Label>
            <Input
              id={`question-title-input-${question.id}`}
              value={question.title}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "title", e.target.value)
              }
              className={`mt-1 ${validationError ? "border-red-500" : ""}`}
              required
              autoFocus={!!validationError}
            />
            {validationError && (
              <div className="text-red-500 text-xs mt-1">Question title is required.</div>
            )}
            <Label>Description (Optional)</Label>
            <Input
              placeholder=""
              value={question.description ?? ""}
              onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
            />
          </div>

          {/* Options List */}
          <div className="space-y-2">
            {(() => {
              // Ensure at least 2 option fields are always shown for checkboxes
              const currentOptions = question.options ?? [];
              // If options is empty or has less than 2 items, pad to 2 items for display
              const displayOptions = currentOptions.length < 2 
                ? [...currentOptions, ...Array(2 - currentOptions.length).fill("")] 
                : currentOptions;

              return displayOptions.map((option, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="flex items-center gap-2 cursor-move"
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <Square />
                  <Input
                    type="text"
                    value={option}
                    placeholder={`Option ${index + 1}`}
                    readOnly={option?.toLowerCase?.() === "other"}
                    className={`flex-1 ${option?.toLowerCase?.() === "other" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (option?.toLowerCase?.() !== "other") {
                        const baseOptions = question.options ?? [];
                        const updatedOptions = [...baseOptions];
                        
                        // Ensure array is large enough for the index
                        while (updatedOptions.length <= index) {
                          updatedOptions.push("");
                        }
                        
                        updatedOptions[index] = e.target.value;
                        
                        // Always ensure at least 2 items in the array
                        if (updatedOptions.length < 2) {
                          while (updatedOptions.length < 2) {
                            updatedOptions.push("");
                          }
                        }
                        
                        handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
                      }
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const baseOptions = question.options ?? [];
                      const updatedOptions = [...baseOptions];
                      updatedOptions.splice(index, 1);
                      // Ensure at least 2 items remain
                      if (updatedOptions.length < 2) {
                        while (updatedOptions.length < 2) {
                          updatedOptions.push("");
                        }
                      }
                      handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
                    }}
                    className="text-red-500 text-sm"
                  >
                    ×
                  </button>
                </div>
              ));
            })()}
          </div>
          {props.validationErrors?.[question.id + '_options'] && <p className="text-red-600 text-sm mt-2">This field is required</p>}

          {/* Add Option/Add Other */}
          <div className="flex items-center gap-2 text-sm mt-2">
            <button
              type="button"
              className="text-gray-700 hover:underline"
              onClick={() => {
                const updatedOptions = [...(question.options ?? ["", ""]), ""];
                handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
              }}
            >
              Add option
            </button>
            <span className="text-gray-400">or</span>
            <button
              type="button"
              className="text-primary hover:underline font-semibold"
              onClick={() => {
                const currentOptions = question.options ?? ["", ""];
                if (!currentOptions.includes("other")) {
                  handleQuestionUpdate(stageId, question.id, "options", [...currentOptions, "other"]);
                }
              }}
            >
              ADD "OTHER"
            </button>
          </div>
          {/* CSV Import Option */}
          <div className="flex flex-col gap-1 mt-2">
            <label className="text-sm font-medium">Bulk Import Options from CSV</label>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                accept=".csv"
                ref={CbfileInputRef}
                style={{ display: "none" }}
                onChange={async (e) => {
                  setCsvCbError("");
                  setCsvCbSuccess("");
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => !!line);
                  if (lines.length === 0) {
                    setCsvCbError("CSV file is empty.");
                    return;
                  }
                  const firstLine = lines[0].toLowerCase();
                  let optionLines = lines;
                  if (firstLine === "option" || firstLine === "options") {
                    optionLines = lines.slice(1);
                  }
                  if (optionLines.length === 0) {
                    setCsvCbError("No options found in CSV.");
                    return;
                  }
                  const importedOptions = Array.from(new Set(optionLines.map(opt => opt.trim()).filter(opt => !!opt)));
                  if (importedOptions.length === 0) {
                    setCsvCbError("No valid options found in CSV.");
                    return;
                  }
                  const currentOptions = question.options ?? [];
                  const mergedOptions = Array.from(new Set([...currentOptions, ...importedOptions]));
                  handleQuestionUpdate(stageId, question.id, "options", mergedOptions);
                  setCsvCbSuccess(`${importedOptions.length} option(s) imported.`);
                  if (CbfileInputRef.current) CbfileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                // className="bg-gray-500 text-white hover:bg-gray-600  hover:text-white"
                style={{ backgroundColor: "teal", color: "white" }}

                onClick={() => CbfileInputRef.current?.click()}
                size="sm"
              >
                Import from CSV
              </Button>
              <a
                href="data:text/csv,Option%0AApple%0ABanana%0ACherry"
                download="vibro-option-template.csv"
                className="text-xs text-blue-500 underline"
                style={{ marginLeft: 8 }}
                title="Download sample CSV"
              >
                Download Sample
              </a>
            </div>
            {csvCbError && <div className="text-xs text-red-600">{csvCbError}</div>}
            {csvCbSuccess && <div className="text-xs text-green-600">{csvCbSuccess}</div>}
          </div>

        </div>
      );

    case "multiple_choice":
      const [csvMcError, setCsvMcError] = React.useState<string>("");
      const [csvMcSuccess, setCsvMcSuccess] = React.useState<string>("");
      const McfileInputRef = React.useRef<HTMLInputElement | null>(null);

      return (
        <div className="space-y-4">
          {/* Question Field */}
          <div>
            <Label htmlFor={`question-${question.id}-title`}>Question</Label>
            <Input
              id={`question-title-input-${question.id}`}
              value={question.title}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "title", e.target.value)
              }
              className={`mt-1 border border-gray-300 ${validationError ? "border-red-500" : ""
                }`}
              required
              autoFocus={!!validationError}
            />
            {validationError && (
              <div className="text-red-500 text-xs mt-1">
                Question title is required.
              </div>
            )}
            <Label>Description (Optional)</Label>
            <Input
              placeholder=""
              className="border border-gray-300"
              value={question.description ?? ""}
              onChange={(e) =>
                handleQuestionUpdate(
                  stageId,
                  question.id,
                  "description",
                  e.target.value
                )
              }
            />
          </div>

          {/* Options & Value Type Layout */}
          <div className="flex">
            {/* Left side - Options */}
            <div className="space-y-2 w-[50%]">
              {(() => {
                // Ensure at least 2 option fields are always shown for multiple_choice
                const currentOptions = question.options ?? [];
                // If options is empty or has less than 2 items, pad to 2 items for display
                const displayOptions = currentOptions.length < 2
                  ? [...currentOptions, ...Array(2 - currentOptions.length).fill("")]
                  : currentOptions;

                return displayOptions.map((option, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center gap-2 cursor-move"
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-sm w-6">{index + 1}.</span>
                    <Input
                      type="text"
                      value={option ?? ""}
                      placeholder={`Option ${index + 1}`}
                      readOnly={
                        typeof option === "string" &&
                        option.toLowerCase() === "other"
                      }
                      className={`w-[300px] ${typeof option === "string" &&
                          option.toLowerCase() === "other"
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "border border-gray-300"
                        }`}
                      onChange={(e) => {
                        if (
                          !(
                            typeof option === "string" &&
                            option.toLowerCase() === "other"
                          )
                        ) {
                          const baseOptions = question.options ?? [];
                          const updatedOptions = [...baseOptions];
                          
                          // Ensure array is large enough for the index
                          while (updatedOptions.length <= index) {
                            updatedOptions.push("");
                          }
                          
                          updatedOptions[index] = e.target.value;
                          
                          // Always ensure at least 2 items in the array
                          if (updatedOptions.length < 2) {
                            while (updatedOptions.length < 2) {
                              updatedOptions.push("");
                            }
                          }
                          
                          handleQuestionUpdate(
                            stageId,
                            question.id,
                            "options",
                            updatedOptions
                          );
                        }
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const baseOptions = question.options ?? [];
                        const updatedOptions = [...baseOptions];
                        updatedOptions.splice(index, 1);
                        // Ensure at least 2 items remain
                        if (updatedOptions.length < 2) {
                          while (updatedOptions.length < 2) {
                            updatedOptions.push("");
                          }
                        }
                        handleQuestionUpdate(
                          stageId,
                          question.id,
                          "options",
                          updatedOptions
                        );
                      }}
                      className="text-red-500 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ));
              })()}
            </div>

            {/* Right side - Value Type */}
            <div className="ml-2 w-[50%] justify-self-end">
              <Label>Value Type</Label>
              <select
                value={question.valueType ?? "text"}
                onChange={(e) =>
                  handleQuestionUpdate(
                    stageId,
                    question.id,
                    "valueType",
                    e.target.value
                  )
                }
                className="mt-1 block w-full border rounded px-3 py-2 text-sm border-gray-300"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </div>
          </div>
          {props.validationErrors?.[question.id + '_options'] && <p className="text-red-600 text-sm mt-2">Options are required</p>}

          {/* Add Option/Add Other */}
          <div className="flex items-center gap-2 text-sm mt-2">
            <button
              type="button"
              className="text-gray-700 hover:underline"
              onClick={() => {
                const updatedOptions = [...(question.options ?? ["", ""]), ""];
                handleQuestionUpdate(
                  stageId,
                  question.id,
                  "options",
                  updatedOptions
                );
              }}
            >
              Add option
            </button>
            <span className="text-gray-400">or</span>
            <button
              type="button"
              className="text-primary hover:underline font-semibold"
              onClick={() => {
                const currentOptions = question.options ?? ["", ""];
                if (!currentOptions.includes("other")) {
                  handleQuestionUpdate(stageId, question.id, "options", [
                    ...currentOptions,
                    "other",
                  ]);
                }
              }}
            >
              ADD "OTHER"
            </button>
          </div>

          {/* CSV Import Option */}
          <div className="flex flex-col gap-1 mt-2">
            <label className="text-sm font-medium">
              Bulk Import Options from CSV
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                accept=".csv"
                ref={McfileInputRef}
                style={{ display: "none" }}
                onChange={async (e) => {
                  setCsvMcError("");
                  setCsvMcSuccess("");
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const lines = text
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter((line) => !!line);
                  if (lines.length === 0) {
                    setCsvMcError("CSV file is empty.");
                    return;
                  }
                  const firstLine = lines[0].toLowerCase();
                  let optionLines = lines;
                  if (firstLine === "option" || firstLine === "options") {
                    optionLines = lines.slice(1);
                  }
                  if (optionLines.length === 0) {
                    setCsvMcError("No options found in CSV.");
                    return;
                  }
                  const importedOptions = Array.from(
                    new Set(optionLines.map((opt) => opt.trim()).filter((opt) => !!opt))
                  );
                  if (importedOptions.length === 0) {
                    setCsvMcError("No valid options found in CSV.");
                    return;
                  }
                  const currentOptions = question.options ?? [];
                  const mergedOptions = Array.from(
                    new Set([...currentOptions, ...importedOptions])
                  );
                  handleQuestionUpdate(stageId, question.id, "options", mergedOptions);
                  setCsvMcSuccess(`${importedOptions.length} option(s) imported.`);
                  if (McfileInputRef.current) McfileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                style={{ backgroundColor: "teal", color: "white" }}
                onClick={() => McfileInputRef.current?.click()}
                size="sm"
              >
                Import from CSV
              </Button>
              <a
                href="data:text/csv,Option%0AApple%0ABanana%0ACherry"
                download="vibro-option-template.csv"
                className="text-xs text-blue-500 underline"
                style={{ marginLeft: 8 }}
                title="Download sample CSV"
              >
                Download Sample
              </a>
            </div>
            {csvMcError && <div className="text-xs text-red-600">{csvMcError}</div>}
            {csvMcSuccess && (
              <div className="text-xs text-green-600">{csvMcSuccess}</div>
            )}
          </div>
        </div>
      );


    case "formula":
      return (
        <div>
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
          <label className="block font-medium mb-1">Formula</label>
          <FormulaEditorField
            question={question}
            questions={props.questions}
            onChange={(newFormula: any) => handleQuestionUpdate(stageId, question.id, "formula", newFormula)}
          />
          <small className="text-muted-foreground">
            Click the box to add or edit your formula. Use [A], [B], etc. as placeholders for variables.
          </small>
        </div>
      );

    case "table":
      return (
        <div className="space-y-2">
          <Label>Table Title*</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
          {
            question.subQuestions?.length === 0 &&
            <div className="space-y-2 mt-2 mb-2">
              <CardTitle className="text-lg">Add Sub-Question</CardTitle>
              <Select
                value=""
                onValueChange={(value) =>
                  handleAddSubQuestion(stageId, question.id, value as QuestionType)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a question type" />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getQuestionTypeLabel(type as QuestionType, questionTypesObj)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }


          {((question.subQuestions && question.subQuestions.length > 0
            ? question.subQuestions
            : question.tableSubQuestions) || []).map((subQ, index) => (
              <Card key={subQ.id} className="p-0 mb-2">
                <CardHeader className="pb-2 pt-0 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    {typeof getQuestionTypeIcon === "function" && getQuestionTypeIcon(subQ.type)}
                    <CardTitle className="text-base">{getQuestionTypeLabel(subQ.type, questionTypesObj)}</CardTitle>
                    {subQ.required && (
                      <Badge variant="outline" className="ml-2">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveQuestionUp(stageId, question.id, subQ.id)}
                    disabled={index === 0}
                  >
                    <MoveUpIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveQuestionDown(stageId, question.id, subQ.id)}
                    disabled={
                      index === (question.subQuestions?.length || 1) - 1
                    }
                  >
                    <MoveDownIcon className="h-4 w-4" />
                  </Button> */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicateSubQuestion(stageId, question.id, subQ.id)}
                    // onClick={() => handleAddSubQuestion(stageId, question.id, subQ.type as QuestionType, subQ.title)}
                    // onClick={() => handleAddSubQuestion(stageId, question.id, subQ.type as QuestionType, subQ.title)}
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSubQuestion(stageId, question.id, subQ.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleAddSubQuestion(stageId, question.id, "short_answer" as QuestionType)}
                    >
                      Add Question
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Sub-question type selector */}
                  <div className="mb-2">
                    <Select
                      value={subQ.type || ""}
                      onValueChange={(value: QuestionType) => {
                        handleUpdateSubQuestion(stageId, question.id, subQ.id, "type", value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a question type" />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {getQuestionTypeLabel(type as QuestionType, questionTypesObj)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <QuestionEditor
                    question={subQ}
                    questions={props.questions}
                    stageId={stageId}
                    validationErrors={props.validationErrors}
                    questionTypes={questionTypes}
                    questionTypesObj={questionTypesObj}
                    handleQuestionUpdate={(stageId, subQId, field, value) =>
                      handleUpdateSubQuestion(stageId, question.id, subQId, field, value)
                    }
                    handleAddSubQuestion={handleAddSubQuestion}
                    handleUpdateSubQuestion={handleUpdateSubQuestion}
                    handleDeleteSubQuestion={handleDeleteSubQuestion}
                    handleUpdateOption={handleUpdateOption}
                    addOptionToParentQuestion={addOptionToParentQuestion}
                    addOptionToSubQuestion={(stageId, _parentQId, subQId) =>
                      addOptionToSubQuestion(stageId, question.id, subQId)
                    }
                    deleteOptionFromParentQuestion={deleteOptionFromParentQuestion}
                    deleteOptionFromSubQuestion={(stageId, _parentQId, subQId, optionIndex) =>
                      deleteOptionFromSubQuestion(stageId, question.id, subQId, optionIndex)
                    }
                    handleMoveQuestionUp={handleMoveQuestionUp}
                    handleMoveQuestionDown={handleMoveQuestionDown}
                    handleDuplicateQuestion={handleDuplicateQuestion}
                    handleDuplicateSubQuestion={handleDuplicateSubQuestion}
                    handleReorderOptions={handleReorderOptions}
                    handleReorderAuditOptions={handleReorderAuditOptions}
                    MoveUpIcon={MoveUpIcon}
                    MoveDownIcon={MoveDownIcon}
                    CopyIcon={CopyIcon}
                    getQuestionTypeIcon={getQuestionTypeIcon}
                  />
                </CardContent>
              </Card>
            ))}
        </div>
      );
    case "location":
      return (
        <div className="space-y-2">
          <Label>Question*</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
          {/* <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Enable Offline</Label>
            <Switch
              checked={question.offlineEnabled || false}
              onCheckedChange={(checked) =>
                handleQuestionUpdate(stageId, question.id, "offlineEnabled", checked)
              }
            />
          </div> */}
        </div>
      );

    case "upload_image":
      return (
        <div className="space-y-4">
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Requires Live Photo</Label>
            <Switch
              checked={question.requiresLive || false}
              onCheckedChange={(checked) =>
                handleQuestionUpdate(stageId, question.id, "requiresLive", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Maximum number of files allowed</Label>
            <select
              value={question.maxFiles || 1}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "maxFiles", parseInt(e.target.value))
              }
              className="block border rounded px-3 py-1 text-sm w-24"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case "upload_video":
      return (
        <div className="space-y-4">
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Requires Live Video</Label>
            <Switch
              checked={question.requiresLive || false}
              onCheckedChange={(checked) =>
                handleQuestionUpdate(stageId, question.id, "requiresLive", checked)
              }
            />
          </div>
        </div>
      );

    case "upload_file":
      return (
        <div className="space-y-4">
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
          <div className="flex items-center justify-between">
            <Label>Maximum number of files allowed</Label>
            <select
              value={question.maxFiles || 1}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "maxFiles", parseInt(e.target.value))
              }
              className="block border rounded px-3 py-1 text-sm w-24"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case "signature":
      return (
        <div>
          <Label htmlFor={`question-${question.id}-title`}>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
        </div>
      );

    case "qr_code":
      return (
        <div className="space-y-4">
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label className="sr-only">Hint text</Label>
          <div className="flex items-center border rounded px-2 py-1 mt-1">
            <QrCodeIcon className="h-4 w-4 text-muted-foreground mr-2" />
            <Input
              type="text"
              placeholder="Hint text (optional)"
              value={question.hint ?? ""}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "hint", e.target.value)
              }
              className="flex-1 border-none outline-none text-sm bg-transparent"
            />


          </div>
        </div>
      );

    case "division":
    case "sub_division":
    case "datetime":
    case "date":
    case "time":
      return (
        <div className="space-y-2">
          <Label>Question*</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
        </div>
      );

    case "rating":
      return (
        <div className="flex gap-2">
          <Label>Rating</Label>
          {[1, 2, 3, 4, 5].map((rating) => (
            <Button key={rating} variant="outline" size="icon" disabled>
              <Star className="h-4 w-4" />
            </Button>
          ))}
        </div>
      );

    case "user":
      return (
        <div>
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            required
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description (Optional)</Label>
          <Input
            placeholder=""
            value={question.description ?? ""}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
          />
        </div>
      );

    case "title_and_description":
      return (
        <div>
          <Label>Title</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
          <Label>Description</Label>
          <Textarea
            value={question.description || ""}
            onChange={(e) =>
              handleQuestionUpdate(stageId, question.id, "description", e.target.value)
            }
            className="mt-1"
          />
        </div>
      );

    case "text":
      return (
        <div>
          <Label>Question</Label>
          <Input
            id={`question-title-input-${question.id}`}
            value={question.title}
            onChange={(e) => handleQuestionUpdate(stageId, question.id, "title", e.target.value)}
            className={`mt-1 ${validationError ? "border-red-500" : ""}`}
            autoFocus={!!validationError}
          />
          {validationError && (
            <div className="text-red-500 text-xs mt-1">Question title is required.</div>
          )}
        </div>
      );

    case "linear_scale":
      return (
        <div className="space-y-4">
          {/* Question Input */}
          <div>
            <Label htmlFor={`question-${question.id}-title`}>Question</Label>
            <Input
              id={`question-title-input-${question.id}`}
              value={question.title}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "title", e.target.value)
              }
              className={`mt-1 ${validationError ? "border-red-500" : ""}`}
              autoFocus={!!validationError}
            />
            {validationError && (
              <div className="text-red-500 text-xs mt-1">Question title is required.</div>
            )}
            <Label>Description (Optional)</Label>
            <Input
              placeholder=""
              value={question.description ?? ""}
              onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
            />
          </div>

          {/* Linear scale range */}
          <div className="flex items-center gap-4">
            {/* From Dropdown */}
            <div>
              <Label className="mr-3">From</Label>
              <select
                className="border rounded border-gray-300 px-4 py-1 text-sm"
                value={question.from ?? 1}
                onChange={(e) =>
                  handleQuestionUpdate(stageId, question.id, "from", parseInt(e.target.value))
                }
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </div>

            <span className="text-sm text-gray-500">to</span>

            {/* To Dropdown */}
            <div>
              <Label className="mr-3">To</Label>
              <select
                className="border border-gray-300 rounded px-4 py-1 text-sm"
                value={question.to ?? 5}
                onChange={(e) =>
                  handleQuestionUpdate(stageId, question.id, "to", parseInt(e.target.value))
                }
              >
                {Array.from({ length: 9 }, (_, i) => i + 2).map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Labels */}
          {/* Optional Labels */}
          {/* From/To Labels using Options */}
          <div className="space-y-2 mt-4">
            {[question.from ?? 0, question.to ?? 5].map((labelNumber, index) => (
              <div key={labelNumber} className="flex items-center gap-2">
                <span className="text-sm w-6">{labelNumber}.</span>
                <Input
                  type="text"
                  value={question.options?.[index] ?? ""}
                  placeholder={`Label (Required)`}
                  className="w-[300px]"
                  onChange={(e) => {
                    const updatedOptions = [...(question.options ?? ["", ""])];
                    updatedOptions[index] = e.target.value;
                    handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
                  }}
                  required
                />
              </div>
            ))}
          </div>
          {props.validationErrors?.[question.id + '_options'] && <p className="text-red-600 text-sm mt-2">Options are required</p>}


        </div>

      );

    case "dropdown":

      const [csvError, setCsvError] = React.useState<string>("");
      const [csvSuccess, setCsvSuccess] = React.useState<string>("");
      const fileInputRef = React.useRef<HTMLInputElement | null>(null);

      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor={`question-${question.id}-title`}>Question</Label>
            <Input
              id={`question-title-input-${question.id}`}
              value={question.title}
              onChange={(e) =>
                handleQuestionUpdate(stageId, question.id, "title", e.target.value)
              }
              className={`mt-1 border border-gray-300 ${validationError ? "border-red-500" : ""}`}
              required
              autoFocus={!!validationError}
            />
            {validationError && (
              <div className="text-red-500 text-xs mt-1">Question title is required.</div>
            )}
            <Label>Description (Optional)</Label>
            <Input
              placeholder=""
              className="border border-gray-300 "
              value={question.description ?? ""}
              onChange={(e) => handleQuestionUpdate(stageId, question.id, "description", e.target.value)}
            />
          </div>
          <div className="flex">
            <div className="space-y-2 w-[50%] ">
              {(() => {
                // Ensure at least 2 option fields are always shown for dropdown
                const currentOptions = question.options ?? [];
                // If options is empty or has less than 2 items, pad to 2 items for display
                const displayOptions = currentOptions.length < 2 
                  ? [...currentOptions, ...Array(2 - currentOptions.length).fill("")] 
                  : currentOptions;

                return displayOptions.map((option, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center gap-2 cursor-move"
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      value={option}
                      placeholder={`Option ${index + 1}`}
                      readOnly={option.toLowerCase() === "other"}
                      className={`w-[300px] ${option.toLowerCase() === "other" ? "bg-gray-100 text-gray-500 cursor-not-allowed  " : "border border-gray-300 "}`}
                      onChange={(e) => {
                        if (option.toLowerCase() !== "other") {
                          const baseOptions = question.options ?? [];
                          const updatedOptions = [...baseOptions];
                          
                          // Ensure array is large enough for the index
                          while (updatedOptions.length <= index) {
                            updatedOptions.push("");
                          }
                          
                          updatedOptions[index] = e.target.value;
                          
                          // Always ensure at least 2 items in the array
                          if (updatedOptions.length < 2) {
                            while (updatedOptions.length < 2) {
                              updatedOptions.push("");
                            }
                          }
                          
                          handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
                        }
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const baseOptions = question.options ?? [];
                        const updatedOptions = [...baseOptions];
                        updatedOptions.splice(index, 1);
                        // Ensure at least 2 items remain
                        if (updatedOptions.length < 2) {
                          while (updatedOptions.length < 2) {
                            updatedOptions.push("");
                          }
                        }
                        handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
                      }}
                      className="text-red-500 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ));
              })()}
            </div>

            <div className="ml-2 w-[50%] justify-self-end">
              <Label>Value Type</Label>
              <select
                value={question.valueType ?? "text"}
                onChange={(e) => handleQuestionUpdate(stageId, question.id, "valueType", e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2 text-sm  border-gray-300 "
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </div>
          </div>
          {props.validationErrors?.[question.id + '_options'] && <p className="text-red-600 text-sm mt-2">Options are required</p>}

          {/* Add Option/Add Other */}
          <div className="flex items-center gap-2 text-sm mt-2">
            <button
              type="button"
              className="text-gray-700 hover:underline"
              onClick={() => {
                const updatedOptions = [...(question.options ?? ["", ""]), ""];
                handleQuestionUpdate(stageId, question.id, "options", updatedOptions);
              }}
            >
              Add option
            </button>
            <span className="text-gray-400">or</span>
            <button
              type="button"
              className="text-primary hover:underline font-semibold"
              onClick={() => {
                const currentOptions = question.options ?? ["", ""];
                if (!currentOptions.includes("other")) {
                  handleQuestionUpdate(stageId, question.id, "options", [...currentOptions, "other"]);
                }
              }}
            >
              ADD "OTHER"
            </button>
          </div>

          {/* CSV Import Option */}
          <div className="flex flex-col gap-1 mt-2">
            <label className="text-sm font-medium">Bulk Import Options from CSV</label>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={async (e) => {
                  setCsvError("");
                  setCsvSuccess("");
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => !!line);
                  if (lines.length === 0) {
                    setCsvError("CSV file is empty.");
                    return;
                  }
                  const firstLine = lines[0].toLowerCase();
                  let optionLines = lines;
                  if (firstLine === "option" || firstLine === "options") {
                    optionLines = lines.slice(1);
                  }
                  if (optionLines.length === 0) {
                    setCsvError("No options found in CSV.");
                    return;
                  }
                  const importedOptions = Array.from(new Set(optionLines.map(opt => opt.trim()).filter(opt => !!opt)));
                  if (importedOptions.length === 0) {
                    setCsvError("No valid options found in CSV.");
                    return;
                  }
                  const currentOptions = question.options ?? [];
                  const mergedOptions = Array.from(new Set([...currentOptions, ...importedOptions]));
                  handleQuestionUpdate(stageId, question.id, "options", mergedOptions);
                  setCsvSuccess(`${importedOptions.length} option(s) imported.`);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                style={{ backgroundColor: "teal", color: "white" }}

                // className="bg-gray-500 text-white hover:bg-gray-600  hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                size="sm"
              >
                Import from CSV
              </Button>
              <a
                href="data:text/csv,Option%0AApple%0ABanana%0ACherry"
                download="vibro-option-template.csv"
                className="text-xs text-blue-500 underline"
                style={{ marginLeft: 8 }}
                title="Download sample CSV"
              >
                Download Sample
              </a>
            </div>
            {csvError && <div className="text-xs text-red-600">{csvError}</div>}
            {csvSuccess && <div className="text-xs text-green-600">{csvSuccess}</div>}
          </div>
        </div>
      );


    default:
      return null;
  }
};

export default React.memo(QuestionEditor);
