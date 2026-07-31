"use client";

import React from "react";
import { Question } from "./form-creator";
import { ImageIcon } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Input } from "@/components/ui/input"

export type AuditOption = {
  option: string;
  score: number;
};

export interface AuditQuestion {
  id: string;
  type: "audit";
  title: string;
  auditOptions?: AuditOption[];
  maxScore?: number;
  previewAnswer?: string;
  critical?: boolean;
  [key: string]: any;
}

interface AuditPreviewProps {
  question: Question;
  previewAnswer: any;
  onChangePreviewAnswer: (value: string) => void;
  allQuestions: Question[];
}

const AuditPreview: React.FC<AuditPreviewProps> = ({
  question,
  previewAnswer,
  onChangePreviewAnswer,
  allQuestions,
}) => {
  // Find all audit questions
  const auditQuestions = allQuestions.filter(q => q.type === "audit");
  // Only show the summary above the first audit question
  const showSummary = auditQuestions.length > 0 && auditQuestions[0].id === question.id;

  // Aggregate summary
  let summaryBlock = null;
  if (showSummary) {
    const totalScore = auditQuestions.reduce((sum, q) => {
      const options = q.auditOptions && q.auditOptions.length
        ? q.auditOptions
        : [{ option: "Pass", score: 1 }, { option: "Fail", score: 0 }];
      const selectedOpt = options.find(opt => opt.option === q.previewAnswer);
      return sum + (selectedOpt ? Number(selectedOpt.score) : 0);
    }, 0);

    const maxScore = auditQuestions.reduce((sum, q) => {
      const options = q.auditOptions && q.auditOptions.length
        ? q.auditOptions
        : [{ option: "Pass", score: 1 }, { option: "Fail", score: 0 }];
      // Always calculate from options: max achievable by selecting one option
      return sum + options.reduce((m, opt) => Math.max(m, Number(opt.score) || 0), 0);
    }, 0);

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // Critical fails: count only audit questions where `critical` is true and selectedOpt.score === 0
    const criticalFails = auditQuestions.reduce((count, q) => {
      if (!q.critical) return count;
      const options = q.auditOptions && q.auditOptions.length
        ? q.auditOptions
        : [{ option: "Pass", score: 1 }, { option: "Fail", score: 0 }];
      const selectedOpt = options.find(opt => opt.option === q.previewAnswer);
      return count + (selectedOpt && Number(selectedOpt.score) === 0 ? 1 : 0);
    }, 0);

    summaryBlock = (
      <div className="border border-gray-300 rounded-lg p-4 space-y-2 mb-4 bg-white">
        <div>
          <span className="font-medium text-gray-600">Score Percentage:</span>{" "}
          <span className="text-blue-700 font-semibold">
            {percentage.toFixed(1)}%
          </span>
        </div>
        <hr className="border-gray-300" />
        <div>
          <span className="font-medium text-gray-600">Score:</span>{" "}
          <span className="font-semibold">
            {totalScore} / {maxScore}
          </span>
        </div>
        <hr className="border-gray-300" />
        <div>
          <span className="font-medium text-gray-600">Critical item(s) failed:</span>{" "}
          <span className="font-semibold">
            {criticalFails}
          </span>
        </div>
      </div>
    );
  }

  const auditOptions: AuditOption[] =
    question.auditOptions && question.auditOptions.length
      ? question.auditOptions
      : [
        { option: "Pass", score: 1 },
        { option: "Fail", score: 0 },
      ];

  // Find the selected index based on previewAnswer
  const selectedIdx = auditOptions.findIndex(
    (opt) => opt.option === previewAnswer
  );

  return (
    <div className="space-y-4 border rounded-md p-4 my-2 bg-white">
      {summaryBlock}

      {/* Title */}
      <div className="mb-1 font-semibold text-lg">{question.title}</div>

      <div className="space-y-3">
        {question.description &&
          <Input
            className="text-muted-foreground"
            value={question.description ?? ""}
            readOnly
          />
        }
      </div>

      {/* 3. Options as radio */}
      <div className="space-y-2">
        {auditOptions.map((opt, idx) => (
          <label
            key={idx}
            className="flex items-center gap-2 cursor-pointer text-base"
          >
            <input
              type="radio"
              name={`audit-preview-${question.id}`}
              checked={selectedIdx === idx}
              onChange={() => onChangePreviewAnswer(opt.option)}
              className="accent-blue-500"
            />
            <span>
              {opt.option}{" "}
              <span className="text-gray-500 text-sm">({opt.score})</span>
            </span>
          </label>
        ))}
      </div>

      {/* <h3 className="mb-1 font-semibold text-lg">Observations</h3>
      <div className="space-y-2">
        <Textarea
          className="text-gray-400"
          placeholder="Your observations"
        />
      </div> */}

      {/* <div className="mb-1 font-semibold text-lg">Photo if any</div>
      <div className="border-2 border-black border-dotted rounded-md p-6 flex flex-col items-center justify-center">
        <div>photo</div>
        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          {"Tap to upload a picture"}
          <br />
          {question.maxFiles && (
            <span className="text-xs text-muted-foreground">
              Up to {question.maxFiles} image{question.maxFiles > 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div> */}
    </div>
  );
};

export default AuditPreview;