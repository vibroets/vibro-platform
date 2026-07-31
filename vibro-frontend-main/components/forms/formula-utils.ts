export type FormulaQuestionLike = {
  id: string | number;
  title: string;
  previewAnswer?: string | number;
  tablePreviewAnswers?: any[];
  subQuestions?: FormulaQuestionLike[];
  tableSubQuestions?: FormulaQuestionLike[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuestionAlias(value: string) {
  return value.trim().replace(/\s+/g, "_");
}

function collectQuestions(questions: FormulaQuestionLike[] = []) {
  const collected: FormulaQuestionLike[] = [];

  const visit = (items: FormulaQuestionLike[] = []) => {
    for (const item of items) {
      if (!item) continue;
      collected.push(item);
      if (Array.isArray(item.subQuestions) && item.subQuestions.length > 0) {
        visit(item.subQuestions);
      }
      if (Array.isArray(item.tableSubQuestions) && item.tableSubQuestions.length > 0) {
        visit(item.tableSubQuestions);
      }
    }
  };

  visit(questions);
  return collected;
}

function getQuestionAliases(question: FormulaQuestionLike) {
  return [
    String(question.id),
    question.title,
    normalizeQuestionAlias(question.title),
  ].filter(Boolean) as string[];
}

export function replaceFormulaQuestionRefs(
  formula: string,
  questions: FormulaQuestionLike[] = [],
  getReplacement: (question: FormulaQuestionLike) => string,
  options?: {
    preserveHash?: boolean;
  },
) {
  if (!formula) return formula;

  const collected = collectQuestions(questions);
  const aliasToQuestion = new Map<string, FormulaQuestionLike>();

  for (const question of collected) {
    for (const alias of getQuestionAliases(question)) {
      if (!aliasToQuestion.has(alias)) {
        aliasToQuestion.set(alias, question);
      }
    }
  }

  const sortedAliases = [...aliasToQuestion.keys()].sort((a, b) => b.length - a.length);
  let replaced = formula;

  for (const alias of sortedAliases) {
    const question = aliasToQuestion.get(alias);
    if (!question) continue;

    replaced = replaced.replace(
      new RegExp(`#${escapeRegExp(alias)}(?![\\w-])`, "g"),
      `${options?.preserveHash === false ? "" : "#"}${getReplacement(question)}`,
    );
  }

  return replaced;
}

export function resolveFormulaQuestionRef(
  ref: string,
  questions: FormulaQuestionLike[] = [],
) {
  const collected = collectQuestions(questions);
  const normalizedRef = ref.trim();

  return collected.find((question) => {
    return (
      String(question.id) === normalizedRef ||
      question.title === normalizedRef ||
      normalizeQuestionAlias(question.title) === normalizedRef
    );
  });
}
