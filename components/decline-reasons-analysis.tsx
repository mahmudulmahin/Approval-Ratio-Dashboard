"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface DeclineCategory {
  reason: string
  count: number
  type?: "hard" | "soft"
}

interface DeclineReasonsAnalysisProps {
  declineReasons: DeclineCategory[]
}

export function DeclineReasonsAnalysis({ declineReasons }: DeclineReasonsAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter decline reasons based on search
  const filteredReasons = useMemo(() => {
    return declineReasons.filter((reason) => reason.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [declineReasons, searchTerm])

  // Sort by count (descending)
  const sortedReasons = useMemo(() => {
    return [...filteredReasons].sort((a, b) => b.count - a.count)
  }, [filteredReasons])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDeclines = declineReasons.reduce((sum, reason) => sum + reason.count, 0)
    const hardDeclines = declineReasons
      .filter((reason) => reason.type === "hard")
      .reduce((sum, reason) => sum + reason.count, 0)
    const softDeclines = declineReasons
      .filter((reason) => reason.type === "soft")
      .reduce((sum, reason) => sum + reason.count, 0)

    return {
      totalDeclines,
      hardDeclines,
      softDeclines,
      hardDeclineRate: totalDeclines > 0 ? (hardDeclines / totalDeclines) * 100 : 0,
      softDeclineRate: totalDeclines > 0 ? (softDeclines / totalDeclines) * 100 : 0,
      uniqueReasons: declineReasons.length,
    }
  }, [declineReasons])

  // Prepare chart data for top 10 reasons
  const topReasonsChartData = useMemo(() => {
    return sortedReasons.slice(0, 10).map((reason) => ({
      reason: reason.reason.length > 30 ? reason.reason.substring(0, 30) + "..." : reason.reason,
      fullReason: reason.reason,
      count: reason.count,
      type: reason.type || "unknown",
    }))
  }, [sortedReasons])

  // Prepare pie chart data for hard vs soft declines
  const declineTypeData = useMemo(() => {
    return [
      { name: "Hard Declines", value: stats.hardDeclines, color: "#ef4444" },
      { name: "Soft Declines", value: stats.softDeclines, color: "#f97316" },
    ].filter((item) => item.value > 0)
  }, [stats])

  // Group reasons by type
  const reasonsByType = useMemo(() => {
    const grouped: Record<string, DeclineCategory[]> = {
      hard: [],
      soft: [],
      unknown: [],
    }

    sortedReasons.forEach((reason) => {
      const type = reason.type || "unknown"
      grouped[type].push(reason)
    })

    return grouped
  }, [sortedReasons])

  const COLORS = ["#ef4444", "#f97316", "#6b7280"]

  return (
    <div className="space-y-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.totalDeclines.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Declines</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.hardDeclines.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Hard Declines</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.softDeclines.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Soft Declines</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.uniqueReasons}</p>
              <p className="text-sm text-muted-foreground">Unique Reasons</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-type">By Type</TabsTrigger>
          <TabsTrigger value="detailed">Detailed List</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Decline Reasons</CardTitle>
                <CardDescription>Most frequent decline reasons</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topReasonsChartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="reason" angle={-45} textAnchor="end" height={100} fontSize={12} />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length > 0) {
                            return payload[0].payload.fullReason
                          }
                          return label
                        }}
                      />
                      <Legend />
                      <Bar dataKey="count" name="Decline Count" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hard vs Soft Declines</CardTitle>
                <CardDescription>Distribution of decline types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={declineTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {declineTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="by-type">
          <div className="space-y-6">
            {Object.entries(reasonsByType).map(([type, reasons]) => {
              if (reasons.length === 0) return null

              return (
                <Card key={type}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {type === "hard" && <Badge variant="destructive">Hard Declines</Badge>}
                      {type === "soft" && <Badge variant="warning">Soft Declines</Badge>}
                      {type === "unknown" && <Badge variant="secondary">Unknown Type</Badge>}
                      <span className="text-sm text-muted-foreground">
                        ({reasons.reduce((sum, r) => sum + r.count, 0).toLocaleString()} total)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Decline Reason</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Percentage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reasons.slice(0, 10).map((reason, index) => {
                            const percentage = (reason.count / stats.totalDeclines) * 100
                            return (
                              <TableRow key={`${type}-${index}`}>
                                <TableCell className="font-medium">{reason.reason}</TableCell>
                                <TableCell className="text-right">{reason.count.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{percentage.toFixed(2)}%</TableCell>
                              </TableRow>
                            )
                          })}
                          {reasons.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                ... and {reasons.length - 10} more reasons
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>All Decline Reasons</CardTitle>
              <CardDescription>Complete list of decline reasons with counts and types</CardDescription>
              <div className="mt-2">
                <Input
                  placeholder="Search decline reasons..."
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
                      <TableHead>Decline Reason</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReasons.map((reason, index) => {
                      const percentage = (reason.count / stats.totalDeclines) * 100
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{reason.reason}</TableCell>
                          <TableCell>
                            {reason.type === "hard" && <Badge variant="destructive">Hard</Badge>}
                            {reason.type === "soft" && <Badge variant="warning">Soft</Badge>}
                            {!reason.type && <Badge variant="secondary">Unknown</Badge>}
                          </TableCell>
                          <TableCell className="text-right">{reason.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{percentage.toFixed(2)}%</TableCell>
                        </TableRow>
                      )
                    })}
                    {sortedReasons.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          No decline reasons found matching your search
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
