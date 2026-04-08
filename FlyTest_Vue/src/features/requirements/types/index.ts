// 闇€姹傜鐞嗙浉鍏崇殑TypeScript绫诲瀷瀹氫箟

// 鍩虹鍝嶅簲绫诲瀷
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  code: number;
  message: string;
  data: T | null;
  errors?: Record<string, any> | null;
}

// 鍒嗛〉鍝嶅簲绫诲瀷
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// 鏂囨。鐘舵€佹灇涓?
export type DocumentStatus =
  | 'uploaded'           // 宸蹭笂浼?
  | 'processing'         // 澶勭悊涓?
  | 'module_split'       // 妯″潡鎷嗗垎涓?
  | 'user_reviewing'     // 鐢ㄦ埛璋冩暣涓?
  | 'ready_for_review'   // 寰呰瘎瀹?
  | 'reviewing'          // 璇勫涓?
  | 'review_completed'   // 璇勫瀹屾垚
  | 'failed';            // 澶勭悊澶辫触

// 鏂囨。绫诲瀷鏋氫妇
export type DocumentType = 'pdf' | 'doc' | 'docx' | 'txt' | 'md';

// 闇€姹傛枃妗ｆ帴鍙?
export interface RequirementDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: DocumentType;
  file?: string; // 鏂囦欢URL
  content?: string | null;
  status: DocumentStatus;
  version: string;
  is_latest: boolean;
  parent_document?: string | null;
  uploader: number; // 鐢ㄦ埛ID
  uploader_name: string;
  project: string; // 椤圭洰ID锛屾牴鎹柊API鏂囨。鏇存柊涓哄瓧绗︿覆绫诲瀷
  project_name: string;
  uploaded_at: string;
  updated_at: string;
  word_count: number;
  page_count: number;
  modules_count: number;
  has_images: boolean;
  image_count: number;
}

// 鍒涘缓鏂囨。璇锋眰
export interface CreateDocumentRequest {
  title: string;
  description?: string;
  document_type: DocumentType;
  project: string; // 椤圭洰ID锛岃櫧鐒跺悗绔湡鏈涙暟瀛楋紝浣嗘垜浠湪鏈嶅姟灞傝浆鎹?
  file?: File;
  content?: string;
}

// 鏂囨。妯″潡鎺ュ彛
export interface DocumentModule {
  id: string;
  title: string;
  content: string;
  start_page?: number;
  end_page?: number;
  start_position?: number;
  end_position?: number;
  order: number;
  parent_module?: string | null;
  is_auto_generated?: boolean;
  confidence_score?: number;
  ai_suggested_title?: string;
  created_at?: string;
  updated_at?: string;
  issues_count?: number;
}

// 妯″潡鎿嶄綔绫诲瀷
export type ModuleOperationType = 'merge' | 'split' | 'rename' | 'reorder' | 'delete' | 'create' | 'update' | 'adjust_boundary';

// 妯″潡鎿嶄綔璇锋眰
export interface ModuleOperationRequest {
  operation: ModuleOperationType;
  target_modules: string[];
  merge_title?: string;
  merge_order?: number;
  split_points?: number[];
  split_titles?: string[];
  new_module_data?: Partial<DocumentModule>;
  new_orders?: Record<string, number>;
  new_boundary?: {
    start_position: number;
    end_position: number;
  };
}

// 鎵归噺妯″潡鎿嶄綔璇锋眰
export interface BatchModuleOperationRequest {
  operations: ModuleOperationRequest[];
}

// 鎷嗗垎绾у埆绫诲瀷
export type SplitLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'auto';

// 妯″潡鎷嗗垎璇锋眰
export interface SplitModulesRequest {
  split_level: SplitLevel;
  include_context?: boolean;
  chunk_size?: number;
}

