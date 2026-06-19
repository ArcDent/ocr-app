// ============= TextIn API Types =============

export interface TextInConfig {
  appId: string
  secretCode: string
  baseUrl: string
}

export interface TextInLine {
  text?: string
}

export interface TextInPage {
  lines?: TextInLine[]
}

export interface TextInApiResponse {
  code?: number
  message?: string
  result?: {
    pages?: TextInPage[]
  }
}

// ============= Connection Test =============

export interface ConnectionTestResult {
  success: boolean
  message: string
}
