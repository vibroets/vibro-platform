import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { create, all } from "mathjs";
import { Question } from './form-creator';
import { replaceFormulaQuestionRefs } from "./formula-utils";

const math = create(all, {});
math.import({
  SUM: (...args: number[]) => math.sum(args),
  MUL: (...args: number[]) => math.prod(args),
  SQRT: (x: number) => math.sqrt(x),
  AVG: (...args: number[]) => math.mean(args),
  MIN: (...args: number[]) => math.min(args),
  MAX: (...args: number[]) => math.max(args),
});

const KEYPAD: string[][] = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", "(", ")", "+"],
  ["[", "]", "Del", "Clear"],
];

const FUNCTIONS = [
  { label: "SUM", insert: "SUM(,)" },
  { label: "MUL", insert: "MUL(,)" },
  { label: "SQRT", insert: "SQRT()" },
  { label: "AVG", insert: "AVG(,)" },
  { label: "MIN", insert: "MIN(,)" },
  { label: "MAX", insert: "MAX(,)" },
];

interface FormulaEditorFieldProps {
  question: Question;
  questions: Question[];
  onChange: (newFormula: string) => void;
}


// Helper: get display formula with titles instead of IDs
function getDisplayFormula(formula: string, questions: Question[]) {
  return replaceFormulaQuestionRefs(formula, questions, (question) => question.title);
}

// Build formula string from contenteditable
function buildFormulaFromContent(el: HTMLElement | null, questions: Question[]) {
  if (!el) return "";
  const rawFormula = el.innerText || "";
  return replaceFormulaQuestionRefs(rawFormula, questions, (question) => String(question.id));
}

// Caret helpers (unchanged)
function getCaretOffset(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  let charCount = 0;
  function count(node: Node): boolean {
    if (node === range.endContainer) {
      charCount += range.endOffset;
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      charCount += node.textContent!.length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).dataset.type === 'badge') {
        charCount += (`#${(node as HTMLElement).dataset.value}`).length;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (count(node.childNodes[i])) return true;
        }
      }
    }
    return false;
  }
  count(el);
  return charCount;
}

function setCaretOffset(el: HTMLElement, offset: number) {
  let current = 0;
  let found = false;
  const range = document.createRange();
  function traverse(node: Node): boolean {
    if (found) return true;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent!.length;
      if (current + len >= offset) {
        range.setStart(node, offset - current);
        range.collapse(true);
        found = true;
        return true;
      }
      current += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).dataset.type === 'badge') {
        const badgeLen = (`#${(node as HTMLElement).dataset.value}`).length;
        if (current + badgeLen >= offset) {
          if (node.nextSibling) {
            range.setStartBefore(node.nextSibling);
          } else {
            range.setStartAfter(node);
          }
          range.collapse(true);
          found = true;
          return true;
        }
        current += badgeLen;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (traverse(node.childNodes[i])) return true;
        }
      }
    }
    return false;
  }
  traverse(el);
  if (!found) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

