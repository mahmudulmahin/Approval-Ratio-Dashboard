export interface Transaction {
  transactionId?: string
  merchantOrderId?: string
  pspName?: string
  country?: string
  status?: string
  merchantAmount?: number
  currency?: string
  processing_date?: Date | string
  declineReason?: string
  id?: string
  timestamp?: string | Date
}

export interface PSPStats {
  total: number
  approved: number
  declined: number
  filtered: number
  other: number
  approvalRatio: number | string
  declineRatio: number | string
}

export interface CountryStats {
  total: number
  approved: number
  declined: number
  filtered: number
  other: number
  approvalRatio: number | string
  declineRatio: number | string
  pspBreakdown: Record<string, PSPStats>
}

export interface PSPAnalysis {
  [pspName: string]: PSPStats
}

export interface CountryAnalysis {
  [countryName: string]: CountryStats
}

export interface RetriedTransaction {
  transactionId: string
  attempts: number
  psps: string[]
  countries: string[]
  finalStatus: string
  firstAttempt: Transaction
  lastAttempt: Transaction
  allAttempts: Transaction[]
}

export interface CrossPSPFlow {
  fromPSP: string
  toPSP: string
  count: number
  reason: string
}

export interface DeclineCategory {
  reason: string
  count: number
  type?: "hard" | "soft"
}

export interface TimeAnalysis {
  daily: Array<{
    date: string
    total: number
    approved: number
    declined: number
    approvalRate: number
    pspBreakdown?: Record<
      string,
      {
        total: number
        approved: number
        declined: number
        approvalRatio: number
      }
    >
  }>
  weekly: Array<{
    week: string
    total: number
    approved: number
    declined: number
    approvalRate: number
  }>
  monthly: Array<{
    month: string
    total: number
    approved: number
    declined: number
    approvalRate: number
  }>
}

export interface AnalysisResults {
  pspAnalysis: PSPAnalysis
  countryAnalysis: CountryAnalysis
  totalTransactions: number
  overallApprovalRate: number
  retriedTransactions: RetriedTransaction[]
  crossPSPFlows: CrossPSPFlow[]
  declineReasons: DeclineCategory[]
  timeAnalysis: TimeAnalysis
  transactions: Transaction[]
}
