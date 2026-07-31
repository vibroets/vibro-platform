import { all, create } from "mathjs";
import { useCallback } from "react";
import {
  extractFormulaRefs,
  replaceFormulaRefsWithValues,
} from "../utils/formulaHelpers";

const math = create(all);

const toMathJSCompatibleFormula = (formula: string): string => {
  return formula
    .replace(/\bSUM\b/gi, "sum")
    .replace(/\bIF\b/gi, "if")
    .replace(/\bROUND\b/gi, "round")
    .replace(/\bMAX\b/gi, "max")
    .replace(/\bMIN\b/gi, "min")
    .replace(/\bAVERAGE\b/gi, "mean")
    .replace(/\bAVG\b/gi, "mean");
};

export const useFormulaCalculation = (control: any, stages: any[] = []) => {
  const evaluateFormula = useCallback((formula: string, values: any): string => {
    try {
      const transformedFormula = toMathJSCompatibleFormula(formula);

      const refs = extractFormulaRefs(transformedFormula);
      for (const ref of refs) {
        const value = values?.[ref];
        if (value === undefined || value === null || value === "") {
          return "";
        }
      }

      const parsedFormula = replaceFormulaRefsWithValues(
        transformedFormula,
        values,
      );
      if (!parsedFormula) {
        return "";
      }

      const result = math.evaluate(parsedFormula);
      return Number.isFinite(result) ? result.toFixed(2) : "";
    } catch (error) {
      return "";
    }
  }, []);

  return { evaluateFormula };
};