// 妯″潡鎷嗗垎鍝嶅簲
export interface SplitModulesResponse {
  split_options: SplitModulesRequest;
  modules: DocumentModule[];
  status: DocumentStatus;
  total_modules: number;
  suggestions: string[];
}

// 涓婁笅鏂囨娴嬪缓璁被鍨?
export type ContextSuggestion = 'OK' | 'SPLIT_RECOMMENDED' | 'SPLIT_REQUIRED';

// 涓婁笅鏂囧垎鏋愮粨鏋?
export interface ContextAnalysis {
  model_name: string;
  token_count: number;
  context_limit: number;
  available_tokens: number;
  reserved_tokens: number;
  exceeds_limit: boolean;
  usage_percentage: number;
  remaining_tokens?: number;
  suggestion: ContextSuggestion;
  message: string;
  optimal_chunk_size?: number;
}

// 鏂囨。淇℃伅
export interface DocumentInfo {
  title: string;
  content_length: number;
  word_count: number;
  page_count: number;
}

// 涓婁笅鏂囨娴嬪搷搴?
export interface ContextCheckResponse {
  document_info: DocumentInfo;
  context_analysis: ContextAnalysis;
  recommendations: string[];
}

// 鏂囨。缁撴瀯鍒嗘瀽
export interface DocumentStructure {
  h1_titles: string[];
  h2_titles: string[];
  h3_titles: string[];
  h4_titles: string[];
  h5_titles: string[];
  h6_titles: string[];
}

// 鎷嗗垎寤鸿
export interface SplitRecommendation {
  level: SplitLevel;
  modules_count: number;
  description: string;
  suitable_for: string;
  recommended?: boolean;
}

// 鏂囨。缁撴瀯鍒嗘瀽鍝嶅簲
export interface DocumentStructureResponse {
  document_info: DocumentInfo;
  structure_analysis: DocumentStructure;
  split_recommendations: SplitRecommendation[];
}

// 璇勫绫诲瀷
export type AnalysisType = 'comprehensive' | 'quick' | 'custom';

// 寮€濮嬭瘎瀹¤姹?
export interface StartReviewRequest {
  analysis_type: AnalysisType;
  parallel_processing?: boolean;
  priority_modules?: string[];
  custom_requirements?: string;
  direct_review?: boolean; // 鏂板鐩存帴璇勫鍙傛暟
  max_workers?: number; // 鏂板骞跺彂鏁板弬鏁?
  // 鏂板鎻愮ず璇嶇浉鍏冲弬鏁?
  prompt_ids?: {
    completeness_analysis?: number;
    consistency_analysis?: number;
    testability_analysis?: number;
    feasibility_analysis?: number;
    clarity_analysis?: number;
    logic_analysis?: number;
  };
}

// 璇勫杩涘害
export interface ReviewProgress {
  task_id: string;
  overall_progress: number;
  status: string;
  current_step: string;
  modules_progress: ModuleProgress[];
}

// 妯″潡杩涘害
export interface ModuleProgress {
  module_name: string;
  status: string;
  progress: number;
  issues_found: number;
}

// 璇勭骇绫诲瀷
export type Rating =
  | 'excellent'
  | 'good'
  | 'average'
  | 'needs_improvement'
  | 'fair'
  | 'poor';

// 闂绫诲瀷
export type ReviewReportStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type IssueType = 'specification' | 'clarity' | 'completeness' | 'consistency' | 'feasibility' | 'logic';

// 闂浼樺厛绾?
export type IssuePriority = 'high' | 'medium' | 'low';

// 璇勫闂
export interface ReviewIssue {
  id: string;
  issue_type: IssueType;
  issue_type_display: string;
  priority: IssuePriority;
  priority_display: string;
  title: string;
  description: string;
  suggestion: string;
  location: string;
  page_number?: number | null;
  section: string;
  module?: string | null;
  module_name?: string;
  is_resolved: boolean;
  resolution_note: string;
  created_at: string;
  updated_at: string;
}

