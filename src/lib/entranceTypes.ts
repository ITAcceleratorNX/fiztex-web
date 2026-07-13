// Types mirror the Spring backend `/api/admissions/*` DTOs (Sprint 2A applicant flow).

export type EntranceListStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'OPEN_FOR_VIEWING'
  | 'UNAVAILABLE';
export type AvailableAction = 'START' | 'CONTINUE' | 'VIEW_RESULT' | 'NONE';
export type EntranceQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN_TEXT' | 'PHOTO';

export interface ApplicantView {
  id: number;
  fullName: string;
  grade: string;
  parentFullName: string | null;
}

export interface VerifyCodeResponse {
  accessToken: string;
  applicant: ApplicantView;
}

export interface AssignmentItem {
  assignmentId: number;
  attemptId: number | null;
  testTitle: string;
  subject: string;
  durationMinutes: number;
  testVersion: number | null;
  rules: string | null;
  allowBackNavigation: boolean;
  maxAttempts: number;
  status: EntranceListStatus;
  availableAction: AvailableAction;
}

export interface AssignmentListResponse {
  applicant: ApplicantView;
  assignments: AssignmentItem[];
}

export interface AttemptOption {
  id: number;
  text: string;
  orderIndex: number;
}

export interface AttemptQuestion {
  id: number;
  type: EntranceQuestionType;
  text: string;
  orderIndex: number;
  options: AttemptOption[];
}

export interface SavedAnswer {
  questionId: number;
  selectedOptionIds: number[];
  openTextAnswer: string | null;
}

/** Attempt lifecycle status as reported by the backend. */
export type AttemptStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'REVIEWED'
  | 'COMPLETED'
  | 'OPEN_FOR_VIEWING'
  | 'ASSIGNED';

export interface AttemptDetail {
  attemptId: number;
  assignmentId: number;
  status: AttemptStatus;
  testTitle: string;
  subject: string;
  durationMinutes: number;
  rules: string | null;
  allowBackNavigation: boolean;
  maxAttempts: number;
  warningText: string;
  tabSwitchCount: number;
  startedAt: string | null;
  durationSeconds: number;
  remainingSeconds: number;
  questions: AttemptQuestion[];
  answers: SavedAnswer[];
}

export interface SaveAnswerResponse {
  status: AttemptStatus;
  remainingSeconds: number;
}

export interface SubmitResponse {
  status: AttemptStatus;
}

/** Wire event names accepted by POST /admissions/attempts/{id}/events (TZ section 12/13). */
export type AttemptEventType =
  | 'started'
  | 'focus_lost'
  | 'focus_returned'
  | 'tab_switch'
  | 'window_blur'
  | 'page_closed'
  | 'resumed'
  | 'time_expired'
  | 'submitted';

export interface TopicScore {
  earned: number;
  max: number;
  percent: number;
}

export interface ApplicantResult {
  testTitle: string;
  subject: string;
  totalScore: number;
  percent: number;
  minScore: number;
  passed: boolean;
  schoolComment: string | null;
  topicBreakdown: Record<string, TopicScore>;
  weakTopics: string[];
}
