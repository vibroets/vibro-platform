const LOCATION_VALUE_KEYS = [
  "name",
  "title",
  "label",
  "value",
  "address",
  "location_name",
  "location_title",
  "site_name",
  "area_name",
  "plant_name",
  "department_name",
];

const addText = (bucket: Set<string>, value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed) bucket.add(trimmed);
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    bucket.add(String(value));
  }
};

const collectCandidateValue = (bucket: Set<string>, value: unknown) => {
  if (value == null) return;
  if (typeof value === "string" || typeof value === "number") {
    addText(bucket, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectCandidateValue(bucket, entry));
    return;
  }

  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  LOCATION_VALUE_KEYS.forEach((key) => addText(bucket, obj[key]));
};

export const extractLocationSearchText = (source: unknown): string => {
  const collected = new Set<string>();
  const seen = new Set<object>();
  const stack: unknown[] = [source];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const node = current as Record<string, unknown>;
    const questionType = String(node.question_type || "").toLowerCase();

    if (questionType === "location") {
      collectCandidateValue(collected, node.answer);
      collectCandidateValue(collected, node.value);
      collectCandidateValue(collected, node.submitted_value);
      collectCandidateValue(collected, node.submission_answer);
      collectCandidateValue(collected, node.user_answer);
      collectCandidateValue(collected, node.response);
      collectCandidateValue(collected, node.response_value);
      collectCandidateValue(collected, node.answers);
      collectCandidateValue(collected, node.location);
    }

    Object.entries(node).forEach(([key, value]) => {
      if (key.toLowerCase().includes("location")) {
        collectCandidateValue(collected, value);
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    });
  }

  return Array.from(collected).join(" ");
};

export const hasLocationQuestion = (source: unknown): boolean => {
  const seen = new Set<object>();
  const stack: unknown[] = [source];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const node = current as Record<string, unknown>;
    const questionType = String(node.question_type || "").toLowerCase();
    if (questionType === "location") return true;

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return false;
};