// 妯″潡璇勫缁撴灉
export interface ModuleReviewResult {
  id: string;
  module: string;
  module_name: string;
  module_rating: Rating;
  module_rating_display: string;
  issues_count: number;
  severity_score: number;
  analysis_content?: string;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
}

// 璇勫鎶ュ憡
export interface SpecializedReviewIssue {
  id?: string;
  title?: string;
  description?: string;
  priority?: IssuePriority;
  severity?: IssuePriority;
  category?: string;
  suggestion?: string;
  location?: string;
  source?: string;
}

export interface SpecializedAnalysis {
  overall_score: number;
  summary: string;
  issues: SpecializedReviewIssue[];
  strengths: string[];
  recommendations: string[];
}

export interface ReviewScores {
  completeness: number;
  consistency: number;
  testability: number;
  feasibility: number;
  clarity: number;
  logic: number;
}

export interface ReviewReport {
  id: string;
  document: string;
  document_title: string;
  review_date: string;
  reviewer: string;
  status: ReviewReportStatus;
  status_display: string;
  overall_rating: Rating;
  overall_rating_display: string;
  completion_score: number;
  overall_score?: number;
  total_issues: number;
  high_priority_issues: number;
  medium_priority_issues: number;
  low_priority_issues: number;
  summary: string;
  recommendations: string;
  issues: ReviewIssue[];
  module_results: ModuleReviewResult[];
  scores?: ReviewScores;
  specialized_analyses?: Record<string, SpecializedAnalysis>;
  // 杩涘害璺熻釜瀛楁
  progress?: number;
  current_step?: string;
  completed_steps?: string[];
}

// 鏂囨。璇︽儏锛堝寘鍚ā鍧楀拰璇勫鎶ュ憡锛?
export interface DocumentDetail extends RequirementDocument {
  modules: DocumentModule[];
  review_reports: ReviewReport[];
  latest_review?: ReviewReport;
}

// 鏌ヨ鍙傛暟鎺ュ彛
export interface DocumentListParams {
  project: string;
  status?: DocumentStatus;
  document_type?: DocumentType;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ReportListParams {
  document?: string;
  status?: string;
  overall_rating?: Rating;
  page?: number;
  page_size?: number;
}

export interface IssueListParams {
  report?: string;
  module?: string;
  issue_type?: IssueType;
  priority?: IssuePriority;
  is_resolved?: boolean;
  page?: number;
  page_size?: number;
}

// 鏇存柊闂璇锋眰
export interface UpdateIssueRequest {
  is_resolved?: boolean;
  resolution_note?: string;
}

// 鐘舵€佹樉绀烘槧灏?
export const DocumentStatusDisplay: Record<DocumentStatus, string> = {
  uploaded: '已上传',
  processing: '处理中',
  module_split: '模块拆分中',
  user_reviewing: '用户调整中',
  ready_for_review: '待评审',
  reviewing: '评审中',
  review_completed: '评审完成',
  failed: '处理失败'
};

export const DocumentTypeDisplay: Record<DocumentType, string> = {
  pdf: 'PDF',
  doc: 'Word文档',
  docx: 'Word文档',
  txt: '文本文档',
  md: 'Markdown'
};

export const RatingDisplay: Record<Rating, string> = {
  excellent: '\u4f18\u79c0',
  good: '\u826f\u597d',
  average: '\u4e00\u822c',
  needs_improvement: '\u9700\u6539\u8fdb',
  fair: '\u4e00\u822c',
  poor: '\u8f83\u5dee'
};

export const IssueTypeDisplay: Record<IssueType, string> = {
  specification: '规范性',
  clarity: '清晰度',
  completeness: '完整性',
  consistency: '一致性',
  feasibility: '可行性',
  logic: '逻辑性'
};

export const IssuePriorityDisplay: Record<IssuePriority, string> = {
  high: '高',
  medium: '中',
  low: '低'
};

