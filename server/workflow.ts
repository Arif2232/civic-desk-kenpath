export type Stage =
  | "received"
  | "assigned"
  | "review"
  | "returned"
  | "resolved"
  | "rejected";
export type Action =
  | "assign"
  | "submit_review"
  | "approve"
  | "return"
  | "reject"
  | "resume";
export type Priority = "high" | "normal";

export const transitions: Record<Stage, Partial<Record<Action, Stage>>> = {
  received: { assign: "assigned", return: "returned", reject: "rejected" },
  assigned: { submit_review: "review", return: "returned", reject: "rejected" },
  review: { approve: "resolved", return: "assigned", reject: "rejected" },
  returned: { resume: "received" },
  resolved: {},
  rejected: {},
};

export type Complaint = {
  id: string;
  title_en: string;
  title_hi: string;
  description_en: string;
  description_hi: string;
  locality: string;
  priority: Priority;
  stage: Stage;
  created_at: string;
  updated_at: string;
  version: number;
};

export type Event = {
  id: number;
  complaint_id: string;
  action: string;
  from_stage: Stage | null;
  to_stage: Stage;
  note: string;
  created_at: string;
};

export function nextStage(stage: Stage, action: string): Stage | undefined {
  if (
    typeof action !== "string" ||
    !transitions[stage] ||
    !Object.hasOwn(transitions[stage], action)
  )
    return undefined;
  return transitions[stage][action as Action];
}
