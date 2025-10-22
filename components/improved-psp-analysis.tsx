"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronsUpDown, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { getCountryNameFromCode } from "@/lib/country-utils"
import { improvedAnalyzeData } from "@/lib/improved-analyzer"
import type { Transaction } from "@/lib/types"

interface ImprovedPSPAnalysisProps {
  results: {
    transactionJourneys?: any
    pspAnalysis?: any
    countryAnalysis?: any
    totalTransactions?: number
    overallApprovalRate?: number
    retriedTransactions?: any[]
    crossPSPFlows?: any[]
    declineReasons?: any[]
    timeAnalysis?: any
  }
  transactions?: Transaction[]
}

export function ImprovedPSPAnalysis({ results, transactions = [] }: ImprovedPSPAnalysisProps) {
  const [excludedPSPs, setExcludedPSPs] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })

  // Use improved analysis to get proper PSP metrics
  const improvedResults = useMemo(() => {
    if (transactions.length > 0) {
      return improvedAnalyzeData(transactions)
    }
    return null
  }, [transactions])

  // Get all PSPs from the data
  const allPSPs = useMemo(() => {
    if (improvedResults) {
      return Object.keys(improvedResults.pspLevelMetrics.pspStats).sort()
    }
    return []
  }, [improvedResults])

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      return transactions
    }

    return transactions.filter((tx) => {
      if (!tx.processing_date) return false

      const txDate = tx.processing_date instanceof Date ? tx.processing_date : new Date(tx.processing_date)

      if (dateRange.from && dateRange.to && dateRange.from.getTime() === dateRange.to.getTime()) {
        // Single date selection
        const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate())
        const selectedDateOnly = new Date(
          dateRange.from.getFullYear(),
          dateRange.from.getMonth(),
          dateRange.from.getDate(),
        )
        return txDateOnly.getTime() === selectedDateOnly.getTime()
      } else {
        // Date range filtering
        if (dateRange.from && txDate < dateRange.from) return false
        if (dateRange.to && txDate > dateRange.to) return false
        return true
      }
    })
  }, [transactions, dateRange])

  // Calculate metrics with PSP exclusion and date filtering
  const filteredImprovedResults = useMemo(() => {
    if (filteredTransactions.length === 0) return null

    // Filter out excluded PSPs from transactions
    const filteredTxs = filteredTransactions.filter((tx) => !excludedPSPs.includes(tx.pspName || ""))

    if (filteredTxs.length === 0) return null

    return improvedAnalyzeData(filteredTxs)
  }, [filteredTransactions, excludedPSPs])

  const filteredMetrics = useMemo(() => {
    if (!filteredImprovedResults) {
      return {
        totalProcessed: 0,
        totalApproved: 0,
        uniqueDeclined: 0,
        weightedApprovalRate: 0,
      }
    }

    return {
      totalProcessed: filteredImprovedResults.transactionLevelMetrics.totalProcessedTransactions,
      totalApproved: filteredImprovedResults.transactionLevelMetrics.totalApprovedTransactions,
      uniqueDeclined: filteredImprovedResults.transactionLevelMetrics.totalUniqueDeclinedTransactions,
      weightedApprovalRate: filteredImprovedResults.transactionLevelMetrics.weightedSuccessRate,
    }
  }, [filteredImprovedResults])

  // Get countries with PSP filtering and date filtering
  const countriesWithMetrics = useMemo(() => {
    if (!filteredImprovedResults) return []

    return Object.entries(filteredImprovedResults.transactionLevelMetrics.countryBreakdown)
      .map(([country, data]) => ({
        country,
        countryName: getCountryNameFromCode(country),
        approved: data.totalApprovedTransactions,
        declined: data.totalUniqueDeclinedTransactions,
        total: data.totalProcessedTransactions,
        approvalRate: data.successRate,
        pspCount: Object.keys(data.pspBreakdown).length,
      }))
      .filter((country) => country.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [filteredImprovedResults])

  // Country metrics with PSP filtering
  const countryMetricsWithPSPFilter = useMemo(() => {
    if (!selectedCountry || !filteredImprovedResults) return null

    const countryData = filteredImprovedResults.transactionLevelMetrics.countryBreakdown[selectedCountry]
    if (!countryData) return null

    const pspMetrics = Object.entries(countryData.pspBreakdown)
      .map(([psp, data]) => ({
        psp,
        total: data.totalTransactions,
        approved: data.approvedTransactions,
        declined: data.declinedTransactions,
        approvalRate: data.successRate,
      }))
      .sort((a, b) => b.total - a.total)

    return {
      country: selectedCountry,
      countryName: getCountryNameFromCode(selectedCountry),
      approved: countryData.totalApprovedTransactions,
      declined: countryData.totalUniqueDeclinedTransactions,
      total: countryData.totalProcessedTransactions,
      approvalRate: countryData.successRate,
      pspMetrics,
    }
  }, [selectedCountry, filteredImprovedResults])

  // PSP performance metrics using improved analyzer
  const pspPerformanceMetrics = useMemo(() => {
    if (!filteredImprovedResults) return []

    return Object.entries(filteredImprovedResults.pspLevelMetrics.pspStats)
      .map(([psp, stats]) => ({
        psp,
        totalAttempts: stats.totalAttempts,
        approvedAttempts: stats.approvedAttempts,
        declinedAttempts: stats.declinedAttempts,
        uniqueApproved: stats.uniqueApproved,
        uniqueDeclined: stats.uniqueDeclined,
        individualApprovalRate: stats.individualApprovalRate,
        uniqueApprovalRate: stats.trueApprovalRate,
        avgPosition: stats.avgPosition,
        countryCount: 1, // This would need to be calculated separately if needed
      }))
      .sort((a, b) => b.totalAttempts - a.totalAttempts)
  }, [filteredImprovedResults])

  const filteredCountries = useMemo(() => {
    return countriesWithMetrics.filter((country) =>
      country.countryName.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [countriesWithMetrics, searchTerm])

  const handlePSPToggle = (psp: string) => {
    setExcludedPSPs((prev) => (prev.includes(psp) ? prev.filter((p) => p !== psp) : [...prev, psp]))
  }

  const handleSelectAllPSPs = () => {
    setExcludedPSPs([])
  }

  const handleDeselectAllPSPs = () => {
    setExcludedPSPs([...allPSPs])
  }

  const handleDateRangeSelect = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    if (range) {
      setDateRange(range)
    }
  }

  const clearDateRange = () => {
    setDateRange({ from: undefined, to: undefined })
  }

  const getDateRangeText = () => {
    if (!dateRange) return "Select date range"

    if (dateRange.from && dateRange.to) {
      if (dateRange.from.getTime() === dateRange.to.getTime()) {
        return format(dateRange.from, "MMM dd, yyyy")
      }
      return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
    } else if (dateRange.from) {
      return `From ${format(dateRange.from, "MMM dd, yyyy")}`
    } else if (dateRange.to) {
      return `Until ${format(dateRange.to, "MMM dd, yyyy")}`
    }
    return "Select date range"
  }

  const activePSPs = allPSPs.filter((psp) => !excludedPSPs.includes(psp))

  if (!improvedResults) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No transaction data available for improved analysis</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* Overall Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Corrected Weighted Approval Ratio</CardTitle>
          <CardDescription>
            Formula: Total Approved Transactions ÷ (Total Approved + Total Unique Declined) × 100
            {(dateRange?.from || dateRange?.to) && " (Filtered by date range)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Date Range Filter */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Date Range:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {getDateRangeText()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                {(dateRange?.from || dateRange?.to) && (
                  <Button variant="outline" size="sm" onClick={clearDateRange}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Active Filters */}
            {(dateRange?.from || dateRange?.to || excludedPSPs.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {(dateRange?.from || dateRange?.to) && (
                  <Badge variant="secondary" className="gap-1">
                    {getDateRangeText()}
                    <button
                      onClick={clearDateRange}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {excludedPSPs.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    {excludedPSPs.length} PSPs excluded
                    <button
                      onClick={handleSelectAllPSPs}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{filteredMetrics.totalProcessed.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total Processed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {filteredMetrics.totalApproved.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Total Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{filteredMetrics.uniqueDeclined.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Unique Declined</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {filteredMetrics.weightedApprovalRate.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">Weighted Approval Rate</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Your Exact Formula:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • <strong>Total Approved:</strong> All approved transactions
              </li>
              <li>
                • <strong>Unique Declined:</strong> Declined transactions that were NEVER approved by any PSP
              </li>
              <li>
                • <strong>Formula:</strong> Approved ÷ (Approved + Unique Declined) × 100
              </li>
              <li>
                • <strong>PSP Exclusion:</strong> Remove ALL transactions from excluded PSPs
              </li>
              {(dateRange?.from || dateRange?.to) && (
                <li>
                  • <strong>Date Filtering:</strong> Only transactions within selected date range
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="country-filter" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="country-filter">Country + PSP Filter</TabsTrigger>
          <TabsTrigger value="psp-performance">PSP Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="country-filter" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Country Analysis with PSP Multi-Selection
                {(dateRange?.from || dateRange?.to) && " (Filtered by date range)"}
              </CardTitle>
              <CardDescription>Select a country and choose which PSPs to include in the calculation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* PSP Multi-Selection */}
                <div className="flex items-center justify-between">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-[300px] justify-between bg-transparent">
                        <span className="truncate">
                          {excludedPSPs.length === 0
                            ? "All PSPs"
                            : excludedPSPs.length === allPSPs.length
                              ? "No PSPs selected"
                              : `${activePSPs.length}/${allPSPs.length} PSPs selected`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <div className="p-2 border-b">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllPSPs}
                            className="flex-1 bg-transparent"
                          >
                            Select All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAllPSPs}
                            className="flex-1 bg-transparent"
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-auto">
                        {allPSPs.map((psp) => (
                          <div key={psp} className="flex items-center space-x-2 p-2 hover:bg-accent">
                            <Checkbox
                              id={psp}
                              checked={!excludedPSPs.includes(psp)}
                              onCheckedChange={() => handlePSPToggle(psp)}
                            />
                            <label
                              htmlFor={psp}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {psp}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Badge variant="outline">
                    PSPs ({activePSPs.length}/{allPSPs.length})
                  </Badge>
                </div>

                {/* Country Search and Selection */}
                <div className="space-y-2">
                  <Input
                    placeholder="Search countries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCountries.map((country) => (
                        <SelectItem key={country.country} value={country.country}>
                          {country.countryName} ({country.total} transactions, {country.approvalRate.toFixed(1)}%
                          approval)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Country Analysis Results */}
          {countryMetricsWithPSPFilter ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {countryMetricsWithPSPFilter.countryName} Analysis
                  {excludedPSPs.length > 0 && ` (${excludedPSPs.length} PSPs excluded)`}
                </CardTitle>
                <CardDescription>PSP performance breakdown for the selected country</CardDescription>
              </CardHeader>
              <CardContent>
                {(dateRange?.from || dateRange?.to) && (
                  <Alert className="mb-4">
                    <AlertDescription className="text-yellow-800">
                      <strong>Note:</strong> This analysis includes only transactions within your selected date range.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Country Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-lg font-bold">{countryMetricsWithPSPFilter.country}</div>
                      <div className="text-sm text-muted-foreground">{countryMetricsWithPSPFilter.countryName}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-lg font-bold text-green-600">{countryMetricsWithPSPFilter.approved}</div>
                      <div className="text-sm text-muted-foreground">Total Approved</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-lg font-bold text-red-600">{countryMetricsWithPSPFilter.declined}</div>
                      <div className="text-sm text-muted-foreground">Unique Declined</div>
                    </CardContent>
                  </Card>
                  <Card className="col-span-3">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {countryMetricsWithPSPFilter.approvalRate.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Approval Rate</div>
                    </CardContent>
                  </Card>
                </div>

                {/* PSP Breakdown */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PSP</TableHead>
                        <TableHead className="text-right">Total Transactions</TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                        <TableHead className="text-right">Declined</TableHead>
                        <TableHead className="text-right">Approval Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {countryMetricsWithPSPFilter.pspMetrics.map((psp) => (
                        <TableRow key={psp.psp}>
                          <TableCell className="font-medium">{psp.psp}</TableCell>
                          <TableCell className="text-right">{psp.total}</TableCell>
                          <TableCell className="text-right text-green-600">{psp.approved}</TableCell>
                          <TableCell className="text-right text-red-600">{psp.declined}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                psp.approvalRate >= 70
                                  ? "success"
                                  : psp.approvalRate >= 50
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {psp.approvalRate.toFixed(2)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Please select a country to view PSP breakdown
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="psp-performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                PSP Performance Overview
                {excludedPSPs.length > 0 && ` (${excludedPSPs.length} PSPs excluded)`}
                {(dateRange?.from || dateRange?.to) && " (Filtered by date range)"}
              </CardTitle>
              <CardDescription>Overall performance metrics for each PSP across all countries</CardDescription>
            </CardHeader>
            <CardContent>
              {(dateRange?.from || dateRange?.to) && (
                <Alert className="mb-4">
                  <AlertDescription className="text-yellow-800">
                    <strong>Note:</strong> This analysis includes only transactions within your selected date range.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PSP Name</TableHead>
                      <TableHead className="text-right">Total Attempts</TableHead>
                      <TableHead className="text-right">Approved Attempts</TableHead>
                      <TableHead className="text-right">Declined Attempts</TableHead>
                      <TableHead className="text-right">Unique Approved</TableHead>
                      <TableHead className="text-right">Unique Declined</TableHead>
                      <TableHead className="text-right">Individual Approval Rate</TableHead>
                      <TableHead className="text-right">Unique Approval Rate</TableHead>
                      <TableHead className="text-right">Avg Position</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pspPerformanceMetrics.map((psp) => (
                      <TableRow key={psp.psp}>
                        <TableCell className="font-medium">{psp.psp}</TableCell>
                        <TableCell className="text-right">{psp.totalAttempts.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {psp.approvedAttempts.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {psp.declinedAttempts.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {psp.uniqueApproved.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">{psp.uniqueDeclined.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              psp.individualApprovalRate >= 70
                                ? "success"
                                : psp.individualApprovalRate >= 50
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {psp.individualApprovalRate.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              psp.uniqueApprovalRate >= 70
                                ? "success"
                                : psp.uniqueApprovalRate >= 50
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {psp.uniqueApprovalRate.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{psp.avgPosition.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePSPToggle(psp.psp)}
                            className={
                              excludedPSPs.includes(psp.psp)
                                ? "text-green-600 hover:text-green-700"
                                : "text-red-600 hover:text-red-700"
                            }
                          >
                            {excludedPSPs.includes(psp.psp) ? "Include" : "Exclude"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Column Explanations:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>
                    • <strong>Individual Approval Rate:</strong> Approved Attempts ÷ Total Attempts × 100 (includes
                    retry attempts)
                  </li>
                  <li>
                    • <strong>Unique Approval Rate:</strong> Unique Approved ÷ (Unique Approved + Unique Declined) × 100
                    (unique transactions only)
                  </li>
                  <li>
                    • <strong>Unique Approved/Declined:</strong> Count of unique transactions (not retry attempts)
                  </li>
                  <li>
                    • <strong>Avg Position:</strong> Average position in the PSP routing chain
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
