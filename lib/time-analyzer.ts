import type { Transaction, TimeAnalysis } from "./types"

export function analyzeTimeData(
  transactions: Transaction[],
  granularity: "daily" | "weekly" | "monthly" = "daily",
): TimeAnalysis {
  // Filter transactions with valid dates
  const validTransactions = transactions.filter((tx) => {
    if (!tx.processing_date) return false
    const date = tx.processing_date instanceof Date ? tx.processing_date : new Date(tx.processing_date)
    return !isNaN(date.getTime())
  })

  if (validTransactions.length === 0) {
    return {
      daily: [],
      weekly: [],
      monthly: [],
    }
  }

  // Create transaction journeys using the same logic as PSP Analysis (2)
  const transactionJourneys: Record<
    string,
    {
      merchantOrderId: string
      country: string
      attempts: Array<{
        pspName: string
        status: string
        timestamp?: Date
        amount?: number
        currency?: string
      }>
      finalStatus: "success" | "failed"
      totalAttempts: number
      pspsInvolved: string[]
      date: Date
    }
  > = {}

  // First pass: Group by merchantOrderId
  validTransactions.forEach((tx) => {
    const orderId = tx.merchantOrderId || tx.transactionId || "unknown"
    const date = tx.processing_date instanceof Date ? tx.processing_date : new Date(tx.processing_date!)

    if (!transactionJourneys[orderId]) {
      transactionJourneys[orderId] = {
        merchantOrderId: orderId,
        country: (tx.country || "Unknown").trim(),
        attempts: [],
        finalStatus: "failed",
        totalAttempts: 0,
        pspsInvolved: [],
        date: date,
      }
    }

    transactionJourneys[orderId].attempts.push({
      pspName: (tx.pspName || "Unknown").trim(),
      status: tx.status || "unknown",
      timestamp: date,
      amount: tx.merchantAmount,
      currency: tx.currency,
    })
  })

  // Second pass: Determine final status and sort attempts
  Object.values(transactionJourneys).forEach((journey) => {
    // Sort attempts by timestamp
    journey.attempts.sort((a, b) => {
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    journey.totalAttempts = journey.attempts.length
    journey.pspsInvolved = [...new Set(journey.attempts.map((a) => a.pspName))]

    // Check if any attempt was successful
    const hasSuccess = journey.attempts.some(
      (attempt) =>
        attempt.status.toLowerCase().includes("approved") || attempt.status.toLowerCase().includes("success"),
    )

    journey.finalStatus = hasSuccess ? "success" : "failed"
  })

  const journeyArray = Object.values(transactionJourneys)

  // Group journeys by date periods
  const dailyGroups: Record<string, typeof journeyArray> = {}
  const weeklyGroups: Record<string, typeof journeyArray> = {}
  const monthlyGroups: Record<string, typeof journeyArray> = {}

  journeyArray.forEach((journey) => {
    const date = journey.date

    // Daily grouping
    const dayKey = date.toISOString().split("T")[0]
    if (!dailyGroups[dayKey]) dailyGroups[dayKey] = []
    dailyGroups[dayKey].push(journey)

    // Weekly grouping (ISO week)
    const weekKey = getISOWeek(date)
    if (!weeklyGroups[weekKey]) weeklyGroups[weekKey] = []
    weeklyGroups[weekKey].push(journey)

    // Monthly grouping
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = []
    monthlyGroups[monthKey].push(journey)
  })

  // Process daily data using unique transaction logic
  const daily = Object.entries(dailyGroups)
    .map(([date, journeys]) => processTimeGroupWithPSPs(date, journeys))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Process weekly data
  const weekly = Object.entries(weeklyGroups)
    .map(([week, journeys]) => ({
      week,
      ...calculateUniqueMetrics(journeys),
    }))
    .sort((a, b) => a.week.localeCompare(b.week))

  // Process monthly data
  const monthly = Object.entries(monthlyGroups)
    .map(([month, journeys]) => ({
      month,
      ...calculateUniqueMetrics(journeys),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    daily,
    weekly,
    monthly,
  }
}

function processTimeGroupWithPSPs(date: string, journeys: any[]) {
  const baseMetrics = calculateUniqueMetrics(journeys)

  // Calculate PSP-wise metrics for this date
  const pspBreakdown: Record<
    string,
    {
      total: number
      approved: number
      declined: number
      approvalRatio: number
    }
  > = {}

  // Get all PSPs involved in journeys for this date
  const allPSPs = new Set<string>()
  journeys.forEach((journey) => {
    journey.pspsInvolved.forEach((psp: string) => allPSPs.add(psp))
  })

  // Calculate metrics for each PSP using unique transaction logic
  allPSPs.forEach((pspName) => {
    const pspJourneys = journeys.filter((journey) => journey.pspsInvolved.includes(pspName))

    let approved = 0
    let declined = 0

    pspJourneys.forEach((journey) => {
      // Check if THIS PSP approved this journey
      const pspApprovedThisJourney = journey.attempts.some((attempt: any) => {
        return (
          attempt.pspName === pspName &&
          (attempt.status.toLowerCase().includes("approved") || attempt.status.toLowerCase().includes("success"))
        )
      })

      if (pspApprovedThisJourney) {
        approved++
      } else {
        declined++
      }
    })

    const total = approved + declined
    const approvalRatio = total > 0 ? (approved / total) * 100 : 0

    pspBreakdown[pspName] = {
      total,
      approved,
      declined,
      approvalRatio: Number(approvalRatio.toFixed(2)),
    }
  })

  return {
    date,
    ...baseMetrics,
    pspBreakdown,
  }
}

function calculateUniqueMetrics(journeys: any[]) {
  // Count unique approved transactions (journeys that succeeded)
  const approved = journeys.filter((journey) => journey.finalStatus === "success").length

  // Count unique declined transactions (journeys that failed)
  const declined = journeys.filter((journey) => journey.finalStatus === "failed").length

  const total = approved + declined
  const approvalRate = total > 0 ? (approved / total) * 100 : 0

  return {
    total,
    approved,
    declined,
    approvalRate: Number(approvalRate.toFixed(2)),
  }
}

function getISOWeek(date: Date): string {
  const year = date.getFullYear()
  const start = new Date(year, 0, 1)
  const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((days + start.getDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, "0")}`
}
