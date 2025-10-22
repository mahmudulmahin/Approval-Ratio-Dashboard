"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { fetchCountryAbbreviations, getCountryCode } from "@/lib/country-utils"
import type { CountryAnalysis } from "@/lib/types"
import type { CountryAbbreviation } from "@/lib/country-utils"

interface CountryAnalysisResultsProps {
  results: CountryAnalysis
}

export function CountryAnalysisResults({ results }: CountryAnalysisResultsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [useAbbreviations, setUseAbbreviations] = useState(true)
  const [countryAbbreviations, setCountryAbbreviations] = useState<CountryAbbreviation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch country abbreviations
  useEffect(() => {
    async function loadAbbreviations() {
      setIsLoading(true)
      try {
        const abbreviations = await fetchCountryAbbreviations()
        setCountryAbbreviations(abbreviations)
      } catch (error) {
        console.error("Failed to load country abbreviations:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAbbreviations()
  }, [])

  // Convert country analysis object to array for table display and filtering
  const countryArray = Object.entries(results).map(([country, stats]) => {
    // Get country code if abbreviations are available
    let countryCode = country
    if (countryAbbreviations.length > 0) {
      countryCode = getCountryCode(country, countryAbbreviations, "iso")
    }

    return {
      country,
      countryCode,
      ...stats,
    }
  })

  // Filter countries based on search term
  const filteredCountries = countryArray.filter((country) =>
    country.country.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Sort countries by approval ratio (descending)
  const sortedCountries = [...filteredCountries].sort(
    (a, b) => Number.parseFloat(b.approvalRatio.toString()) - Number.parseFloat(a.approvalRatio.toString()),
  )

  // Prepare data for charts
  const barChartData = sortedCountries.map((country) => ({
    name: useAbbreviations && country.countryCode !== country.country ? country.countryCode : country.country,
    fullName: country.country,
    approvalRate: Number.parseFloat(country.approvalRatio.toString()),
    declineRate: Number.parseFloat(country.declineRatio.toString()),
    total: country.total,
  }))

  // Prepare data for pie chart (top 10 countries by volume)
  const pieChartData = [...countryArray]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((country) => ({
      name: useAbbreviations && country.countryCode !== country.country ? country.countryCode : country.country,
      fullName: country.country,
      value: country.total,
    }))

  // Colors for pie chart
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#8dd1e1",
    "#a4de6c",
    "#d0ed57",
  ]

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Country-wise Transaction Analysis</CardTitle>
          <CardDescription>Analysis of transaction approval rates across different countries</CardDescription>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
            <Input
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex items-center space-x-2">
              <Switch
                id="use-abbreviations"
                checked={useAbbreviations}
                onCheckedChange={setUseAbbreviations}
                disabled={isLoading || countryAbbreviations.length === 0}
              />
              <Label htmlFor="use-abbreviations">Use ISO country codes</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  {useAbbreviations && <TableHead>ISO Code</TableHead>}
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Declined</TableHead>
                  <TableHead className="text-right">Filtered</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Approval %</TableHead>
                  <TableHead className="text-right">Decline %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCountries.map((country) => (
                  <TableRow key={country.country}>
                    <TableCell className="font-medium">{country.country}</TableCell>
                    {useAbbreviations && (
                      <TableCell>
                        {country.countryCode !== country.country ? (
                          <Badge variant="outline">{country.countryCode}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">{country.total}</TableCell>
                    <TableCell className="text-right">{country.approved}</TableCell>
                    <TableCell className="text-right">{country.declined}</TableCell>
                    <TableCell className="text-right">{country.filtered}</TableCell>
                    <TableCell className="text-right">{country.other}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{country.approvalRatio}%</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{country.declineRatio}%</TableCell>
                  </TableRow>
                ))}
                {sortedCountries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={useAbbreviations ? 9 : 8} className="text-center py-4">
                      No countries found matching your search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Country Approval Rates</CardTitle>
          <CardDescription>Comparison of approval and decline rates by country</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData.slice(0, 15)} // Show top 15 countries
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
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)}%`}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      return payload[0].payload.fullName
                    }
                    return label
                  }}
                />
                <Legend />
                <Bar dataKey="approvalRate" name="Approval Rate" fill="#10b981" />
                <Bar dataKey="declineRate" name="Decline Rate" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume by Country</CardTitle>
            <CardDescription>Top 10 countries by transaction volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => value}
                    labelFormatter={(name, payload) => {
                      if (payload && payload.length > 0) {
                        return payload[0].payload.fullName
                      }
                      return name
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume Distribution</CardTitle>
            <CardDescription>Transaction counts by country</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData.slice(0, 10)} // Show top 10 countries
                  layout="vertical"
                  margin={{
                    top: 20,
                    right: 30,
                    left: 60,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{
                      formatter: (value, index) => {
                        const item = barChartData[index]
                        return item ? item.name : value
                      },
                    }}
                  />
                  <Tooltip
                    formatter={(value) => value}
                    labelFormatter={(name, payload) => {
                      if (payload && payload.length > 0) {
                        return payload[0].payload.fullName
                      }
                      return name
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" name="Total Transactions" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
