import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash } from "lucide-react";
import QuestionEditor from "./question-editor";
import { Question, QuestionType } from "./form-creator";

interface SubQuestionsEditorProps {
  subQuestions: Question[];
  parentQuestionId: string;
  stageId: string;
  validationErrors?: Record<string, boolean>
  questionTypes: QuestionType[];
  questionTypesObj: any[];
  handleAddSubQuestion: (stageId: string, parentQuestionId: string, type: QuestionType) => void;
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
  addOptionToSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  deleteOptionFromSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string, optionIndex: number) => void;
  getQuestionTypeLabel: (type: QuestionType, questionTypesObj: any[]) => string;
  getQuestionTypeIcon: (type: QuestionType) => any;
  MoveUpIcon: React.ElementType;
  MoveDownIcon: React.ElementType;
  CopyIcon: React.ElementType;
  handleMoveQuestionUp: (stageId: string, parentQuestionId: string) => void;
  handleMoveQuestionDown: (stageId: string, parentQuestionId: string) => void;
  handleMoveSubQuestionUp: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleMoveSubQuestionDown: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
  handleDuplicateQuestion: (stageId: string, parentQuestionId: string) => void;
  handleDuplicateSubQuestion: (stageId: string, parentQuestionId: string, subQuestionId: string) => void;
}

const SubQuestionsEditor: React.FC<SubQuestionsEditorProps> = ({
  subQuestions,
  parentQuestionId,
  stageId,
  validationErrors = {},
  questionTypes,
  questionTypesObj,
  handleAddSubQuestion,
  handleUpdateSubQuestion,
  handleDeleteSubQuestion,
  handleUpdateOption,
  addOptionToSubQuestion,
  deleteOptionFromSubQuestion,
  getQuestionTypeLabel,
  getQuestionTypeIcon,
  MoveUpIcon,
  MoveDownIcon,
  CopyIcon,
  handleMoveQuestionUp,
  handleMoveQuestionDown,
  handleMoveSubQuestionUp,
  handleMoveSubQuestionDown,
  handleDuplicateQuestion,
  handleDuplicateSubQuestion
}) => {
  return (
    <div className="space-y-2">
      {subQuestions.map((subQ, index) => (
        <Card key={subQ.id} className="p-0 mb-2">
          <CardHeader className="pb-2 pt-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {getQuestionTypeIcon(subQ.type)}
              <CardTitle className="text-base">{getQuestionTypeLabel(subQ.type, questionTypesObj)}</CardTitle>
              {subQ.required && (
                <Badge variant="outline" className="ml-2">
                  Required
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleMoveSubQuestionUp(stageId, parentQuestionId, subQ.id)}
                disabled={index === 0}
              >
                <MoveUpIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleMoveSubQuestionDown(stageId, parentQuestionId, subQ.id)}
                disabled={index === (subQuestions?.length || 1) - 1}
              >
                <MoveDownIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDuplicateSubQuestion(stageId, parentQuestionId, subQ.id)}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteSubQuestion(stageId, parentQuestionId, subQ.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Sub-question type selector */}
            <div className="mb-2">
              <Select
                value={subQ.type || ""}
                onValueChange={(value: QuestionType) => {
                  handleUpdateSubQuestion(stageId, parentQuestionId, subQ.id, "type", value);
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
            
            {/* Now use QuestionEditor recursively */}
            <QuestionEditor
              question={subQ}
              validationError={validationErrors[subQ.id] || false}
              validationErrors={validationErrors}
              questions={[]} // Pass any additional props needed
              stageId={stageId}
              questionTypes={questionTypes}
              questionTypesObj={questionTypesObj}
              handleQuestionUpdate={(stageId, subQId, field, value) =>
                handleUpdateSubQuestion(stageId, parentQuestionId, subQId, field, value)
              }
              handleAddSubQuestion={handleAddSubQuestion}
              handleUpdateSubQuestion={handleUpdateSubQuestion}
              handleDeleteSubQuestion={handleDeleteSubQuestion}
              handleUpdateOption={handleUpdateOption}
              addOptionToParentQuestion={() => {}}
              addOptionToSubQuestion={(stageId, _parentQId, subQId) =>
                addOptionToSubQuestion(stageId, parentQuestionId, subQId)
              }
              deleteOptionFromParentQuestion={() => {}}
              deleteOptionFromSubQuestion={(stageId, _parentQId, subQId, optionIndex) =>
                deleteOptionFromSubQuestion(stageId, parentQuestionId, subQId, optionIndex)
              }
              handleMoveQuestionUp={handleMoveQuestionUp}
              handleMoveQuestionDown={handleMoveQuestionDown}
              handleDuplicateQuestion={handleDuplicateQuestion}
              handleDuplicateSubQuestion={handleDuplicateSubQuestion}
              handleReorderOptions={() => {}}
              handleReorderAuditOptions={() => {}}
              MoveUpIcon={MoveUpIcon}
              MoveDownIcon={MoveDownIcon}
              CopyIcon={CopyIcon}
              getQuestionTypeIcon={getQuestionTypeIcon}
            />
            {/* Required toggle for sub-questions */}
            <div className="flex items-center justify-between my-4">
              <Label htmlFor={`subquestion-${subQ.id}-required`} className="cursor-pointer">
                Required
              </Label>
              <Switch
                id={`subquestion-${subQ.id}-required`}
                checked={subQ.required}
                onCheckedChange={(checked) =>
                  handleUpdateSubQuestion(stageId, parentQuestionId, subQ.id, "required", checked)
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Only ONE add button, outside the list */}
      <Button
        variant="secondary"
        onClick={() => handleAddSubQuestion(stageId, parentQuestionId, "short_answer" as QuestionType)}
      >
        Add Sub-Question
      </Button>
    </div>
  );
};

export default SubQuestionsEditor;
