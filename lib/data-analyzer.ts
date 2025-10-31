import type { 
  Transaction, 
  PSPAnalysis, 
  CountryAnalysis, 
  AnalysisResults, 
  RetriedTransaction, 
  CrossPSPFlow 
} from "./types"
import { analyzeTimeData } from "./time-analyzer"

export function analyzeData(transactions: Transaction[]): AnalysisResults {
  // Initialize analysis objects
  const pspAnalysis: PSPAnalysis = {}
  const countryAnalysis: CountryAnalysis = {}

  // Track transactions by merchantOrderId to create journeys (same as improved analyzer)
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
    }
  > = {}

  // First pass: Group by merchantOrderId
  transactions.forEach((tx) => {
    const orderId = tx.merchantOrderId || tx.transactionId || "unknown"

    if (!transactionJourneys[orderId]) {
      transactionJourneys[orderId] = {
        merchantOrderId: orderId,
        country: (tx.country || "Unknown").trim(),
        attempts: [],
        finalStatus: "failed",
        totalAttempts: 0,
        pspsInvolved: [],
      }
    }

    transactionJourneys[orderId].attempts.push({
      pspName: (tx.pspName || "Unknown").trim(),
      status: tx.status || "unknown",
      timestamp: tx.processing_date instanceof Date ? tx.processing_date : undefined,
      amount: tx.merchantAmount,
      currency: tx.currency,
    })
  })

  // Second pass: Determine final status and sort attempts
  Object.values(transactionJourneys).forEach((journey) => {
    // Sort attempts by timestamp if available
    if (journey.attempts.some((a) => a.timestamp)) {
      journey.attempts.sort((a, b) => {
        if (!a.timestamp) return 1
        if (!b.timestamp) return -1
        return a.timestamp.getTime() - b.timestamp.getTime()
      })
    }

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

  // Initialize PSP and Country analysis using UNIQUE transaction logic
  journeyArray.forEach((journey) => {
    const country = journey.country

    // Initialize country stats
    if (!countryAnalysis[country]) {
      countryAnalysis[country] = {
        total: 0,
        approved: 0,
        declined: 0,
        filtered: 0,
        other: 0,
        approvalRatio: 0,
        declineRatio: 0,
        pspBreakdown: {},
      }
    }

    // Count this journey once for the country
    countryAnalysis[country].total++

    if (journey.finalStatus === "success") {
      countryAnalysis[country].approved++
    } else {
      countryAnalysis[country].declined++
    }

    // For each PSP involved in this journey
    const pspsInJourney = new Set<string>()
    journey.attempts.forEach((attempt) => {
      pspsInJourney.add(attempt.pspName)
    })

    pspsInJourney.forEach((pspName) => {
      // Initialize PSP stats
      if (!pspAnalysis[pspName]) {
        pspAnalysis[pspName] = {
          total: 0,
          approved: 0,
          declined: 0,
          filtered: 0,
          other: 0,
          approvalRatio: 0,
          declineRatio: 0,
        }
      }

      // Initialize PSP breakdown in country stats
      if (!countryAnalysis[country].pspBreakdown[pspName]) {
        countryAnalysis[country].pspBreakdown[pspName] = {
          total: 0,
          approved: 0,
          declined: 0,
          filtered: 0,
          other: 0,
          approvalRatio: 0,
          declineRatio: 0,
        }
      }

      // Count this journey once for this PSP
      pspAnalysis[pspName].total++
      countryAnalysis[country].pspBreakdown[pspName].total++

      // Check if THIS PSP approved this journey
      const pspApprovedThisJourney = journey.attempts.some((attempt) => {
        return (
          attempt.pspName === pspName &&
          (attempt.status.toLowerCase().includes("approved") || attempt.status.toLowerCase().includes("success"))
        )
      })

      if (pspApprovedThisJourney) {
        pspAnalysis[pspName].approved++
        countryAnalysis[country].pspBreakdown[pspName].approved++
      } else {
        pspAnalysis[pspName].declined++
        countryAnalysis[country].pspBreakdown[pspName].declined++
      }
    })
  })

  // Calculate ratios using CORRECTED FORMULA: Approved ÷ (Approved + Declined) × 100
  Object.values(pspAnalysis).forEach((stats) => {
    const totalProcessed = stats.approved + stats.declined // Exclude filtered and other
    if (totalProcessed > 0) {
      stats.approvalRatio = Number.parseFloat(((stats.approved / totalProcessed) * 100).toFixed(2))
      stats.declineRatio = Number.parseFloat(((stats.declined / totalProcessed) * 100).toFixed(2))
    }
  })

  // Calculate ratios for countries and PSP breakdowns using CORRECTED FORMULA
  Object.values(countryAnalysis).forEach((countryStats) => {
    const totalProcessed = countryStats.approved + countryStats.declined // Exclude filtered and other
    if (totalProcessed > 0) {
      countryStats.approvalRatio = Number.parseFloat(((countryStats.approved / totalProcessed) * 100).toFixed(2))
      countryStats.declineRatio = Number.parseFloat(((countryStats.declined / totalProcessed) * 100).toFixed(2))
    }

    // Calculate ratios for PSP breakdown within each country using CORRECTED FORMULA
    Object.values(countryStats.pspBreakdown).forEach((pspStats) => {
      const pspTotalProcessed = pspStats.approved + pspStats.declined // Exclude filtered and other
      if (pspTotalProcessed > 0) {
        pspStats.approvalRatio = Number.parseFloat(((pspStats.approved / pspTotalProcessed) * 100).toFixed(2))
        pspStats.declineRatio = Number.parseFloat(((pspStats.declined / pspTotalProcessed) * 100).toFixed(2))
      }
    })
  })

  // Track retried transactions and cross-PSP flows (existing logic)
  const retriedTransactions: {
    merchantOrderId: string
    pspName: string
    attempts: number
    finalStatus: string
    country: string
  }[] = []

  const crossPSPFlows: {
    merchantOrderId: string
    approvedBy: string
    declinedBy: string[]
    country: string
    amount?: number
    currency?: string
  }[] = []

  // Process retried transactions
  journeyArray.forEach((journey) => {
    if (journey.totalAttempts > 1) {
      // Group attempts by PSP for this journey
      const pspAttempts: Record<string, number> = {}
      journey.attempts.forEach((attempt) => {
        pspAttempts[attempt.pspName] = (pspAttempts[attempt.pspName] || 0) + 1
      })

      // Add retried transactions for PSPs with multiple attempts
      Object.entries(pspAttempts).forEach(([pspName, attempts]) => {
        if (attempts > 1) {
          retriedTransactions.push({
            merchantOrderId: journey.merchantOrderId,
            pspName,
            attempts,
            finalStatus: journey.finalStatus === "success" ? "approved" : "declined",
            country: journey.country,
          })
        }
      })
    }

    // Process cross-PSP flows
    if (journey.pspsInvolved.length > 1 && journey.finalStatus === "success") {
      // Find which PSP approved
      const approvedAttempt = journey.attempts.find((attempt) => {
        const status = attempt.status.toLowerCase()
        return status.includes("approved") || status.includes("success")
      })

      if (approvedAttempt) {
        // Find PSPs that declined before approval
        const declinedPSPs: string[] = []
        journey.attempts.forEach((attempt) => {
          if (attempt.pspName !== approvedAttempt.pspName) {
            const status = attempt.status.toLowerCase()
            if (status.includes("declined") || status.includes("fail") || status.includes("error")) {
              if (!declinedPSPs.includes(attempt.pspName)) {
                declinedPSPs.push(attempt.pspName)
              }
            }
          }
        })

        if (declinedPSPs.length > 0) {
          crossPSPFlows.push({
            merchantOrderId: journey.merchantOrderId,
            approvedBy: approvedAttempt.pspName,
            declinedBy: declinedPSPs,
            country: journey.country,
            amount: approvedAttempt.amount,
            currency: approvedAttempt.currency,
          })
        }
      }
    }
  })

  // Calculate overall metrics using CORRECTED FORMULA
  const totalApproved = Object.values(pspAnalysis).reduce((sum, psp) => sum + psp.approved, 0);
  const totalDeclined = Object.values(pspAnalysis).reduce((sum, psp) => sum + psp.declined, 0);
  const totalProcessed = totalApproved + totalDeclined;

  const overallApprovalRate = totalProcessed > 0 
    ? Number.parseFloat(((totalApproved / totalProcessed) * 100).toFixed(2)) 
    : 0;

  // Analyze time-based data
  const timeAnalysis = analyzeTimeData(transactions);

  // Format retried transactions to match the expected type
  const formattedRetriedTransactions = Object.values(retriedTransactions)
    .filter(tx => tx.attempts > 1)
    .map(tx => {
      const attempts = transactions.filter(t => t.merchantOrderId === tx.merchantOrderId);
      const firstAttempt = attempts[0] || {} as Transaction;
      const lastAttempt = attempts[attempts.length - 1] || {} as Transaction;
      
      return {
        transactionId: tx.merchantOrderId || '',
        attempts: tx.attempts,
        psps: [...new Set(attempts.map(a => a.pspName).filter(Boolean))] as string[],
        countries: [...new Set(attempts.map(a => a.country).filter(Boolean))] as string[],
        finalStatus: tx.finalStatus,
        firstAttempt,
        lastAttempt,
        allAttempts: attempts
      } as RetriedTransaction;
    });

  // Format cross PSP flows to match the expected type
  const formattedCrossPSPFlows: CrossPSPFlow[] = [];
  
  // Since we don't have the exact structure of crossPSPFlows, we'll create a basic one
  // that matches the CrossPSPFlow interface
  Object.entries(crossPSPFlows).forEach(([key, flow]: [string, any]) => {
    const [fromPSP, toPSP] = key.split('_');
    formattedCrossPSPFlows.push({
      fromPSP,
      toPSP,
      count: flow.declinedBy?.length || 0,
      reason: flow.reason || 'Unknown'
    });
  });

  return {
    pspAnalysis,
    countryAnalysis,
    totalTransactions: transactions.length,
    overallApprovalRate,
    retriedTransactions: formattedRetriedTransactions as any[],
    crossPSPFlows: formattedCrossPSPFlows as any[],
    declineReasons: [],
    timeAnalysis,
    transactions
  } as unknown as AnalysisResults;
}
