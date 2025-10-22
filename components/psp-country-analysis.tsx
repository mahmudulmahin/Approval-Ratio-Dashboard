"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronDown } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { HeatMap } from "@/components/heat-map"
import { getCountryNameFromCode } from "@/lib/country-utils"
import type { CountryAnalysis } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PSPCountryAnalysisProps {
  results: CountryAnalysis
}

export function PSPCountryAnalysis({ results }: PSPCountryAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>("all")
  const [selectedPSPs, setSelectedPSPs] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<string>("approvalRatioLowToHigh")

  // Extract all unique PSPs across all countries
  const allPSPs = useMemo(() => {
    const pspSet = new Set<string>()
    Object.values(results).forEach((countryData) => {
      Object.keys(countryData.pspBreakdown).forEach((psp) => {
        pspSet.add(psp)
      })
    })
    return Array.from(pspSet)
  }, [results])

  // Initialize selected PSPs to all PSPs on first load
  useMemo(() => {
    if (selectedPSPs.length === 0 && allPSPs.length > 0) {
      setSelectedPSPs(allPSPs)
    }
  }, [allPSPs, selectedPSPs.length])

  // Get all countries
  const countries = useMemo(() => Object.keys(results), [results])

  // Toggle PSP selection
  const togglePSP = (psp: string) => {
    if (selectedPSPs.includes(psp)) {
      setSelectedPSPs(selectedPSPs.filter((p) => p !== psp))
    } else {
      setSelectedPSPs([...selectedPSPs, psp])
    }
  }

  const selectAllPSPs = () => {
    setSelectedPSPs([...allPSPs])
  }

  const clearAllPSPs = () => {
    setSelectedPSPs([])
  }

  // Filter and prepare data based on selections
  const filteredData = useMemo(() => {
    const data: Array<{
      country: string
      countryName: string
      psp: string
      total: number
      approved: number
      declined: number
      approvalRatio: number
      declineRatio: number
    }> = []

    Object.entries(results).forEach(([country, countryData]) => {
      // Skip if a specific country is selected and this isn't it
      if (selectedCountry !== "all" && selectedCountry !== country) return

      // Get full country name from code
      const countryName = getCountryNameFromCode(country)

      Object.entries(countryData.pspBreakdown).forEach(([psp, pspStats]) => {
        // Skip if PSP is not in selected PSPs
        if (!selectedPSPs.includes(psp)) return

        // Skip if doesn't match search term
        if (
          searchTerm &&
          !country.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !countryName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !psp.toLowerCase().includes(searchTerm.toLowerCase())
        )
          return

        // Only include entries with transactions
        if (pspStats.total > 0) {
          data.push({
            country,
            countryName,
            psp,
            total: pspStats.total,
            approved: pspStats.approved,
            declined: pspStats.declined,
            approvalRatio: pspStats.approvalRatio,
            declineRatio: pspStats.declineRatio,
          })
        }
      })
    })

    // Sort data based on selected sort criteria
    return data.sort((a, b) => {
      if (sortBy === "country") return a.country.localeCompare(b.country)
      if (sortBy === "countryName") return a.countryName.localeCompare(b.countryName)
      if (sortBy === "psp") return a.psp.localeCompare(b.psp)
      if (sortBy === "total") return b.total - a.total
      if (sortBy === "approvalRatioHighToLow") return b.approvalRatio - a.approvalRatio
      if (sortBy === "approvalRatioLowToHigh") return a.approvalRatio - b.approvalRatio
      if (sortBy === "volumeWeightedRanking") {
        // Calculate a composite score: approval_rate * log(volume + 1) to balance both factors
        const scoreA = a.approvalRatio * Math.log(a.total + 1)
        const scoreB = b.approvalRatio * Math.log(b.total + 1)
        return scoreB - scoreA // Higher scores first
      }
      if (sortBy === "highVolumeHighApproval") {
        // Prioritize high volume AND high approval (both above median)
        const volumeThreshold = 50 // You can adjust this based on your data
        const approvalThreshold = 70
        const aQualifies = a.total >= volumeThreshold && a.approvalRatio >= approvalThreshold
        const bQualifies = b.total >= volumeThreshold && b.approvalRatio >= approvalThreshold

        if (aQualifies && !bQualifies) return -1
        if (!aQualifies && bQualifies) return 1
        if (aQualifies && bQualifies) {
          // Both qualify, sort by composite score
          const scoreA = a.approvalRatio * Math.log(a.total + 1)
          const scoreB = b.approvalRatio * Math.log(b.total + 1)
          return scoreB - scoreA
        }
        // Neither qualifies, sort by volume
        return b.total - a.total
      }
      if (sortBy === "highVolumeLowApproval") {
        // Identify problematic PSP-country combinations: high volume but low approval
        const volumeThreshold = 50
        const approvalThreshold = 50
        const aProblematic = a.total >= volumeThreshold && a.approvalRatio <= approvalThreshold
        const bProblematic = b.total >= volumeThreshold && b.approvalRatio <= approvalThreshold

        if (aProblematic && !bProblematic) return -1
        if (!aProblematic && bProblematic) return 1
        if (aProblematic && bProblematic) {
          // Both are problematic, sort by volume (highest volume problems first)
          return b.total - a.total
        }
        // Neither is problematic, sort by lowest approval rate
        return a.approvalRatio - b.approvalRatio
      }
      if (sortBy === "lowVolumeHighApproval") {
        // Find hidden gems: low volume but very high approval rate
        const volumeThreshold = 20
        const approvalThreshold = 80
        const aGem = a.total <= volumeThreshold && a.approvalRatio >= approvalThreshold
        const bGem = b.total <= volumeThreshold && b.approvalRatio >= approvalThreshold

        if (aGem && !bGem) return -1
        if (!aGem && bGem) return 1
        if (aGem && bGem) {
          // Both are gems, sort by highest approval rate
          return b.approvalRatio - a.approvalRatio
        }
        // Sort by approval rate
        return b.approvalRatio - a.approvalRatio
      }
      if (sortBy === "potentialImpact") {
        // Calculate potential impact: volume * (100 - current_approval_rate)
        // Higher score = more transactions that could potentially be recovered
        const impactA = a.total * (100 - a.approvalRatio)
        const impactB = b.total * (100 - b.approvalRatio)
        return impactB - impactA
      }
      return 0
    })
  }, [results, selectedCountry, selectedPSPs, searchTerm, sortBy])

  // Prepare data for the best PSP by country chart (filtered by selected PSPs)
  const bestPSPByCountry = useMemo(() => {
    const bestPSPs: Array<{
      country: string
      countryName: string
      bestPSP: string
      approvalRatio: number
      total: number
    }> = []

    Object.entries(results).forEach(([country, countryData]) => {
      let bestPSP = ""
      let bestRatio = -1
      let totalTxns = 0

      // Get full country name from code
      const countryName = getCountryNameFromCode(country)

      Object.entries(countryData.pspBreakdown).forEach(([psp, pspStats]) => {
        // Only consider selected PSPs with a minimum number of transactions (e.g., 5)
        if (selectedPSPs.includes(psp) && pspStats.total >= 5 && pspStats.approvalRatio > bestRatio) {
          bestPSP = psp
          bestRatio = pspStats.approvalRatio
          totalTxns = pspStats.total
        }
      })

      if (bestPSP) {
        bestPSPs.push({
          country,
          countryName,
          bestPSP,
          approvalRatio: bestRatio,
          total: totalTxns,
        })
      }
    })

    return bestPSPs.sort((a, b) => b.approvalRatio - a.approvalRatio)
  }, [results, selectedPSPs])

  // Prepare data for heat map (filtered by selected PSPs)
  const heatMapData = useMemo(() => {
    const data: Array<{ x: string; y: string; value: number; fullName: string }> = []

    // Get top 10 countries by transaction volume
    const topCountries = Object.entries(results)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([country]) => {
        const countryName = getCountryNameFromCode(country)
        return {
          code: country,
          name: countryName,
        }
      })

    // Get PSP volume for selected PSPs only
    const pspVolume: Record<string, number> = {}
    Object.values(results).forEach((countryData) => {
      Object.entries(countryData.pspBreakdown).forEach(([psp, stats]) => {
        if (selectedPSPs.includes(psp)) {
          pspVolume[psp] = (pspVolume[psp] || 0) + stats.total
        }
      })
    })

    const topPSPs = Object.entries(pspVolume)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([psp]) => psp)

    // Create heat map data for top countries and selected PSPs
    topCountries.forEach((country) => {
      topPSPs.forEach((psp) => {
        const pspStats = results[country.code]?.pspBreakdown[psp]
        if (pspStats && pspStats.total > 0) {
          data.push({
            x: country.code,
            y: psp,
            value: pspStats.approvalRatio,
            fullName: country.name,
          })
        } else {
          // Add zero value for missing combinations to keep the grid complete
          data.push({
            x: country.code,
            y: psp,
            value: 0,
            fullName: country.name,
          })
        }
      })
    })

    return {
      data,
      xLabels: topCountries.map((c) => c.code),
      yLabels: topPSPs,
      fullNames: topCountries.map((c) => c.name),
    }
  }, [results, selectedPSPs])

  return (
    <div className="space-y-8">
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="performance">PSP Performance Analysis</TabsTrigger>
          <TabsTrigger value="heatmap">Heat Map & Best PSPs</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>PSP Performance by Country</CardTitle>
              <CardDescription>
                Analyze how each PSP performs in different countries using unique transaction logic.
                <br />
                <strong>Note:</strong> Uses unique transaction counting - each transaction is counted once per PSP
                involved. Approval ratio = Approved Unique Transactions ÷ (Approved + Declined Unique Transactions) ×
                100
              </CardDescription>
              <div className="flex flex-col space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search countries or PSPs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Select Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country} - {getCountryNameFromCode(country)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-[180px] justify-start bg-transparent">
                        <Check className="mr-2 h-4 w-4" />
                        {selectedPSPs.length === 0
                          ? "All PSPs"
                          : selectedPSPs.length === allPSPs.length
                            ? "All PSPs"
                            : selectedPSPs.length === 1
                              ? selectedPSPs[0]
                              : `${selectedPSPs.length} PSPs selected`}
                        <ChevronDown className="ml-auto h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={selectAllPSPs}>
                            Select All
                          </Button>
                          <Button variant="outline" size="sm" onClick={clearAllPSPs}>
                            Clear All
                          </Button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {allPSPs.map((psp) => (
                            <div key={psp} className="flex items-center space-x-2">
                              <Checkbox
                                id={`psp-${psp}`}
                                checked={selectedPSPs.includes(psp)}
                                onCheckedChange={() => togglePSP(psp)}
                              />
                              <Label htmlFor={`psp-${psp}`} className="text-sm">
                                {psp}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approvalRatioLowToHigh">Approval Rate (Low to High)</SelectItem>
                      <SelectItem value="approvalRatioHighToLow">Approval Rate (High to Low)</SelectItem>
                      <SelectItem value="total">Transaction Volume (High to Low)</SelectItem>
                      <SelectItem value="country">Country Code</SelectItem>
                      <SelectItem value="countryName">Country Name</SelectItem>
                      <SelectItem value="psp">PSP Name</SelectItem>
                      <SelectItem value="volumeWeightedRanking">
                        Volume-Weighted Ranking (High Volume + High Approval)
                      </SelectItem>
                      <SelectItem value="highVolumeHighApproval">🟢 High Volume + High Approval (Winners)</SelectItem>
                      <SelectItem value="highVolumeLowApproval">🔴 High Volume + Low Approval (Problems)</SelectItem>
                      <SelectItem value="lowVolumeHighApproval">💎 Low Volume + High Approval (Hidden Gems)</SelectItem>
                      <SelectItem value="potentialImpact">📈 Potential Impact (Volume × Decline Rate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Country Name</TableHead>
                      <TableHead>PSP</TableHead>
                      <TableHead className="text-right">Total Txns</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Declined</TableHead>
                      <TableHead className="text-right">Approval %</TableHead>
                      <TableHead className="text-right">Decline %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item, index) => (
                      <TableRow key={`${item.country}-${item.psp}-${index}`}>
                        <TableCell>{item.country}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {item.countryName}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.psp}</TableCell>
                        <TableCell className="text-right">{item.total}</TableCell>
                        <TableCell className="text-right">{item.approved}</TableCell>
                        <TableCell className="text-right">{item.declined}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              item.approvalRatio > 80 ? "success" : item.approvalRatio > 50 ? "warning" : "destructive"
                            }
                            className="font-medium"
                          >
                            {item.approvalRatio.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              item.declineRatio < 20 ? "success" : item.declineRatio < 50 ? "warning" : "destructive"
                            }
                            className="font-medium"
                          >
                            {item.declineRatio.toFixed(2)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4">
                          No data found matching your criteria
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Best Performing PSP by Country</CardTitle>
              <CardDescription>
                Shows which PSP has the highest approval rate in each country (minimum 5 transactions)
                {selectedPSPs.length < allPSPs.length && ` - filtered to ${selectedPSPs.length} selected PSPs`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border mb-8">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Country Name</TableHead>
                      <TableHead>Best PSP</TableHead>
                      <TableHead className="text-right">Approval Rate</TableHead>
                      <TableHead className="text-right">Transaction Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bestPSPByCountry.map((item) => (
                      <TableRow key={item.country}>
                        <TableCell>{item.country}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {item.countryName}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.bestPSP}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="success" className="font-medium">
                            {item.approvalRatio.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.total}</TableCell>
                      </TableRow>
                    ))}
                    {bestPSPByCountry.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          No data available for selected PSPs
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bestPSPByCountry.slice(0, 15)}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 70,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" angle={-45} textAnchor="end" height={70} />
                    <YAxis label={{ value: "Approval Rate (%)", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      formatter={(value, name, props) => {
                        if (name === "approvalRatio") return [`${Number(value).toFixed(2)}%`, "Approval Rate"]
                        return [value, name]
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length) {
                          return `${label} (${payload[0].payload.countryName})`
                        }
                        return label
                      }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background p-2 border rounded shadow-sm">
                              <p className="font-bold">
                                {label} - {payload[0].payload.countryName}
                              </p>
                              <p className="text-sm">
                                Best PSP: <span className="font-medium">{payload[0].payload.bestPSP}</span>
                              </p>
                              <p className="text-sm">
                                Approval Rate:{" "}
                                <span className="font-medium text-green-600">
                                  {payload[0].payload.approvalRatio.toFixed(2)}%
                                </span>
                              </p>
                              <p className="text-sm">
                                Transactions: <span className="font-medium">{payload[0].payload.total}</span>
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="approvalRatio" name="Approval Rate" fill="#10b981">
                      {bestPSPByCountry.slice(0, 15).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`hsl(${120 + (entry.approvalRatio / 100) * 120}, 70%, 50%)`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PSP Approval Rate Heat Map</CardTitle>
              <CardDescription>
                Visualizes approval rates across selected PSPs and countries (darker green = higher approval rate)
                {selectedPSPs.length < allPSPs.length && ` - showing ${selectedPSPs.length} selected PSPs`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full">
                <HeatMap
                  data={heatMapData.data}
                  xLabels={heatMapData.xLabels}
                  yLabels={heatMapData.yLabels}
                  xLabel="Countries"
                  yLabel="PSPs"
                  valueLabel="Approval Rate"
                  fullNames={heatMapData.fullNames}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
