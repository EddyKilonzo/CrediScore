export const QUEUES = {
  REVIEW_PROCESSING: 'review-processing',
  DOCUMENT_PROCESSING: 'document-processing',
  USER_ANALYSIS: 'user-analysis',
} as const;

export const JOB_NAMES = {
  PROCESS_REVIEW: 'process-review',
  PROCESS_DOCUMENT: 'process-document',
  ANALYZE_USER: 'analyze-user',
} as const;
