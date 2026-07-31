import { Question } from "../types/formTypes";

function flattenQuestions(questions: Question[] = []): Question[] {
  const result: Question[] = [];

  const visit = (items: Question[] = []) => {
    for (const question of items) {
      if (!question) continue;
      result.push(question);
      if (Array.isArray(question.sub_questions) && question.sub_questions.length > 0) {
        visit(question.sub_questions);
      }
      if (Array.isArray(question.logics)) {
        for (const logic of question.logics) {
          if (Array.isArray(logic.logic_questions) && logic.logic_questions.length > 0) {
            visit(logic.logic_questions);
          }
          if (
            Array.isArray(logic.follow_up?.task_close_questions) &&
            logic.follow_up.task_close_questions.length > 0
          ) {
            visit(logic.follow_up.task_close_questions);
          }
        }
      }
    }
  };

  visit(questions);
  return result;
}

function getQuestionLabel(question: Question) {
  return question.question || (question as any).title || "";
}

export function getFormulaDisplayText(formula?: string, questions: Question[] = []) {
  if (!formula) return "";

  const lookup = new Map<string, Question>();
  flattenQuestions(questions).forEach((question) => {
    lookup.set(String(question.question_uuid), question);
    if ((question as any).uniqueId) {
      lookup.set(String((question as any).uniqueId), question);
    }
  });

  return formula.replace(/#([A-Za-z0-9_-]+)/g, (match, ref) => {
    const question = lookup.get(ref);
    return question ? `#${getQuestionLabel(question)}` : match;
  });
}

export function extractFormulaRefs(formula?: string) {
  if (!formula) return [];
  return Array.from(new Set(Array.from(formula.matchAll(/#([A-Za-z0-9_-]+)/g)).map((m) => m[1])));
}

export function replaceFormulaRefsWithValues(
  formula: string,
  values: Record<string, any> = {},
  onMissingRef?: (ref: string) => void,
) {
  const refs = extractFormulaRefs(formula);
  for (const ref of refs) {
    const value = values[ref];
    if (value === undefined || value === null || value === "") {
      onMissingRef?.(ref);
      return "";
    }
  }

  return formula.replace(/#([A-Za-z0-9_-]+)/g, (_, ref) => {
    const value = values[ref];
    const num = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(num) ? String(num) : "0";
  });
}

export function buildFormulaValueMap(questions: Question[] = [], values: Record<string, any> = {}) {
  const flattened = flattenQuestions(questions);
  const normalized: Record<string, any> = { ...values };

  flattened.forEach((question) => {
    const rawValue =
      values[question.question_uuid] ??
      values[(question as any).uniqueId];

    if (rawValue !== undefined) {
      normalized[question.question_uuid] = rawValue;
      if ((question as any).uniqueId) {
        normalized[String((question as any).uniqueId)] = rawValue;
      }
    }
  });

  return normalized;
}
