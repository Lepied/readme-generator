// ============================================
// Type Definitions
// ============================================

export interface ProjectData {
  name: string;
  language: string;
  structure: string;
  files: string[];
  mainFiles: Record<string, string>;
  codeAnalysis?: CodeAnalysis;
}

export interface CodeAnalysis {
  files: Record<string, string>;
  features: ImplementedFeature[];
  summary: string;
  purpose: PurposeAnalysis;
  purposeSummary: string;
}

export interface ImplementedFeature {
  file: string;
  role: string;
  importance: 'high' | 'normal' | 'low';
  classes: string[];
  functions?: string[];
  keyFeatures: string[];
}

export interface PurposeAnalysis {
  category: string;
  purpose: string;
  detectedFeatures: string[];
  mainComponents: string[];
}

export interface ProjectType {
  type: string;
  language: string;
  icon: string;
}

export interface Config {
  MAX_FILES_TO_ANALYZE: number;
  MAX_FILE_SIZE: number;
  MAX_FILES_TO_SEND: number;
  DEFAULT_MODEL: string;
  DEFAULT_TEMPERATURE: number;
  MAX_OUTPUT_TOKENS: number;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
  MAX_ZIP_SIZE: number;
  IGNORE_DIRS: string[];
}
