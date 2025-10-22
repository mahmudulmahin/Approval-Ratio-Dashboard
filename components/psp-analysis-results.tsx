"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import type { PSPAnalysis, Transaction } from "@/lib/types"
import { improvedAnalyzeData, recalculateWithPSPExclusions } from "@/lib/improved-analyzer"

interface PSPAnalysisResultsProps {
  results: PSPAnalysis
  transactions?: Transaction[] // Add transactions prop for improved summary calculation
}

export function PSPAnalysisResults({ results, transactions = [] }: PSPAnalysisResultsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [excludedPSPs, setExcludedPSPs] = useState<string[]>([])

  // Use improved analysis ONLY for the summary calculation
  const improvedResults = useMemo(() => {
    if (transactions.length > 0) {
      return improvedAnalyzeData(transactions)
    }
    return null
  }, [transactions])

  // Convert PSP analysis object to array for table display and filtering
  const pspArray = Object.entries(results).map(([pspName, stats]) => ({
    pspName,
    ...stats,
  }))

  // Filter PSPs based on search term
  const filteredPSPs = pspArray.filter((psp) => psp.pspName.toLowerCase().includes(searchTerm.toLowerCase()))

  // Sort PSPs by approval ratio (descending)
  const sortedPSPs = [...filteredPSPs].sort(
    (a, b) => Number.parseFloat(b.approvalRatio.toString()) - Number.parseFloat(a.approvalRatio.toString()),
  )

  // Calculate SUMMARY metrics using improved method, but keep PSP table using basic method
  const summaryMetrics = useMemo(() => {
    if (improvedResults) {
      // Use the improved calculation method for summary only
      return recalculateWithPSPExclusions(improvedResults, excludedPSPs)
    } else {
      // Fall back to basic calculation for summary
      const includedPSPs = pspArray.filter((psp) => !excludedPSPs.includes(psp.pspName))

      if (includedPSPs.length === 0) {
        return {
          totalApprovedTransactions: 0,
          totalUniqueDeclinedTransactions: 0,
          totalProcessedTransactions: 0,
          weightedSuccessRate: 0,
        }
      }

      const totalApproved = includedPSPs.reduce((sum, psp) => sum + psp.approved, 0)
      const totalDeclined = includedPSPs.reduce((sum, psp) => sum + psp.declined, 0)
      const totalProcessed = totalApproved + totalDeclined
      const weightedSuccessRate = totalProcessed > 0 ? (totalApproved / totalProcessed) * 100 : 0

      return {
        totalApprovedTransactions: totalApproved,
        totalUniqueDeclinedTransactions: totalDeclined,
        totalProcessedTransactions: totalProcessed,
        weightedSuccessRate,
      }
    }
  }, [improvedResults, excludedPSPs, pspArray])

  // Add PSP to exclusion list
  const addToExcluded = (pspName: string) => {
    if (!excludedPSPs.includes(pspName)) {
      setExcludedPSPs([...excludedPSPs, pspName])
    }
  }

  // Remove PSP from exclusion list
  const removeFromExcluded = (pspName: string) => {
    setExcludedPSPs(excludedPSPs.filter((psp) => psp !== pspName))
  }

  // Clear all exclusions
  const clearExclusions = () => {
    setExcludedPSPs([])
  }

  // Prepare data for charts (excluding selected PSPs) - using basic PSP data
  const chartData = sortedPSPs
    .filter((psp) => !excludedPSPs.includes(psp.pspName))
    .map((psp) => ({
      name: psp.pspName,
      approvalRate: Number.parseFloat(psp.approvalRatio.toString()),
      declineRate: Number.parseFloat(psp.declineRatio.toString()),
      total: psp.total,
    }))

  return (
    <div className="space-y-8">
      {/* Summary Card with Improved Calculation */}
      <Card>
        <CardHeader>
          <CardTitle>Corrected Weighted Approval Ratio</CardTitle>
          <CardDescription>
            Formula: Total Approved Transactions ÷ (Total Approved + Total Unique Declined) × 100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Excluded PSPs Display */}
            {excludedPSPs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Excluded PSPs:</h4>
                <div className="flex flex-wrap gap-2">
                  {excludedPSPs.map((psp) => (
                    <Badge key={psp} variant="destructive" className="flex items-center gap-1">
                      {psp}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => removeFromExcluded(psp)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" onClick={clearExclusions}>
                    Clear All
                  </Button>
                </div>
              </div>
            )}

            {/* Summary Metrics using Improved Method */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Processed</p>
                <p className="text-2xl font-bold">{summaryMetrics.totalProcessedTransactions.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryMetrics.totalApprovedTransactions.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Unique Declined</p>
                <p className="text-2xl font-bold text-red-600">
                  {summaryMetrics.totalUniqueDeclinedTransactions.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Weighted Approval Rate</p>
                <p className="text-2xl font-bold text-green-600">{summaryMetrics.weightedSuccessRate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Calculation Formula */}
            <div className="text-xs text-muted-foreground p-3 bg-blue-50 rounded">
              <p className="font-medium mb-1">Your Exact Formula:</p>
              <p>
                • <strong>Total Approved</strong>: All approved transactions
              </p>
              <p>
                • <strong>Unique Declined</strong>: Declined transactions that were NEVER approved by any PSP
              </p>
              <p>
                • <strong>Formula</strong>: Approved ÷ (Approved + Unique Declined) × 100
              </p>
              <p>
                • <strong>PSP Exclusion</strong>: Remove ALL transactions from excluded PSPs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main PSP Analysis Table - Keep using basic PSP results */}
      <Card>
        <CardHeader>
          <CardTitle>PSP Approval Ratios (Corrected Formula)</CardTitle>
          <CardDescription>
            Analysis of transaction approval rates using the corrected formula: Approved ÷ (Approved + Declined) × 100
            {excludedPSPs.length > 0 && ` (${excludedPSPs.length} PSP${excludedPSPs.length > 1 ? "s" : ""} excluded)`}
          </CardDescription>
          <div className="mt-2">
            <Input
              placeholder="Search PSPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PSP Name</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Declined</TableHead>
                  <TableHead className="text-right">Filtered</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Approval %</TableHead>
                  <TableHead className="text-right">Decline %</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPSPs.map((psp) => {
                  const isExcluded = excludedPSPs.includes(psp.pspName)
                  return (
                    <TableRow key={psp.pspName} className={isExcluded ? "opacity-50 bg-red-50" : ""}>
                      <TableCell className="font-medium">{psp.pspName}</TableCell>
                      <TableCell className="text-right">{psp.total}</TableCell>
                      <TableCell className="text-right">{psp.approved}</TableCell>
                      <TableCell className="text-right">{psp.declined}</TableCell>
                      <TableCell className="text-right">{psp.filtered}</TableCell>
                      <TableCell className="text-right">{psp.other}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{psp.approvalRatio}%</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{psp.declineRatio}%</TableCell>
                      <TableCell className="text-center">
                        {isExcluded ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeFromExcluded(psp.pspName)}
                            className="text-green-600 hover:text-green-700"
                          >
                            Include
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addToExcluded(psp.pspName)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Exclude
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {sortedPSPs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      No PSPs found matching your search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="approval-rates" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="approval-rates">Approval Rates</TabsTrigger>
          <TabsTrigger value="transaction-volume">Transaction Volume</TabsTrigger>
        </TabsList>

        <TabsContent value="approval-rates">
          <Card>
            <CardHeader>
              <CardTitle>PSP Approval Rates Visualization (Corrected Formula)</CardTitle>
              <CardDescription>
                Graphical representation of approval and decline rates by PSP using corrected formula
                {excludedPSPs.length > 0 && ` (excluding ${excludedPSPs.join(", ")})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 70,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                    <YAxis label={{ value: "Percentage (%)", angle: -90, position: "insideLeft" }} />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="approvalRate" name="Approval Rate" fill="#10b981" />
                    <Bar dataKey="declineRate" name="Decline Rate" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transaction-volume">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Volume by PSP</CardTitle>
              <CardDescription>
                Distribution of transaction volume across PSPs
                {excludedPSPs.length > 0 && ` (excluding ${excludedPSPs.join(", ")})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 70,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                    <YAxis label={{ value: "Number of Transactions", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total Transactions" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
