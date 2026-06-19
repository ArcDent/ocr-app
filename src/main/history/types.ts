export interface HistoryItem {
  jobId: string;
  timestamp: number;
  fileName: string;
  fileSize?: number;
  status: 'success' | 'failed' | 'processing';
  errorMessage?: string;
  hasRawOutput: boolean;
  hasStructuredOutput: boolean;
  hasSummaryOutput: boolean;
  processingTimeMs?: number;
  files?: {
    raw?: string;
    structured?: string;
    summary?: string;
    structuredThoughts?: string;
    summaryThoughts?: string;
  };
}

export interface JobResult {
  jobId: string;
  fileName: string;
  fileSize?: number;
  status: 'success' | 'failed' | 'processing';
  errorMessage?: string;
  timestamp: number;
  processingTimeMs?: number;
  rawOutput?: string;
  structuredOutput?: string;
  summaryOutput?: string;
  structuredThoughts?: string;
  summaryThoughts?: string;
}
