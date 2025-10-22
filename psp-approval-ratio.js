// Function to calculate PSP approval ratios from the transaction data
function calculatePSPApprovalRatios(data) {
  // Create an object to store counts for each PSP
  const pspStats = {};
  
  // Process each transaction
  data.forEach(transaction => {
    const pspName = transaction.pspName;
    
    // Initialize PSP stats if not already done
    if (!pspStats[pspName]) {
      pspStats[pspName] = {
        total: 0,
        approved: 0,
        declined: 0,
        filtered: 0,
        other: 0
      };
    }
    
    // Increment total count
    pspStats[pspName].total++;
    
    // Check status and increment appropriate counter
    const status = transaction.status?.toLowerCase() || '';
    
    if (status.includes('approved')) {
      pspStats[pspName].approved++;
    } else if (status.includes('declined')) {
      pspStats[pspName].declined++;
    } else if (status.includes('filtered')) {
      pspStats[pspName].filtered++;
    } else {
      pspStats[pspName].other++;
    }
  });
  
  // Calculate approval ratios
  const approvalRatios = {};
  
  for (const [psp, stats] of Object.entries(pspStats)) {
    approvalRatios[psp] = {
      ...stats,
      approvalRatio: stats.total > 0 ? (stats.approved / stats.total * 100).toFixed(2) + '%' : '0%',
      declineRatio: stats.total > 0 ? (stats.declined / stats.total * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  return approvalRatios;
}

// Sample data from the provided image
const transactionData = [
  { pspName: 'SafeCharge', status: 'credit_card_in_process' },
  { pspName: 'Paysafe', status: 'credit_card_declined' },
  { pspName: 'Paysafe', status: 'credit_card_approved' },
  { pspName: 'Paysafe', status: 'credit_card_approved' },
  { pspName: 'Paysafe', status: 'credit_card_approved' },
  { pspName: 'TrustPayments', status: 'credit_card_approved' },
  { pspName: 'TrustPayments', status: 'credit_card_approved' },
  { pspName: 'CardPay', status: 'credit_card_filtered_by' },
  { pspName: 'CardPay', status: 'credit_card_filtered_by' },
  { pspName: 'PayPal', status: 'apm_declined' },
  { pspName: 'TrustPayments', status: 'credit_card_approved' },
  { pspName: 'SafeCharge', status: 'credit_card_in_process' },
  { pspName: 'SafeCharge', status: 'credit_card_approved' },
  { pspName: 'Paysafe', status: 'credit_card_declined' },
  { pspName: 'PayPal', status: 'apm_approved' },
  { pspName: 'SafeCharge', status: 'credit_card_approved' },
  { pspName: 'Paysafe', status: 'credit_card_declined' },
  { pspName: 'Paysafe', status: 'credit_card_approved' }
];

// Calculate and display PSP approval ratios
const approvalRatios = calculatePSPApprovalRatios(transactionData);

// Format the output for better readability
console.log("PSP Approval Ratios Analysis\n");
console.log("PSP Name".padEnd(15), "Total".padEnd(8), "Approved".padEnd(10), "Declined".padEnd(10), 
            "Filtered".padEnd(10), "Other".padEnd(8), "Approval %".padEnd(12), "Decline %");
console.log("-".repeat(80));

Object.entries(approvalRatios).forEach(([psp, stats]) => {
  console.log(
    psp.padEnd(15),
    stats.total.toString().padEnd(8),
    stats.approved.toString().padEnd(10),
    stats.declined.toString().padEnd(10),
    stats.filtered.toString().padEnd(10),
    stats.other.toString().padEnd(8),
    stats.approvalRatio.padEnd(12),
    stats.declineRatio
  );
});

// Additional insights
console.log("\nInsights:");
const pspEntries = Object.entries(approvalRatios);
const bestPSP = pspEntries.reduce((best, [psp, stats]) => {
  const currentRatio = parseFloat(stats.approvalRatio);
  const bestRatio = best ? parseFloat(best[1].approvalRatio) : 0;
  return currentRatio > bestRatio && stats.total > 0 ? [psp, stats] : best;
}, null);

const worstPSP = pspEntries.reduce((worst, [psp, stats]) => {
  const currentRatio = parseFloat(stats.approvalRatio);
  const worstRatio = worst ? parseFloat(worst[1].approvalRatio) : 100;
  return currentRatio < worstRatio && stats.total > 0 ? [psp, stats] : worst;
}, null);

if (bestPSP) {
  console.log(`- Best performing PSP: ${bestPSP[0]} with ${bestPSP[1].approvalRatio} approval rate`);
}
if (worstPSP) {
  console.log(`- Worst performing PSP: ${worstPSP[0]} with ${worstPSP[1].approvalRatio} approval rate`);
}
