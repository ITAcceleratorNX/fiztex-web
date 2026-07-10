// Types mirror the Spring backend DTOs (Scope 1 contract).

export type SubjectStatus = 'ACTIVE' | 'HIDDEN';
export type TestStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type VersionStrategy = 'KEEP_CURRENT' | 'NEW_VERSION';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN_TEXT' | 'PHOTO';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type AssignmentStatus =
  | 'ASSIGNED'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AWAITING_REVIEW'
  | 'REVIEWED'
  | 'OPEN_FOR_VIEWING';

export interface Admin {
  token: string;
  email: string;
  fullName: string;
}

export interface Subject {
  id: number;
  name: string;
  description: string | null;
  status: SubjectStatus;
  testCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectRequest {
  name: string;
  description?: string | null;
  status?: SubjectStatus;
}

export interface TestVersionSummary {
  id: number;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestAssignmentView {
  id: number;
  applicantId: number;
  applicantName: string;
  grade: string;
  accessCode: string | null;
  versionNumber: number | null;
  status: AssignmentStatus;
  assignedAt: string;
  assignedBy: string | null;
}

export interface AnswerOptionResponse {
  id: number;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface QuestionResponse {
  id: number;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  type: QuestionType;
  text: string;
  maxScore: number;
  allowPhoto: boolean;
  referenceAnswer: string | null;
  gradingCriteria: string | null;
  orderIndex: number;
  isDraft: boolean;
  options: AnswerOptionResponse[];
}

export interface AnswerOptionRequest {
  text: string;
  isCorrect?: boolean;
  orderIndex?: number;
}

export interface QuestionRequest {
  topic?: string | null;
  difficulty?: QuestionDifficulty | null;
  type: QuestionType;
  text: string;
  maxScore: number;
  allowPhoto?: boolean;
  referenceAnswer?: string | null;
  gradingCriteria?: string | null;
  orderIndex?: number;
  options?: AnswerOptionRequest[];
}

export interface Test {
  id: number;
  title: string;
  subjectId: number;
  subjectName: string;
  grade: string;
  durationMinutes: number;
  minScore: number;
  maxScore: number | null;
  minPercent: number | null;
  questionCount: number;
  rules: string | null;
  status: TestStatus;
  allowBackNavigation: boolean;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  useAiGeneration: boolean;
  showResultAfterReview: boolean;
  currentVersionNumber: number | null;
  currentVersionCreatedAt: string | null;
  assignmentCount: number;
  versions: TestVersionSummary[];
  assignments: TestAssignmentView[];
  questions?: QuestionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface TestRequest {
  title: string;
  subjectId: number;
  grade: string;
  durationMinutes: number;
  minScore: number;
  rules?: string | null;
  status?: TestStatus;
  allowBackNavigation?: boolean;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  useAiGeneration?: boolean;
  showResultAfterReview?: boolean;
  versionStrategy?: VersionStrategy;
  questions?: QuestionRequest[];
}

export interface AssignmentSummary {
  id: number;
  testId: number;
  testTitle: string;
  versionNumber: number | null;
  accessCode: string | null;
  status: AssignmentStatus;
  assignedAt: string;
}

export interface Applicant {
  id: number;
  childFullName: string;
  grade: string;
  parentFullName: string | null;
  parentPhone: string | null;
  comment: string | null;
  accessCode: string | null;
  assignments: AssignmentSummary[];
  createdAt: string;
}

export interface ApplicantRequest {
  childFullName: string;
  grade: string;
  parentFullName?: string | null;
  parentPhone?: string | null;
  comment?: string | null;
}

export interface SkippedAssignment {
  applicantId: number;
  applicantName: string | null;
  reason: string;
}

export interface AssignResult {
  created: AssignmentSummary[];
  skipped: SkippedAssignment[];
}

// ---- Admin answer review (проверка ответов) ----

export type ResultStatus = 'PENDING' | 'REVIEWED' | 'OPEN_FOR_VIEWING';

export interface ReviewOption {
  id: number;
  text: string;
  correct: boolean;
  selected: boolean;
}

export interface AnswerReviewItem {
  questionId: number;
  topic: string | null;
  type: QuestionType;
  questionText: string;
  applicantAnswer: string | null;
  options: ReviewOption[];
  referenceAnswer: string | null;
  photoUrl: string | null;
  autoScore: number | null;
  aiScore: number | null;
  aiComment: string | null;
  finalScore: number | null;
  maxScore: number;
  adminComment: string | null;
}

export interface SuspiciousLogItem {
  type: string;
  details: string | null;
  occurredAt: string;
}

export interface TopicScore {
  earned: number;
  max: number;
  percent: number;
}

export interface ReviewDetail {
  resultId: number | null;
  attemptId: number;
  assignmentId: number;
  applicantName: string;
  testTitle: string;
  totalScore: number;
  percent: number;
  minScore: number;
  passed: boolean;
  status: ResultStatus;
  schoolComment: string | null;
  attemptStatus: AssignmentStatus;
  answers: AnswerReviewItem[];
  suspiciousLogs: SuspiciousLogItem[];
  topicBreakdown: Record<string, TopicScore>;
  weakTopics: string[];
  finishedAt: string | null;
}

export interface ScoreAnswerRequest {
  finalScore: number;
  adminComment?: string | null;
}

export interface ConfirmReviewRequest {
  schoolComment?: string | null;
}

// ---- Subject materials library ----

export type MaterialStatus = 'UPLOADED' | 'EXTRACTING' | 'READY' | 'EXTRACTION_FAILED';

export interface Material {
  id: number;
  subjectId: number;
  title: string;
  description: string | null;
  topic: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: MaterialStatus;
  visibleToStudents: boolean;
  createdAt: string;
  errorMessage: string | null;
}

export interface MaterialUpdateRequest {
  title?: string;
  description?: string | null;
  topic?: string | null;
  visibleToStudents?: boolean;
}

export interface MaterialDownloadResponse {
  url: string;
}

// ---- Test generation (AI) ----

export type GenerationJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface GenerateTestRequest {
  materialIds: number[];
  count: number;
  types: Array<'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'>;
  difficulty?: QuestionDifficulty | null;
  topic?: string | null;
}

export interface GenerationJobResponse {
  id: number;
  testId: number;
  status: GenerationJobStatus;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}
