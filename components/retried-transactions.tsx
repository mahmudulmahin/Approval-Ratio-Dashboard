"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface RetriedTransaction {
  merchantOrderId: string
  pspName: string
  attempts: number
  finalStatus: string
  country: string
}

interface CrossPSPFlow {
  merchantOrderId: string
  approvedBy: string
  declinedBy: string[]
  country: string
  amount?: number
  currency?: string
}

interface RetriedTransactionsProps {
  retriedTransactions: RetriedTransaction[]
  crossPSPFlows: CrossPSPFlow[]
}

export function RetriedTransactions({ retriedTransactions, crossPSPFlows }: RetriedTransactionsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>("all")
  const [selectedPSP, setSelectedPSP] = useState<string>("all")

  // Get unique countries and PSPs
  const countries = useMemo(() => {
    const countrySet = new Set<string>()
    retriedTransactions.forEach((tx) => countrySet.add(tx.country))
    crossPSPFlows.forEach((flow) => countrySet.add(flow.country))
    return Array.from(countrySet).sort()
  }, [retriedTransactions, crossPSPFlows])

  const psps = useMemo(() => {
    const pspSet = new Set<string>()
    retriedTransactions.forEach((tx) => pspSet.add(tx.pspName))
    crossPSPFlows.forEach((flow) => {
      pspSet.add(flow.approvedBy)
      flow.declinedBy.forEach((psp) => pspSet.add(psp))
    })
    return Array.from(pspSet).sort()
  }, [retriedTransactions, crossPSPFlows])

  // Filter retried transactions
  const filteredRetries = useMemo(() => {
    return retriedTransactions.filter((tx) => {
      const matchesSearch =
        tx.merchantOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.pspName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCountry = selectedCountry === "all" || tx.country === selectedCountry
      const matchesPSP = selectedPSP === "all" || tx.pspName === selectedPSP

      return matchesSearch && matchesCountry && matchesPSP
    })
  }, [retriedTransactions, searchTerm, selectedCountry, selectedPSP])

  // Filter cross-PSP flows
  const filteredFlows = useMemo(() => {
    return crossPSPFlows.filter((flow) => {
      const matchesSearch =
        flow.merchantOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        flow.approvedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        flow.declinedBy.some((psp) => psp.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCountry = selectedCountry === "all" || flow.country === selectedCountry
      const matchesPSP =
        selectedPSP === "all" || flow.approvedBy === selectedPSP || flow.declinedBy.includes(selectedPSP)

      return matchesSearch && matchesCountry && matchesPSP
    })
  }, [crossPSPFlows, searchTerm, selectedCountry, selectedPSP])

  // PSP-wise Cross-PSP Flow Analysis
  const pspFlowAnalysis = useMemo(() => {
    const analysis: Record<
      string,
      {
        pspName: string
        timesDeclined: number
        timesApproved: number
        totalInvolved: number
        declineRate: number
        approvalRate: number
        countries: Set<string>
        mostCommonDeclinedBy: Record<string, number>
        mostCommonApprovedAfter: Record<string, number>
        successAsBackup: number
        failureAsBackup: number
        backupSuccessRate: number
      }
    > = {}

    // Initialize analysis for all PSPs
    const allPSPs = new Set<string>()
    filteredFlows.forEach((flow) => {
      allPSPs.add(flow.approvedBy)
      flow.declinedBy.forEach((psp) => allPSPs.add(psp))
    })

    allPSPs.forEach((psp) => {
      analysis[psp] = {
        pspName: psp,
        timesDeclined: 0,
        timesApproved: 0,
        totalInvolved: 0,
        declineRate: 0,
        approvalRate: 0,
        countries: new Set(),
        mostCommonDeclinedBy: {},
        mostCommonApprovedAfter: {},
        successAsBackup: 0,
        failureAsBackup: 0,
        backupSuccessRate: 0,
      }
    })

    // Analyze flows
    filteredFlows.forEach((flow) => {
      // Track countries
      analysis[flow.approvedBy].countries.add(flow.country)
      flow.declinedBy.forEach((psp) => {
        analysis[psp].countries.add(flow.country)
      })

      // Approved PSP analysis (this PSP succeeded as backup)
      analysis[flow.approvedBy].timesApproved++
      analysis[flow.approvedBy].totalInvolved++
      analysis[flow.approvedBy].successAsBackup++

      // Track what PSPs this one commonly approves after
      flow.declinedBy.forEach((declinedPsp) => {
        if (!analysis[flow.approvedBy].mostCommonApprovedAfter[declinedPsp]) {
          analysis[flow.approvedBy].mostCommonApprovedAfter[declinedPsp] = 0
        }
        analysis[flow.approvedBy].mostCommonApprovedAfter[declinedPsp]++
      })

      // Declined PSPs analysis
      flow.declinedBy.forEach((psp) => {
        analysis[psp].timesDeclined++
        analysis[psp].totalInvolved++
        analysis[psp].failureAsBackup++

        // Track what PSP commonly approves after this one declines
        if (!analysis[psp].mostCommonDeclinedBy[flow.approvedBy]) {
          analysis[psp].mostCommonDeclinedBy[flow.approvedBy] = 0
        }
        analysis[psp].mostCommonDeclinedBy[flow.approvedBy]++
      })
    })

    // Calculate rates
    Object.values(analysis).forEach((pspData) => {
      if (pspData.totalInvolved > 0) {
        pspData.declineRate = (pspData.timesDeclined / pspData.totalInvolved) * 100
        pspData.approvalRate = (pspData.timesApproved / pspData.totalInvolved) * 100
      }

      const totalBackupAttempts = pspData.successAsBackup + pspData.failureAsBackup
      if (totalBackupAttempts > 0) {
        pspData.backupSuccessRate = (pspData.successAsBackup / totalBackupAttempts) * 100
      }
    })

    return Object.values(analysis)
      .filter((psp) => psp.totalInvolved > 0)
      .sort((a, b) => b.totalInvolved - a.totalInvolved)
  }, [filteredFlows])

  // PSP Routing Patterns Analysis
  const routingPatterns = useMemo(() => {
    const patterns: Record<string, { count: number; successRate: number; countries: Set<string> }> = {}

    filteredFlows.forEach((flow) => {
      const pattern = `${flow.declinedBy.sort().join(" → ")} → ${flow.approvedBy}`
      if (!patterns[pattern]) {
        patterns[pattern] = { count: 0, successRate: 100, countries: new Set() }
      }
      patterns[pattern].count++
      patterns[pattern].countries.add(flow.country)
    })

    return Object.entries(patterns)
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        countries: data.countries.size,
        frequency: (data.count / filteredFlows.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filteredFlows])

  // PSP Reliability Analysis
  const reliabilityAnalysis = useMemo(() => {
    const reliability: Record<
      string,
      {
        psp: string
        consistencyScore: number
        countryReliability: Record<string, { success: number; total: number; rate: number }>
        overallReliability: number
      }
    > = {}

    // Initialize
    pspFlowAnalysis.forEach((psp) => {
      reliability[psp.pspName] = {
        psp: psp.pspName,
        consistencyScore: 0,
        countryReliability: {},
        overallReliability: 0,
      }
    })

    // Analyze by country
    filteredFlows.forEach((flow) => {
      // Approved PSP (successful rescue)
      if (!reliability[flow.approvedBy].countryReliability[flow.country]) {
        reliability[flow.approvedBy].countryReliability[flow.country] = { success: 0, total: 0, rate: 0 }
      }
      reliability[flow.approvedBy].countryReliability[flow.country].success++
      reliability[flow.approvedBy].countryReliability[flow.country].total++

      // Declined PSPs (failed rescue attempts)
      flow.declinedBy.forEach((psp) => {
        if (!reliability[psp].countryReliability[flow.country]) {
          reliability[psp].countryReliability[flow.country] = { success: 0, total: 0, rate: 0 }
        }
        reliability[psp].countryReliability[flow.country].total++
      })
    })

    // Calculate rates and consistency
    Object.values(reliability).forEach((data) => {
      const countryRates: number[] = []
      Object.values(data.countryReliability).forEach((country) => {
        country.rate = country.total > 0 ? (country.success / country.total) * 100 : 0
        countryRates.push(country.rate)
      })

      // Overall reliability (average success rate across all countries)
      data.overallReliability =
        countryRates.length > 0 ? countryRates.reduce((sum, rate) => sum + rate, 0) / countryRates.length : 0

      // Consistency score (100 minus standard deviation - higher score = more consistent)
      if (countryRates.length > 1) {
        const mean = data.overallReliability
        const variance = countryRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / countryRates.length
        const stdDev = Math.sqrt(variance)
        data.consistencyScore = Math.max(0, 100 - stdDev) // Higher score = more consistent
      } else {
        data.consistencyScore = data.overallReliability
      }
    })

    return Object.values(reliability)
      .filter((data) => Object.keys(data.countryReliability).length > 0)
      .sort((a, b) => b.overallReliability - a.overallReliability)
  }, [pspFlowAnalysis, filteredFlows])

  // Prepare chart data for retry analysis
  const retryChartData = useMemo(() => {
    const attemptCounts: Record<number, number> = {}
    filteredRetries.forEach((tx) => {
      attemptCounts[tx.attempts] = (attemptCounts[tx.attempts] || 0) + 1
    })

    return Object.entries(attemptCounts)
      .map(([attempts, count]) => ({
        attempts: `${attempts} attempts`,
        count,
        attemptsNum: Number.parseInt(attempts),
      }))
      .sort((a, b) => a.attemptsNum - b.attemptsNum)
  }, [filteredRetries])

  // Calculate summary statistics
  const retryStats = useMemo(() => {
    const totalRetries = filteredRetries.length
    const successfulRetries = filteredRetries.filter((tx) => tx.finalStatus === "approved").length
    const avgAttempts = totalRetries > 0 ? filteredRetries.reduce((sum, tx) => sum + tx.attempts, 0) / totalRetries : 0

    return {
      totalRetries,
      successfulRetries,
      successRate: totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0,
      avgAttempts: avgAttempts.toFixed(1),
    }
  }, [filteredRetries])

  const flowStats = useMemo(() => {
    const totalFlows = filteredFlows.length
    const uniquePSPPairs = new Set(
      filteredFlows.map((flow) => `${flow.declinedBy.sort().join(",")}→${flow.approvedBy}`),
    ).size

    return {
      totalFlows,
      uniquePSPPairs,
    }
  }, [filteredFlows])

  return (
    <div className="space-y-8">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Retried Transactions Analysis</CardTitle>
          <CardDescription>Analyze transactions that were retried and cross-PSP flows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by order ID or PSP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPSP} onValueChange={setSelectedPSP}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select PSP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PSPs</SelectItem>
                {psps.map((psp) => (
                  <SelectItem key={psp} value={psp}>
                    {psp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="retries" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="retries">Retry Analysis</TabsTrigger>
          <TabsTrigger value="flows">Cross-PSP Flows</TabsTrigger>
        </TabsList>

        <TabsContent value="retries" className="space-y-6">
          {/* Retry Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{retryStats.totalRetries}</div>
                <p className="text-xs text-muted-foreground">Total Retries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{retryStats.successfulRetries}</div>
                <p className="text-xs text-muted-foreground">Successful Retries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{retryStats.successRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Retry Success Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{retryStats.avgAttempts}</div>
                <p className="text-xs text-muted-foreground">Avg Attempts</p>
              </CardContent>
            </Card>
          </div>

          {/* Retry Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Retry Details</CardTitle>
              <CardDescription>Individual transactions that were retried</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>PSP</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead>Final Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRetries.slice(0, 100).map((tx, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{tx.merchantOrderId}</TableCell>
                        <TableCell>{tx.pspName}</TableCell>
                        <TableCell>{tx.country}</TableCell>
                        <TableCell className="text-right">{tx.attempts}</TableCell>
                        <TableCell>
                          <Badge variant={tx.finalStatus === "approved" ? "success" : "destructive"}>
                            {tx.finalStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredRetries.length > 100 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing first 100 of {filteredRetries.length} retried transactions
                </p>
              )}
            </CardContent>
          </Card>

          {/* Retry Attempts Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Retry Attempts Distribution</CardTitle>
              <CardDescription>Distribution of retry attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={retryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="attempts" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Number of Transactions" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flows" className="space-y-6">
          {/* Flow Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{flowStats.totalFlows}</div>
                <p className="text-xs text-muted-foreground">Total Cross-PSP Flows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{flowStats.uniquePSPPairs}</div>
                <p className="text-xs text-muted-foreground">Unique PSP Flow Patterns</p>
              </CardContent>
            </Card>
          </div>

          {/* PSP Flow Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle>PSP Cross-Flow Performance Analysis</CardTitle>
              <CardDescription>How each PSP performs in cross-PSP transaction flows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PSP</TableHead>
                      <TableHead className="text-right">Total Involved</TableHead>
                      <TableHead className="text-right">Times Declined</TableHead>
                      <TableHead className="text-right">Times Approved</TableHead>
                      <TableHead className="text-right">Decline Rate</TableHead>
                      <TableHead className="text-right">Approval Rate</TableHead>
                      <TableHead className="text-right">Countries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pspFlowAnalysis.slice(0, 20).map((psp, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{psp.pspName}</TableCell>
                        <TableCell className="text-right">{psp.totalInvolved}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-red-600">{psp.timesDeclined}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600">{psp.timesApproved}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={psp.declineRate > 50 ? "destructive" : "secondary"}>
                            {psp.declineRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={psp.approvalRate > 50 ? "success" : "secondary"}>
                            {psp.approvalRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{psp.countries.size}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pspFlowAnalysis.length > 20 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing top 20 of {pspFlowAnalysis.length} PSPs by involvement
                </p>
              )}
            </CardContent>
          </Card>

          {/* PSP Routing Patterns Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Most Common PSP Routing Patterns</CardTitle>
              <CardDescription>
                Percentage of cross-PSP flows that follow each routing sequence (PSP declines → PSP approves)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Routing Pattern</TableHead>
                      <TableHead className="text-right">Rescue Success %</TableHead>
                      <TableHead className="text-right">Flow Count</TableHead>
                      <TableHead className="text-right">Countries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routingPatterns.map((pattern, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm max-w-md">
                          <div className="truncate" title={pattern.pattern}>
                            {pattern.pattern}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{pattern.frequency.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">{pattern.count}</TableCell>
                        <TableCell className="text-right">{pattern.countries}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>How to read:</strong> "Innatech → Axcess" at 20.0% means that out of all cross-PSP flows, 20%
                  follow this pattern where Innatech declines first, then Axcess successfully rescues the transaction.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PSP Reliability Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>PSP Reliability & Consistency Analysis</CardTitle>
              <CardDescription>PSP backup/rescue performance consistency across different countries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PSP</TableHead>
                      <TableHead className="text-right">Overall Reliability</TableHead>
                      <TableHead className="text-right">Consistency Score</TableHead>
                      <TableHead className="text-right">Active Countries</TableHead>
                      <TableHead>Performance Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reliabilityAnalysis.slice(0, 15).map((data, index) => {
                      const bestCountry = Object.entries(data.countryReliability).sort(
                        ([, a], [, b]) => b.rate - a.rate,
                      )[0]
                      const worstCountry = Object.entries(data.countryReliability).sort(
                        ([, a], [, b]) => a.rate - b.rate,
                      )[0]

                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{data.psp}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                data.overallReliability > 70
                                  ? "success"
                                  : data.overallReliability > 40
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {data.overallReliability.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                data.consistencyScore > 80
                                  ? "success"
                                  : data.consistencyScore > 60
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {data.consistencyScore.toFixed(0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{Object.keys(data.countryReliability).length}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs">
                            {bestCountry && worstCountry && bestCountry[0] !== worstCountry[0] ? (
                              <div>
                                <div>
                                  Best: {bestCountry[0]} ({bestCountry[1].rate.toFixed(0)}%)
                                </div>
                                <div>
                                  Worst: {worstCountry[0]} ({worstCountry[1].rate.toFixed(0)}%)
                                </div>
                              </div>
                            ) : (
                              <div>Consistent performance across countries</div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Explanation Box for Reliability Metrics */}
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Understanding Reliability Metrics:</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <div>
                    <strong>Overall Reliability:</strong> Average success rate when PSP is used as backup across all
                    countries
                  </div>
                  <div>
                    <strong>Consistency Score:</strong> How consistent performance is across countries (100 = perfectly
                    consistent, lower = more variable)
                  </div>
                  <div>
                    <strong>Performance Notes:</strong> Best and worst performing countries for geographic optimization
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PSP Flow Insights */}
          <Card>
            <CardHeader>
              <CardTitle>PSP Flow Strategic Insights</CardTitle>
              <CardDescription>Key insights and recommendations from cross-PSP transaction flows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pspFlowAnalysis.slice(0, 6).map((psp, index) => {
                  const topDeclinedBy = Object.entries(psp.mostCommonDeclinedBy).sort(([, a], [, b]) => b - a)[0]
                  const topApprovedAfter = Object.entries(psp.mostCommonApprovedAfter).sort(([, a], [, b]) => b - a)[0]

                  return (
                    <Card key={index} className="p-4">
                      <h4 className="font-semibold text-lg mb-3">{psp.pspName}</h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Primary Role: </span>
                          <Badge variant={psp.approvalRate > 50 ? "success" : "destructive"}>
                            {psp.approvalRate > 70
                              ? "Backup Specialist"
                              : psp.declineRate > 70
                                ? "Primary Filter"
                                : "Mixed Role"}
                          </Badge>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Backup Success Rate: </span>
                          <span className="font-medium text-green-600">{psp.backupSuccessRate.toFixed(1)}%</span>
                        </div>

                        {topDeclinedBy && (
                          <div>
                            <span className="text-muted-foreground">Most often rescues: </span>
                            <span className="font-medium">
                              {topDeclinedBy[0]} ({topDeclinedBy[1]} times)
                            </span>
                          </div>
                        )}

                        {topApprovedAfter && (
                          <div>
                            <span className="text-muted-foreground">Often rescued by: </span>
                            <span className="font-medium">
                              {topApprovedAfter[0]} ({topApprovedAfter[1]} times)
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-muted-foreground">Geographic Reach: </span>
                          <span className="font-medium">{psp.countries.size} countries</span>
                        </div>

                        <div className="pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            {psp.approvalRate > 80
                              ? "Excellent backup option"
                              : psp.declineRate > 80
                                ? "Strong primary filter"
                                : "Balanced performance"}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