const FormulaEditorField: React.FC<FormulaEditorFieldProps> = ({
  question,
  questions,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [tempFormula, setTempFormula] = useState(question.formula || "");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"calculator" | "question">("calculator");
  const [questionSearch, setQuestionSearch] = useState("");
  const editableRef = useRef<HTMLDivElement>(null);

  // Sync formula on dialog open
  useEffect(() => {
    if (open) {
      setTempFormula(question.formula || "");
      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.innerText = getDisplayFormula(question.formula || "", questions);
        }
      }, 0);
    }
    // eslint-disable-next-line
  }, [open, question.formula, questions]);

  useEffect(() => {
    if (!tempFormula.trim()) {
      setError(null);
      return;
    }
    try {
      let testFormula = replaceFormulaQuestionRefs(tempFormula, questions, () => "1", {
        preserveHash: false,
      });
      testFormula = testFormula.replace(/\[([\w-]+)\]/g, "1");
      testFormula = testFormula.replace(/([A-Z]+)\(\s*\)/g, "$1(1)");

      const compact = testFormula.replace(/\s+/g, "");
      if (/[)\d\]]\s*[A-Za-z\[\(]/.test(compact)) {
        throw new Error("Unexpected sequence in formula");
      }
      math.evaluate(testFormula);
      setError(null);
    } catch (e) {
      setError("Invalid formula");
    }
  }, [tempFormula]);

  function insertAtCursor(str: string) {
    if (!editableRef.current) return;
    editableRef.current.focus();
    document.execCommand("insertText", false, str);
    setTempFormula(buildFormulaFromContent(editableRef.current, questions));
  }

  function handleQuestionSelect(q: Question) {
    insertAtCursor(`#${q.title}`);
    setTempFormula(buildFormulaFromContent(editableRef.current, questions));
  }

  function handleInput() {
    setTempFormula(buildFormulaFromContent(editableRef.current, questions));
  }

  return (
    <>
      <Input
        value={getDisplayFormula(question.formula || "", questions)}
        readOnly
        placeholder="Enter formula"
        onClick={() => setOpen(true)}
        className="bg-blue-50 border-blue-300 font-mono text-blue-900 focus:ring-2 focus:ring-blue-300"
        style={{ cursor: "pointer" }}
      />


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-blue-50 rounded-2xl shadow-lg border-blue-100 border-2 max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-blue-900 font-bold">Edit Formula</DialogTitle>
          </DialogHeader>
          <div>
            <div
              ref={editableRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              className={
                "mb-2 w-full min-h-[38px] px-3 py-2 rounded-lg border-2 shadow-sm focus:outline-none bg-white " +
                (error ? "border-red-500" : "border-blue-300")
              }
              style={{
                fontFamily: "monospace",
                fontSize: "1.1em",
                transition: "border 0.2s",
              }}
              onInput={handleInput}
            />
            {error && (
              <div className="text-xs text-red-600 mt-1 mb-1">{error}</div>
            )}

            <Tabs
              defaultValue="calculator"
              value={tab}
              onValueChange={(v) => setTab(v as "calculator" | "question")}
            >
              <TabsList className="mb-2 bg-blue-100 rounded shadow-inner">
                <TabsTrigger value="calculator" className="font-medium">Calculator</TabsTrigger>
                <TabsTrigger value="question" className="font-medium">Question</TabsTrigger>
              </TabsList>
              <TabsContent value="calculator">
                <div className="flex flex-wrap gap-2 mb-2">
                  {FUNCTIONS.map((fn) => (
                    <Button
                      key={fn.label}
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => insertAtCursor(fn.insert)}
                      className="bg-blue-200 text-blue-900 hover:bg-blue-300"
                      style={{ minWidth: 60 }}
                    >
                      {fn.label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {KEYPAD.flat().map((key, i) => (
                    <Button
                      key={i}
                      variant={
                        ["Del", "Clear"].includes(key) ? "outline" : "secondary"
                      }
                      onClick={() => {
                        if (key === "Del") {
                          document.execCommand("delete");
                        } else if (key === "Clear") {
                          setTempFormula("");
                        } else {
                          insertAtCursor(key);
                        }
                        setTempFormula(buildFormulaFromContent(editableRef.current, questions));
                      }}
                      className={["Del", "Clear"].includes(key) ? "text-blue-900 border-blue-300" : "bg-blue-200 text-blue-900 hover:bg-blue-300"}
                      type="button"
                    >
                      {key}
                    </Button>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="question">
                <div className="mb-2">
                  <Input
                    value={questionSearch}
                    onChange={e => setQuestionSearch(e.target.value)}
                    placeholder="Search questions..."
                    className="w-full rounded-lg border-blue-200 bg-blue-50 focus:ring-2 focus:ring-blue-200"
                    autoFocus={tab === "question"}
                  />
                </div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {questions
                    .filter((q) => q.id !== question.id)
                    .filter(q =>
                      q.title.toLowerCase().includes(questionSearch.toLowerCase())
                    )
                    .map((q) => (
                      <Button
                        key={q.id}
                        type="button"
                        variant="outline"
                        className="w-full flex justify-between bg-blue-100 text-blue-900 hover:bg-blue-200 border-blue-200"
                        onClick={(e) => {
                          handleQuestionSelect(q);
                        }}
                        disabled={
                          !(
                            q.type === "short_answer" &&
                            q.valueType === "number"
                          )
                        }
                      >
                        {q.title}
                        {!(
                          q.type === "short_answer" && q.valueType === "number"
                        ) && (
                            <span className="text-xs text-muted-foreground">
                              (not a number)
                            </span>
                          )}
                      </Button>
                    ))}
                  {questions
                    .filter((q) => q.id !== question.id)
                    .filter(q =>
                      q.title.toLowerCase().includes(questionSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="text-xs text-muted-foreground text-center p-2">
                        No questions found
                      </div>
                    )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!error) {
                  onChange(tempFormula);
                  setOpen(false);
                }
              }}
              type="button"
              className="bg-blue-700 text-white hover:bg-blue-800"
              disabled={!!error}
            >
              Save
            </Button>
            <Button
              variant="outline"
              className="border-blue-200 text-blue-900 hover:bg-blue-100"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FormulaEditorField;
