"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import * as XLSX from "xlsx"
import { CalendarIcon, Download, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  BarChart,
} from "recharts"
import type { TimeAnalysis } from "@/lib/types"
import { improvedAnalyzeData, recalculateWithPSPExclusions } from "@/lib/improved-analyzer"
import type { Transaction } from "@/lib/types"

interface TimeAnalysisProps {
  timeAnalysis?: TimeAnalysis;
  transactions?: Array<Transaction | {
    id?: string;
    transactionId?: string;
    pspName?: string;
    country?: string;
    status?: string;
    amount?: number;
    currency?: string;
    timestamp?: Date | string;
    processing_date?: Date | string;
    [key: string]: any;
  }>;
}

// Helper function to convert array to CSV
export const convertToCSV = (data: any[], headers: string[]) => {
  const headerRow = headers.join(",")
  const rows = data.map((row) =>
    headers.map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`).join(",")
  )
  return [headerRow, ...rows].join("\n")
}

// Define types for better type safety
interface PspStats {
  total: number;
  approved: number;
  declined: number;
  approvalRatio: number;
}

interface PspBreakdown {
  [key: string]: PspStats;
}

interface DailyData {
  date: string;
  total: number;
  approved: number;
  declined: number;
  approvalRate: number;
  pspBreakdown?: PspBreakdown;
}

interface TimeAnalysisData {
  daily: DailyData[];
  weekly: Array<{
    week: string;
    total: number;
    approved: number;
    declined: number;
    approvalRate: number;
  }>;
  monthly: Array<{
    month: string;
    total: number;
    approved: number;
    declined: number;
    approvalRate: number;
  }>;
}

export function TimeAnalysisComponent({ 
  timeAnalysis = { 
    daily: [], 
    weekly: [], 
    monthly: [] 
  }, 
  transactions = [] 
}: TimeAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedPSP, setSelectedPSP] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedPSPs, setSelectedPSPs] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Normalize transactions to ensure they match the expected format
  const normalizedTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    return transactions.map(tx => {
      // If it's already a Transaction, return as is
      if ('merchantAmount' in tx) {
        return tx as Transaction;
      }
      
      // Otherwise, map to Transaction format
      return {
        transactionId: tx.id || tx.transactionId || '',
        merchantOrderId: tx.merchantOrderId || '',
        pspName: tx.pspName || '',
        country: tx.country || '',
        status: tx.status || '',
        merchantAmount: tx.amount,
        currency: tx.currency,
        processing_date: tx.processing_date || tx.timestamp || new Date(),
        ...tx
      } as Transaction;
    });
  }, [transactions]);

  // Get all unique PSPs from transactions or fall back to timeAnalysis data
  const allPSPs = useMemo(() => {
    const pspSet = new Set<string>();
    
    // First try to get from normalized transactions if available
    if (normalizedTransactions && normalizedTransactions.length > 0) {
      normalizedTransactions.forEach(tx => {
        if (tx.pspName) {
          pspSet.add(tx.pspName);
        }
      });
    } 
    // Fall back to timeAnalysis data if no transactions or no PSPs found
    if (pspSet.size === 0 && timeAnalysis.daily) {
      timeAnalysis.daily.forEach((day: DailyData) => {
        if (day.pspBreakdown) {
          Object.keys(day.pspBreakdown).forEach((psp: string) => pspSet.add(psp));
        }
      });
    }
    
    const psps = Array.from(pspSet).sort();
    return psps;
  }, [timeAnalysis.daily, normalizedTransactions])

  // Toggle PSP selection
  const togglePSP = (psp: string) => {
    setSelectedPSPs((prev: string[]) =>
      prev.includes(psp) ? prev.filter((p: string) => p !== psp) : [...prev, psp]
    )
  }

  // Select all/none PSPS
  const toggleAllPSPs = (checked: boolean) => {
    setSelectedPSPs(checked ? [...allPSPs] : [])
  }

  // Types already declared above (PspStats, DailyData) – avoid duplicate declarations

  // Get all dates for selection
  const allDates = useMemo(() => {
    return timeAnalysis.daily.map((day: DailyData) => day.date).sort()
  }, [timeAnalysis.daily])

  // Debug logging removed for performance


  // Use the improved analyzer for journey-based counting
  const filteredDaily = useMemo(() => {
    // If we have transactions, use them, otherwise fall back to the pre-calculated timeAnalysis data
    if (normalizedTransactions.length === 0) {
      return timeAnalysis.daily || [];
    }


    // Derive excluded PSPs to mirror PSP Analysis (1) behavior
    const excludedPSPs = selectedPSPs.length > 0
      ? allPSPs.filter(psp => !selectedPSPs.includes(psp))
      : [];

    // First, apply the same date range filtering semantics as PSP Analysis (1)
    const dateFilteredTransactions = normalizedTransactions.filter((tx) => {
      if (!dateRange || (!dateRange.from && !dateRange.to)) return true;
      if (!tx.processing_date) return false;

      const txDate = tx.processing_date instanceof Date ? tx.processing_date : new Date(tx.processing_date);

      if (dateRange.from && dateRange.to && dateRange.from.getTime() === dateRange.to.getTime()) {
        // Single date selection: compare date-only
        const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
        const selectedDateOnly = new Date(
          dateRange.from.getFullYear(),
          dateRange.from.getMonth(),
          dateRange.from.getDate(),
        );
        return txDateOnly.getTime() === selectedDateOnly.getTime();
      } else {
        // Range filtering: inclusive of start and end
        if (dateRange.from && txDate < dateRange.from) return false;
        if (dateRange.to) {
          const end = new Date(dateRange.to);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
        return true;
      }
    });

    // Build one analysis for the filtered set, then compute per-date from journeys
    const baseAnalysis = improvedAnalyzeData(dateFilteredTransactions);

    // Group journeys by date key
    const journeysByDate = new Map<string, any[]>();
    Object.values(baseAnalysis.transactionJourneys).forEach((journey: any) => {
      const key = journey.date instanceof Date ? journey.date.toISOString().split('T')[0] : new Date(journey.date).toISOString().split('T')[0];
      if (!journeysByDate.has(key)) journeysByDate.set(key, []);
      journeysByDate.get(key)!.push(journey);
    });

    // Compute daily rows
    const dailyData = Array.from(journeysByDate.entries()).map(([date, journeys]) => {
      // If PSPs are selected, keep only journeys involving them for breakdown; metrics are computed via exclusions
      const dateResultsForRecalc = { transactionJourneys: Object.fromEntries(journeys.map((j:any) => [j.merchantOrderId, j])) } as any;

      const metrics = excludedPSPs.length > 0
        ? recalculateWithPSPExclusions(dateResultsForRecalc, excludedPSPs)
        : {
            totalApprovedTransactions: journeys.filter((j:any) => j.finalStatus === 'success').length,
            totalUniqueDeclinedTransactions: journeys.filter((j:any) => j.finalStatus === 'failed').length,
            get totalProcessedTransactions() { return this.totalApprovedTransactions + this.totalUniqueDeclinedTransactions },
            get weightedSuccessRate() { const t = this.totalProcessedTransactions; return t>0 ? (this.totalApprovedTransactions/t)*100 : 0 }
          } as any;

      // PSP breakdown per day based on selected PSPs
      const pspBreakdown: PspBreakdown = {};
      const pspSet = new Set<string>();
      journeys.forEach((j:any) => j.pspsInvolved.forEach((p:string) => pspSet.add(p)));
      const pspsToInclude = selectedPSPs.length > 0 ? selectedPSPs : Array.from(pspSet);

      pspsToInclude.forEach((psp) => {
        // Consider journeys that involved this PSP and also not excluded via excludedPSPs logic
        if (excludedPSPs.includes(psp)) return;
        const relevant = journeys.filter((j:any) => j.pspsInvolved.includes(psp));
        let approved = 0; let declined = 0;
        relevant.forEach((j:any) => {
          const pspApproved = j.attempts.some((a:any) => a.pspName === psp && (a.status.toLowerCase().includes('approved') || a.status.toLowerCase().includes('success')));
          if (pspApproved) approved++; else declined++;
        });
        const total = approved + declined;
        const ar = total>0 ? (approved/total)*100 : 0;
        pspBreakdown[psp] = { total, approved, declined, approvalRatio: Number(ar.toFixed(2)) };
      });

      return {
        date,
        total: metrics.totalProcessedTransactions,
        approved: metrics.totalApprovedTransactions,
        declined: metrics.totalUniqueDeclinedTransactions,
        approvalRate: metrics.weightedSuccessRate,
        pspBreakdown
      } as DailyData;
    });

    // Apply additional filters
    return dailyData
      .filter(item => {
        // Apply date range filter
        if (dateRange?.from || dateRange?.to) {
          const itemDate = new Date(item.date);
          if (dateRange.from && itemDate < dateRange.from) return false;
          if (dateRange.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            if (itemDate > toDate) return false;
          }
        }
        
        // Apply search term
        if (searchTerm && !item.date.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [normalizedTransactions, searchTerm, dateRange, selectedPSPs, allPSPs]);

  // Prepare export data - use the same filtered data as the table
  const exportData = useMemo(() => {
    return filteredDaily.flatMap((day: DailyData) => {
      // If no PSPs selected, include a single row for the day
      if (selectedPSPs.length === 0) {
        return [{
          date: day.date,
          psp: 'All',
          total: day.total,
          approved: day.approved,
          declined: day.declined,
          approvalRate: day.approvalRate
        }];
      }
      
      // If specific PSPs are selected, include a row for each PSP
      return selectedPSPs.map(psp => {
        const pspData = day.pspBreakdown?.[psp];
        if (!pspData) return null;
        
        return {
          date: day.date,
          psp,
          total: pspData.total,
          approved: pspData.approved,
          declined: pspData.declined,
          approvalRate: pspData.approvalRatio
        };
      }).filter(Boolean); // Remove any null entries
    }).filter(Boolean); // Ensure we don't have any undefined/null entries
  }, [filteredDaily, selectedPSPs]);

  // Handle export to XLSX with two sheets
  const handleExport = () => {
    if (exportData.length === 0) {
      alert('No data to export with the current filters');
      return;
    }

    // Sheet 1: current PSP-wise (or All) rows
    const dataToExport = [...exportData].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (a.psp || '').localeCompare(b.psp || '');
    });

    const sheet1 = XLSX.utils.json_to_sheet(
      dataToExport.map(item => ({
        Date: item.date,
        PSP: item.psp,
        Total: item.total,
        Approved: item.approved,
        Declined: item.declined,
        'Approval Rate (%)': typeof item.approvalRate === 'number' ? Number(item.approvalRate.toFixed(2)) : item.approvalRate
      }))
    );

    // Sheet 2: date-wise summary (no PSP column)
    const dateSummaryRows = filteredDaily.map((day) => {
      const numericRate = typeof day.approvalRate === 'number'
        ? day.approvalRate
        : Number(day.approvalRate || 0);
      return {
        Date: day.date,
        Total: day.total,
        Approved: day.approved,
        Declined: day.declined,
        'Approval Rate (%)': Number(numericRate.toFixed(2))
      };
    });
    const sheet2 = XLSX.utils.json_to_sheet(dateSummaryRows);

    const wb = XLSX.utils.book_new();
    // Append in stable order and ensure unique names
    XLSX.utils.book_append_sheet(wb, sheet2, 'Date Summary');
    XLSX.utils.book_append_sheet(wb, sheet1, 'PSP Detail');

    let filename = 'approval-ratios';
    if (dateRange.from) filename += `-from-${format(dateRange.from, 'yyyy-MM-dd')}`;
    if (dateRange.to) filename += `-to-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (selectedPSPs.length > 0) filename += `-${selectedPSPs.length}-psps`;
    filename += `-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    XLSX.writeFile(wb, filename);
  }


  // For weekly and monthly, we'll use the pre-calculated data from timeAnalysis
  const filteredWeekly = useMemo(() => {
    if (!timeAnalysis.weekly) return [];
    return timeAnalysis.weekly.filter((item: { week: string }) => 
      searchTerm ? item.week.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );
  }, [timeAnalysis.weekly, searchTerm]);

  const filteredMonthly = useMemo(() => {
    if (!timeAnalysis.monthly) return [];
    return timeAnalysis.monthly.filter((item: { month: string }) => 
      searchTerm ? item.month.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );
  }, [timeAnalysis.monthly, searchTerm]);


  // Prepare PSP-wise data for selected date
  const pspWiseData = useMemo(() => {
    if (selectedDate === "all") return [];

    const dayData = filteredDaily.find((day: { date: string }) => day.date === selectedDate);
    if (!dayData || !dayData.pspBreakdown) return [];

    return Object.entries(dayData.pspBreakdown as Record<string, PspStats>)
      .filter(([psp]) => selectedPSP === "all" || psp === selectedPSP)
      .map(([psp, stats]) => ({
        psp,
        total: stats.total || 0,
        approved: stats.approved || 0,
        declined: stats.declined || 0,
        approvalRatio: stats.approvalRatio || 0
      }))
      .sort((a, b) => (b.approvalRatio || 0) - (a.approvalRatio || 0));
  }, [selectedDate, selectedPSP, filteredDaily]);

  // Prepare date-wise data for selected PSP
  const dateWiseData = useMemo(() => {
    if (selectedPSP === "all") return [];

    return timeAnalysis.daily
      .filter((day) => day.pspBreakdown && day.pspBreakdown[selectedPSP])
      .map((day) => {
        const pspData = day.pspBreakdown![selectedPSP] as PspStats;
        return {
          date: day.date,
          psp: selectedPSP,
          total: pspData.total || 0,
          approved: pspData.approved || 0,
          declined: pspData.declined || 0,
          approvalRatio: pspData.approvalRatio || 0
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedPSP, timeAnalysis.daily])

  // Calculate summary statistics
  const dailyStats = useMemo(() => {
    const totalDays = timeAnalysis.daily.length
    const avgDaily = totalDays > 0 ? timeAnalysis.daily.reduce((sum, day) => sum + day.total, 0) / totalDays : 0
    const avgApprovalRate =
      totalDays > 0 ? timeAnalysis.daily.reduce((sum, day) => sum + day.approvalRate, 0) / totalDays : 0

    return {
      totalDays,
      avgDaily: Math.round(avgDaily),
      avgApprovalRate: avgApprovalRate.toFixed(2),
    }
  }, [timeAnalysis.daily])

  const weeklyStats = useMemo(() => {
    const totalWeeks = timeAnalysis.weekly.length
    const avgWeekly = totalWeeks > 0 ? timeAnalysis.weekly.reduce((sum, week) => sum + week.total, 0) / totalWeeks : 0
    const avgApprovalRate =
      totalWeeks > 0 ? timeAnalysis.weekly.reduce((sum, week) => sum + week.approvalRate, 0) / totalWeeks : 0

    return {
      totalWeeks,
      avgWeekly: Math.round(avgWeekly),
      avgApprovalRate: avgApprovalRate.toFixed(2),
    }
  }, [timeAnalysis.weekly])

  const monthlyStats = useMemo(() => {
    const totalMonths = timeAnalysis.monthly.length
    const totalTransactions = timeAnalysis.monthly.reduce(
      (sum: number, month: { total: number }) => sum + month.total, 0
    )
    const avgMonthly = totalTransactions / Math.max(totalMonths, 1)
    const totalApprovalRate =
      timeAnalysis.monthly.reduce(
        (sum: number, month: { approvalRate: number }) => sum + month.approvalRate, 0
      ) / Math.max(totalMonths, 1)
    const avgApprovalRate = Number.isNaN(totalApprovalRate) ? 0 : totalApprovalRate

    return {
      totalMonths,
      avgMonthly: Math.round(avgMonthly),
      avgApprovalRate: avgApprovalRate.toFixed(2),
    }
  }, [timeAnalysis.monthly])

  return (
    <div className="space-y-8">
      <Tabs defaultValue="daily" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Time-based Transaction Analysis (Unique Transactions)</CardTitle>
              <CardDescription>
                Transaction trends using unique transaction logic: Approved ÷ (Approved + Declined) × 100
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
              <Button size="sm" onClick={handleExport} disabled={exportData.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </CardHeader>
          
          {showFilters && (
            <CardContent className="pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, 'MMM dd, yyyy')} -{' '}
                              {format(dateRange.to, 'MMM dd, yyyy')}
                            </>
                          ) : (
                            format(dateRange.from, 'MMM dd, yyyy')
                          )
                        ) : (
                          <span>Select date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={(range: { from?: Date; to?: Date } | undefined) => setDateRange({
                          from: range?.from,
                          to: range?.to
                        })}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by PSP</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {selectedPSPs.length > 0 
                          ? `${selectedPSPs.length} selected` 
                          : 'All PSPs'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-2">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 p-2">
                          <Checkbox
                            id="select-all"
                            checked={selectedPSPs.length === allPSPs.length}
                            onCheckedChange={(checked: boolean) => toggleAllPSPs(checked)}
                          />
                          <label htmlFor="select-all" className="text-sm font-medium">
                            {selectedPSPs.length === allPSPs.length ? 'Deselect All' : 'Select All'}
                          </label>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {allPSPs.map((psp: string) => (
                            <div key={psp} className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                              <Checkbox
                                id={`psp-${psp}`}
                                checked={selectedPSPs.includes(psp)}
                                onCheckedChange={() => togglePSP(psp)}
                              />
                              <label htmlFor={`psp-${psp}`} className="text-sm">
                                {psp}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    placeholder="Search dates..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          )}
          
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {exportData.length} records
              {dateRange?.from && (
                <span>
                  {' '}from {format(dateRange.from, 'MMM dd, yyyy')}
                  {dateRange?.to && ` to ${format(dateRange.to, 'MMM dd, yyyy')}`}
                </span>
              )}
              {selectedPSPs.length > 0 && (
                <span> for {selectedPSPs.length} selected PSPs</span>
              )}
            </div>
          </CardContent>
          
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              <strong>Note:</strong> Uses the same calculation as PSP Analysis (2) - counts unique transactions, not
              individual attempts
            </div>
          </CardContent>
        </Card>

      <TabsContent value="daily" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Daily Transaction Analysis</CardTitle>
            <CardDescription>Detailed daily transaction metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Declined</TableHead>
                    <TableHead>Approval Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDaily.length > 0 ? (
                    filteredDaily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell>{day.total.toLocaleString()}</TableCell>
                        <TableCell>{day.approved.toLocaleString()}</TableCell>
                        <TableCell>{day.declined.toLocaleString()}</TableCell>
                        <TableCell>{typeof day.approvalRate === 'number' ? day.approvalRate.toFixed(2) + '%' : 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        No data available for the selected filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="weekly" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Transaction Analysis</CardTitle>
            <CardDescription>Weekly aggregated transaction metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Declined</TableHead>
                    <TableHead>Approval Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWeekly.map((week: { week: string; total: number; approved: number; declined: number; approvalRate: number }) => (
                    <TableRow key={week.week}>
                      <TableCell>{week.week}</TableCell>
                      <TableCell>{week.total}</TableCell>
                      <TableCell>{week.approved}</TableCell>
                      <TableCell>{week.declined}</TableCell>
                      <TableCell>{week.approvalRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="monthly" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Transaction Analysis</CardTitle>
            <CardDescription>Monthly aggregated transaction metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Declined</TableHead>
                    <TableHead>Approval Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeAnalysis.monthly.map((month: { month: string; total: number; approved: number; declined: number; approvalRate: number }) => (
                    <TableRow key={month.month}>
                      <TableCell>{month.month}</TableCell>
                      <TableCell>{month.total}</TableCell>
                      <TableCell>{month.approved}</TableCell>
                      <TableCell>{month.declined}</TableCell>
                      <TableCell>{month.approvalRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Months</CardDescription>
                  <CardTitle className="text-4xl">{monthlyStats.totalMonths}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg. Monthly Transactions</CardDescription>
                  <CardTitle className="text-4xl">{monthlyStats.avgMonthly.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg. Approval Rate</CardDescription>
                  <CardTitle className="text-4xl">{monthlyStats.avgApprovalRate}%</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="daily">Daily</TabsTrigger>
        <TabsTrigger value="weekly">Weekly</TabsTrigger>
        <TabsTrigger value="monthly">Monthly</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
  )
}
