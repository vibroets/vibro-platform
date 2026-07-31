import { useEffect, useState } from "react";
import api from "../../../services";

export interface PreviousSubmissionAnswer {
  answer: string;
  other_text: string | null;
  submitted_by: string;
  submitted_on: string | null;
  completed_on: string | null;
  submission_id: number;
  question_type: string;
}

export type PreviousSubmissionsMap = Record<string, PreviousSubmissionAnswer[]>;

interface UsePreviousSubmissionsOptions {
  formId?: string | number;
  locationId?: string | number;
  excludeSubmissionId?: string | number;
  enabled?: boolean;
}

export const usePreviousSubmissions = ({
  formId,
  locationId,
  excludeSubmissionId,
  enabled = true,
}: UsePreviousSubmissionsOptions) => {
  const [previousSubmissions, setPreviousSubmissions] = useState<PreviousSubmissionsMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !formId) {
      setPreviousSubmissions({});
      return;
    }

    let cancelled = false;
    const fetchPreviousSubmissions = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          form_id: String(formId),
        };
        if (locationId) params.location_id = String(locationId);
        if (excludeSubmissionId) params.exclude_submission_id = String(excludeSubmissionId);

        const response = await api.get("/form/previous-submissions/", { params });
        if (!cancelled && response.data?.question_answers) {
          setPreviousSubmissions(response.data.question_answers);
        }
      } catch {
        if (!cancelled) setPreviousSubmissions({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPreviousSubmissions();

    return () => {
      cancelled = true;
    };
  }, [formId, locationId, excludeSubmissionId, enabled]);

  return { previousSubmissions, loading };
};
