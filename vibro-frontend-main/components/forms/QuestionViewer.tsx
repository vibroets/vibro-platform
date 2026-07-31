import React from "react";
import { Card } from "@/components/ui/card";

interface QuestionViewerProps {
  question: any;
  stageId: number;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ question, stageId }) => {
  return (
    <Card className="p-4 space-y-3">
      {/* Question Title */}
      <div className="font-semibold text-lg">{question.question || "Untitled Question"}</div>

      {/* Description */}
      {question.description && (
        <p className="text-sm text-gray-600">{question.description}</p>
      )}

      {/* Question Type */}
      <p className="text-xs text-gray-500 italic">
        Type: {question.question_type}
      </p>

      {/* Options (if MCQ, Dropdown, etc.) */}
      {question.options && question.options.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-sm">Options:</p>
          <ul className="list-disc pl-6 text-sm text-gray-700">
            {question.options.map((opt: any, i: number) => (
              <li key={i}>{opt.option}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conditional Logic */}
      {question.logics && question.logics.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-sm">Conditional Logic:</p>
          {question.logics.map((logic: any, i: number) => (
            <div key={i} className="pl-4 border-l border-gray-300">
              <p className="text-xs text-gray-500">
                If answer is <b>{logic.logic_value}</b> then show:
              </p>
              {logic.logic_questions?.map((sub: any, j: number) => (
                <QuestionViewer
                  key={j}
                  stageId={stageId}
                  question={sub}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default QuestionViewer;
