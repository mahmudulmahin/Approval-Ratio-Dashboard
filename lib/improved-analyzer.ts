import type { Transaction } from "./types"

// Define the improved analysis result types
export interface TransactionJourney {
  transactionId: string
  merchantOrderId: string
  country: string
  attempts: Array<{
    pspName: string
    status: string
    timestamp?: Date
    amount?: number
    currency?: string
    position: number
  }>
  finalStatus: "success" | "failed"
  totalAttempts: number
  pspsInvolved: string[]
  approvedBy?: string
  date: Date
}

export interface PSPStats {
  totalAttempts: number
  approvedAttempts: number
  declinedAttempts: number
  uniqueApproved: number
  uniqueDeclined: number
  individualApprovalRate: number
  trueApprovalRate: number
  avgPosition: number
}

export interface CountryBreakdown {
  totalApprovedTransactions: number
  totalUniqueDeclinedTransactions: number
  totalProcessedTransactions: number
  successRate: number
  pspBreakdown: Record<
    string,
    {
      approvedTransactions: number
      declinedTransactions: number
      totalTransactions: number
      successRate: number
    }
  >
}

export interface ImprovedAnalysisResults {
  transactionJourneys: Record<string, TransactionJourney>
  pspLevelMetrics: {
    pspStats: Record<string, PSPStats>
    totalApprovedTransactions: number
    totalUniqueDeclinedTransactions: number
    totalProcessedTransactions: number
    weightedSuccessRate: number
  }
  transactionLevelMetrics: {
    countryBreakdown: Record<string, CountryBreakdown>
    totalApprovedTransactions: number
    totalUniqueDeclinedTransactions: number
    totalProcessedTransactions: number
    weightedSuccessRate: number
  }
}

