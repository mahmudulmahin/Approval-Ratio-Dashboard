"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface TimeAnalysisProps {
  timeAnalysis: TimeAnalysis
}

export function TimeAnalysisComponent({ timeAnalysis }: TimeAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDate, setSelectedDate] = useState<string>("all")
  const [selectedPSP, setSelectedPSP] = useState<string>("all")

  // Get all unique PSPs from daily data
  const allPSPs = useMemo(() => {
    const pspSet = new Set<string>()
    timeAnalysis.daily.forEach((day) => {
      if (day.pspBreakdown) {
        Object.keys(day.pspBreakdown).forEach((psp) => pspSet.add(psp))
      }
    })
    return Array.from(pspSet).sort()
  }, [timeAnalysis.daily])

  // Get all dates for selection
  const allDates = useMemo(() => {
    return timeAnalysis.daily.map((day) => day.date).sort()
  }, [timeAnalysis.daily])

  // Filter data based on search term for tables
  const filteredDaily = useMemo(() => {
    return timeAnalysis.daily.filter((item) => item.date.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [timeAnalysis.daily, searchTerm])

  const filteredWeekly = useMemo(() => {
    return timeAnalysis.weekly.filter((item) => item.week.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [timeAnalysis.weekly, searchTerm])

  const filteredMonthly = useMemo(() => {
    return timeAnalysis.monthly.filter((item) => item.month.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [timeAnalysis.monthly, searchTerm])

  // Prepare PSP-wise data for selected date
  const pspWiseData = useMemo(() => {
    if (selectedDate === "all") return []

    const dayData = timeAnalysis.daily.find((day) => day.date === selectedDate)
    if (!dayData || !dayData.pspBreakdown) return []

    return Object.entries(dayData.pspBreakdown)
      .filter(([psp]) => selectedPSP === "all" || psp === selectedPSP)
      .map(([psp, stats]) => ({
        psp,
        ...stats,
      }))
      .sort((a, b) => b.approvalRatio - a.approvalRatio)
  }, [selectedDate, selectedPSP, timeAnalysis.daily])

  // Prepare date-wise data for selected PSP
  const dateWiseData = useMemo(() => {
    if (selectedPSP === "all") return []

    return timeAnalysis.daily
      .filter((day) => day.pspBreakdown && day.pspBreakdown[selectedPSP])
      .map((day) => ({
        date: day.date,
        psp: selectedPSP,
        ...day.pspBreakdown![selectedPSP],
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
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
    const avgMonthly =
      totalMonths > 0 ? timeAnalysis.monthly.reduce((sum, month) => sum + month.total, 0) / totalMonths : 0
    const avgApprovalRate =
      totalMonths > 0 ? timeAnalysis.monthly.reduce((sum, month) => sum + month.approvalRate, 0) / totalMonths : 0

    return {
      totalMonths,
      avgMonthly: Math.round(avgMonthly),
      avgApprovalRate: avgApprovalRate.toFixed(2),
    }
  }, [timeAnalysis.monthly])

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Time-based Transaction Analysis (Unique Transactions)</CardTitle>
          <CardDescription>
            Transaction trends using unique transaction logic: Approved ÷ (Approved + Declined) × 100
            <br />
            <strong>Note:</strong> Uses the same calculation as PSP Analysis (2) - counts unique transactions, not
            individual attempts
          </CardDescription>
          <div className="mt-2">
            <Input
              placeholder="Search by date/period..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="daily">Daily Analysis</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Analysis</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Analysis</TabsTrigger>
          <TabsTrigger value="psp-by-date">PSP by Date</TabsTrigger>
          <TabsTrigger value="date-by-psp">Date by PSP</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          {/* Daily Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{dailyStats.totalDays}</div>
                <p className="text-xs text-muted-foreground">Total Days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{dailyStats.avgDaily}</div>
                <p className="text-xs text-muted-foreground">Avg Daily Unique Transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{dailyStats.avgApprovalRate}%</div>
                <p className="text-xs text-muted-foreground">Avg Daily Approval Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Transaction Details (Unique Transactions)</CardTitle>
              <CardDescription>Day-by-day breakdown using unique transaction counting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total Unique</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Declined</TableHead>
                      <TableHead className="text-right">Approval Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDaily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell className="text-right">{day.total}</TableCell>
                        <TableCell className="text-right">{day.approved}</TableCell>
                        <TableCell className="text-right">{day.declined}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              day.approvalRate > 80 ? "success" : day.approvalRate > 50 ? "warning" : "destructive"
                            }
                          >
                            {day.approvalRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDaily.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          No daily data found matching your search
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Daily Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Transaction Trends (Unique Transactions)</CardTitle>
              <CardDescription>Daily unique transaction volume and approval rates over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeAnalysis.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" name="Total Unique Transactions" fill="#8884d8" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="approvalRate"
                      stroke="#82ca9d"
                      name="Approval Rate %"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          {/* Weekly Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{weeklyStats.totalWeeks}</div>
                <p className="text-xs text-muted-foreground">Total Weeks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{weeklyStats.avgWeekly}</div>
                <p className="text-xs text-muted-foreground">Avg Weekly Unique Transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{weeklyStats.avgApprovalRate}%</div>
                <p className="text-xs text-muted-foreground">Avg Weekly Approval Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Table */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Transaction Details (Unique Transactions)</CardTitle>
              <CardDescription>Week-by-week breakdown using unique transaction counting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead className="text-right">Total Unique</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Declined</TableHead>
                      <TableHead className="text-right">Approval Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWeekly.map((week) => (
                      <TableRow key={week.week}>
                        <TableCell className="font-medium">{week.week}</TableCell>
                        <TableCell className="text-right">{week.total}</TableCell>
                        <TableCell className="text-right">{week.approved}</TableCell>
                        <TableCell className="text-right">{week.declined}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              week.approvalRate > 80 ? "success" : week.approvalRate > 50 ? "warning" : "destructive"
                            }
                          >
                            {week.approvalRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredWeekly.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          No weekly data found matching your search
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Transaction Trends (Unique Transactions)</CardTitle>
              <CardDescription>Weekly unique transaction volume and approval rates over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeAnalysis.weekly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" name="Total Unique Transactions" fill="#8884d8" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="approvalRate"
                      stroke="#82ca9d"
                      name="Approval Rate %"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {/* Monthly Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{monthlyStats.totalMonths}</div>
                <p className="text-xs text-muted-foreground">Total Months</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{monthlyStats.avgMonthly}</div>
                <p className="text-xs text-muted-foreground">Avg Monthly Unique Transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{monthlyStats.avgApprovalRate}%</div>
                <p className="text-xs text-muted-foreground">Avg Monthly Approval Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Table */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Transaction Details (Unique Transactions)</CardTitle>
              <CardDescription>Month-by-month breakdown using unique transaction counting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Total Unique</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Declined</TableHead>
                      <TableHead className="text-right">Approval Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMonthly.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">{month.month}</TableCell>
                        <TableCell className="text-right">{month.total}</TableCell>
                        <TableCell className="text-right">{month.approved}</TableCell>
                        <TableCell className="text-right">{month.declined}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              month.approvalRate > 80 ? "success" : month.approvalRate > 50 ? "warning" : "destructive"
                            }
                          >
                            {month.approvalRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredMonthly.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          No monthly data found matching your search
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Transaction Trends (Unique Transactions)</CardTitle>
              <CardDescription>Monthly unique transaction volume and approval rates over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeAnalysis.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" name="Total Unique Transactions" fill="#8884d8" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="approvalRate"
                      stroke="#82ca9d"
                      name="Approval Rate %"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="psp-by-date" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>PSP Performance by Date</CardTitle>
              <CardDescription>Select a date to see how each PSP performed on that specific day</CardDescription>
              <div className="flex gap-4 mt-4">
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select a date</SelectItem>
                    {allDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedPSP} onValueChange={setSelectedPSP}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by PSP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PSPs</SelectItem>
                    {allPSPs.map((psp) => (
                      <SelectItem key={psp} value={psp}>
                        {psp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedDate !== "all" ? (
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PSP</TableHead>
                          <TableHead className="text-right">Total Unique</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead className="text-right">Declined</TableHead>
                          <TableHead className="text-right">Approval Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pspWiseData.map((psp) => (
                          <TableRow key={psp.psp}>
                            <TableCell className="font-medium">{psp.psp}</TableCell>
                            <TableCell className="text-right">{psp.total}</TableCell>
                            <TableCell className="text-right">{psp.approved}</TableCell>
                            <TableCell className="text-right">{psp.declined}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  psp.approvalRatio > 80
                                    ? "success"
                                    : psp.approvalRatio > 50
                                      ? "warning"
                                      : "destructive"
                                }
                              >
                                {psp.approvalRatio}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {pspWiseData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4">
                              No PSP data available for selected date and filters
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {pspWiseData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>PSP Performance Chart for {selectedDate}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pspWiseData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="psp" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="approvalRatio" name="Approval Rate %" fill="#10b981" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Please select a date to view PSP performance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="date-by-psp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Date-wise Performance by PSP</CardTitle>
              <CardDescription>Select a PSP to see its performance across all dates</CardDescription>
              <div className="mt-4">
                <Select value={selectedPSP} onValueChange={setSelectedPSP}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select PSP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select a PSP</SelectItem>
                    {allPSPs.map((psp) => (
                      <SelectItem key={psp} value={psp}>
                        {psp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedPSP !== "all" ? (
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total Unique</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead className="text-right">Declined</TableHead>
                          <TableHead className="text-right">Approval Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dateWiseData.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell className="text-right">{day.total}</TableCell>
                            <TableCell className="text-right">{day.approved}</TableCell>
                            <TableCell className="text-right">{day.declined}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  day.approvalRatio > 80
                                    ? "success"
                                    : day.approvalRatio > 50
                                      ? "warning"
                                      : "destructive"
                                }
                              >
                                {day.approvalRatio}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {dateWiseData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4">
                              No data available for selected PSP
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {dateWiseData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>{selectedPSP} Performance Over Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dateWiseData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="approvalRatio"
                                stroke="#10b981"
                                name="Approval Rate %"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Please select a PSP to view its date-wise performance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