export function improvedAnalyzeData(transactions: Transaction[]): ImprovedAnalysisResults {
  // Create transaction journeys
  const transactionJourneys: Record<string, TransactionJourney> = {}

  // First pass: Group by merchantOrderId to create journeys
  transactions.forEach((tx) => {
    const orderId = tx.merchantOrderId || tx.transactionId || "unknown"
    const date = tx.processing_date instanceof Date ? tx.processing_date : new Date(tx.processing_date || Date.now())

    if (!transactionJourneys[orderId]) {
      transactionJourneys[orderId] = {
        transactionId: tx.transactionId || orderId,
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
      position: 0, // Will be calculated later
    })
  })

  // Second pass: Process journeys and calculate positions
  Object.values(transactionJourneys).forEach((journey) => {
    // Sort attempts by timestamp if available
    if (journey.attempts.some((a) => a.timestamp)) {
      journey.attempts.sort((a, b) => {
        if (!a.timestamp) return 1
        if (!b.timestamp) return -1
        return a.timestamp.getTime() - b.timestamp.getTime()
      })
    }

    // Assign positions
    journey.attempts.forEach((attempt, index) => {
      attempt.position = index + 1
    })

    journey.totalAttempts = journey.attempts.length
    journey.pspsInvolved = [...new Set(journey.attempts.map((a) => a.pspName))]

    // Check if any attempt was successful
    const successfulAttempt = journey.attempts.find((attempt) => {
      const status = attempt.status.toLowerCase()
      return status.includes("approved") || status.includes("success")
    })

    if (successfulAttempt) {
      journey.finalStatus = "success"
      journey.approvedBy = successfulAttempt.pspName
    } else {
      journey.finalStatus = "failed"
    }
  })

  const journeyArray = Object.values(transactionJourneys)

  // Calculate PSP-level metrics
  const pspStats: Record<string, PSPStats> = {}

  // Initialize PSP stats
  journeyArray.forEach((journey) => {
    journey.attempts.forEach((attempt) => {
      if (!pspStats[attempt.pspName]) {
        pspStats[attempt.pspName] = {
          totalAttempts: 0,
          approvedAttempts: 0,
          declinedAttempts: 0,
          uniqueApproved: 0,
          uniqueDeclined: 0,
          individualApprovalRate: 0,
          trueApprovalRate: 0,
          avgPosition: 0,
        }
      }
    })
  })

  // Calculate attempt-level metrics
  journeyArray.forEach((journey) => {
    journey.attempts.forEach((attempt) => {
      const psp = pspStats[attempt.pspName]
      psp.totalAttempts++

      const status = attempt.status.toLowerCase()
      if (status.includes("approved") || status.includes("success")) {
        psp.approvedAttempts++
      } else if (status.includes("declined") || status.includes("fail") || status.includes("error")) {
        psp.declinedAttempts++
      }
    })
  })

  // Calculate unique transaction metrics
  journeyArray.forEach((journey) => {
    const pspsInJourney = new Set<string>()
    journey.attempts.forEach((attempt) => {
      pspsInJourney.add(attempt.pspName)
    })

    // For each PSP involved in this journey
    pspsInJourney.forEach((pspName) => {
      const psp = pspStats[pspName]

      // Check if THIS PSP approved this specific journey
      const pspApprovedThisJourney = journey.attempts.some((attempt) => {
        return (
          attempt.pspName === pspName &&
          (attempt.status.toLowerCase().includes("approved") || attempt.status.toLowerCase().includes("success"))
        )
      })

      if (pspApprovedThisJourney) {
        psp.uniqueApproved++
      } else {
        // This PSP was involved but didn't approve
        psp.uniqueDeclined++
      }
    })
  })

  // Calculate position averages
  Object.entries(pspStats).forEach(([pspName, stats]) => {
    const positions: number[] = []
    journeyArray.forEach((journey) => {
      journey.attempts.forEach((attempt) => {
        if (attempt.pspName === pspName) {
          positions.push(attempt.position)
        }
      })
    })

    stats.avgPosition = positions.length > 0 ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length : 0

    // Calculate rates
    stats.individualApprovalRate = stats.totalAttempts > 0 ? (stats.approvedAttempts / stats.totalAttempts) * 100 : 0

    const uniqueTotal = stats.uniqueApproved + stats.uniqueDeclined
    stats.trueApprovalRate = uniqueTotal > 0 ? (stats.uniqueApproved / uniqueTotal) * 100 : 0
  })

  // Calculate overall PSP-level metrics
  const totalApprovedTransactions = Object.values(pspStats).reduce((sum, psp) => sum + psp.uniqueApproved, 0)
  const totalUniqueDeclinedTransactions = Object.values(pspStats).reduce((sum, psp) => sum + psp.uniqueDeclined, 0)
  const totalProcessedTransactions = totalApprovedTransactions + totalUniqueDeclinedTransactions
  const weightedSuccessRate =
    totalProcessedTransactions > 0 ? (totalApprovedTransactions / totalProcessedTransactions) * 100 : 0

  // Calculate country-level metrics
  const countryBreakdown: Record<string, CountryBreakdown> = {}

  // Group journeys by country
  const journeysByCountry: Record<string, TransactionJourney[]> = {}
  journeyArray.forEach((journey) => {
    if (!journeysByCountry[journey.country]) {
      journeysByCountry[journey.country] = []
    }
    journeysByCountry[journey.country].push(journey)
  })

  // Calculate metrics for each country
  Object.entries(journeysByCountry).forEach(([country, journeys]) => {
    const approvedJourneys = journeys.filter((j) => j.finalStatus === "success")
    const declinedJourneys = journeys.filter((j) => j.finalStatus === "failed")

    const totalApproved = approvedJourneys.length
    const totalDeclined = declinedJourneys.length
    const totalProcessed = totalApproved + totalDeclined
    const successRate = totalProcessed > 0 ? (totalApproved / totalProcessed) * 100 : 0

    // Calculate PSP breakdown for this country
    const pspBreakdown: Record<
      string,
      {
        approvedTransactions: number
        declinedTransactions: number
        totalTransactions: number
        successRate: number
      }
    > = {}

    // Get all PSPs involved in this country
    const countryPSPs = new Set<string>()
    journeys.forEach((journey) => {
      journey.pspsInvolved.forEach((psp) => countryPSPs.add(psp))
    })

    countryPSPs.forEach((pspName) => {
      const pspJourneys = journeys.filter((journey) => journey.pspsInvolved.includes(pspName))

      let approved = 0
      let declined = 0

      pspJourneys.forEach((journey) => {
        // Check if THIS PSP approved this journey
        const pspApprovedThisJourney = journey.attempts.some((attempt) => {
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
      const pspSuccessRate = total > 0 ? (approved / total) * 100 : 0

      pspBreakdown[pspName] = {
        approvedTransactions: approved,
        declinedTransactions: declined,
        totalTransactions: total,
        successRate: pspSuccessRate,
      }
    })

    countryBreakdown[country] = {
      totalApprovedTransactions: totalApproved,
      totalUniqueDeclinedTransactions: totalDeclined,
      totalProcessedTransactions: totalProcessed,
      successRate,
      pspBreakdown,
    }
  })

  // Calculate overall transaction-level metrics
  const transactionLevelTotalApproved = Object.values(countryBreakdown).reduce(
    (sum, country) => sum + country.totalApprovedTransactions,
    0,
  )
  const transactionLevelTotalDeclined = Object.values(countryBreakdown).reduce(
    (sum, country) => sum + country.totalUniqueDeclinedTransactions,
    0,
  )
  const transactionLevelTotalProcessed = transactionLevelTotalApproved + transactionLevelTotalDeclined
  const transactionLevelWeightedSuccessRate =
    transactionLevelTotalProcessed > 0 ? (transactionLevelTotalApproved / transactionLevelTotalProcessed) * 100 : 0

  return {
    transactionJourneys,
    pspLevelMetrics: {
      pspStats,
      totalApprovedTransactions,
      totalUniqueDeclinedTransactions,
      totalProcessedTransactions,
      weightedSuccessRate,
    },
    transactionLevelMetrics: {
      countryBreakdown,
      totalApprovedTransactions: transactionLevelTotalApproved,
      totalUniqueDeclinedTransactions: transactionLevelTotalDeclined,
      totalProcessedTransactions: transactionLevelTotalProcessed,
      weightedSuccessRate: transactionLevelWeightedSuccessRate,
    },
  }
}

export function recalculateWithPSPExclusions(
  results: ImprovedAnalysisResults,
  excludedPSPs: string[],
): {
  totalApprovedTransactions: number
  totalUniqueDeclinedTransactions: number
  totalProcessedTransactions: number
  weightedSuccessRate: number
} {
  if (excludedPSPs.length === 0) {
    return {
      totalApprovedTransactions: results.transactionLevelMetrics.totalApprovedTransactions,
      totalUniqueDeclinedTransactions: results.transactionLevelMetrics.totalUniqueDeclinedTransactions,
      totalProcessedTransactions: results.transactionLevelMetrics.totalProcessedTransactions,
      weightedSuccessRate: results.transactionLevelMetrics.weightedSuccessRate,
    }
  }

  // Filter out journeys that only involved excluded PSPs
  const filteredJourneys = Object.values(results.transactionJourneys).filter((journey) => {
    // Keep journey if it has at least one non-excluded PSP
    return journey.pspsInvolved.some((psp) => !excludedPSPs.includes(psp))
  })

  // Recalculate metrics for filtered journeys
  let totalApproved = 0
  let totalDeclined = 0

  filteredJourneys.forEach((journey) => {
    // Check if any non-excluded PSP approved this journey
    const approvedByNonExcludedPSP = journey.attempts.some((attempt) => {
      return (
        !excludedPSPs.includes(attempt.pspName) &&
        (attempt.status.toLowerCase().includes("approved") || attempt.status.toLowerCase().includes("success"))
      )
    })

    if (approvedByNonExcludedPSP) {
      totalApproved++
    } else {
      // Check if any non-excluded PSP was involved (and declined)
      const nonExcludedPSPInvolved = journey.attempts.some((attempt) => !excludedPSPs.includes(attempt.pspName))

      if (nonExcludedPSPInvolved) {
        totalDeclined++
      }
    }
  })

  const totalProcessed = totalApproved + totalDeclined
  const weightedSuccessRate = totalProcessed > 0 ? (totalApproved / totalProcessed) * 100 : 0

  return {
    totalApprovedTransactions: totalApproved,
    totalUniqueDeclinedTransactions: totalDeclined,
    totalProcessedTransactions: totalProcessed,
    weightedSuccessRate,
  }
}
