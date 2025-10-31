"use client"

import { useState } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploader } from "@/components/file-uploader"
import { PSPAnalysisResults } from "@/components/psp-analysis-results"
import { PSPCountryAnalysis } from "@/components/psp-country-analysis"
import { RetriedTransactions } from "@/components/retried-transactions"
import { TimeAnalysisComponent } from "@/components/time-analysis"
import { ImprovedPSPAnalysis } from "@/components/improved-psp-analysis"
import { analyzeData } from "@/lib/data-analyzer"
import { improvedAnalyzeData } from "@/lib/improved-analyzer"
import type { Transaction, AnalysisResults } from "@/lib/types"
import type { ImprovedAnalysisResults } from "@/lib/improved-analyzer"

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null)
  const [improvedResults, setImprovedResults] = useState<ImprovedAnalysisResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleDataLoaded = async (data: Transaction[]) => {
    setIsLoading(true)
    try {
      setTransactions(data)

      // Yield to the event loop to keep UI responsive
      await new Promise((r) => setTimeout(r, 0))

      // Compute improved analysis first (used widely)
      const improvedAnalysis = await Promise.resolve().then(() => improvedAnalyzeData(data))
      setImprovedResults(improvedAnalysis)

      // Yield again before running the second, heavier analysis
      await new Promise((r) => setTimeout(r, 0))

      const results = await Promise.resolve().then(() => analyzeData(data))
      setAnalysisResults(results)
    } catch (error) {
      console.error("Error analyzing data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">PSP Transaction Analysis</h1>
        <p className="text-xl text-muted-foreground">
          Upload your transaction data to analyze PSP performance and approval rates
        </p>
      </div>

      <FileUploader onDataLoaded={handleDataLoaded} isLoading={isLoading} />

      {(analysisResults || improvedResults) && (
        <Tabs defaultValue="psp-analysis-1" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="psp-analysis-1">PSP Analysis (1)</TabsTrigger>
            <TabsTrigger value="psp-analysis-2">PSP Analysis (2)</TabsTrigger>
            <TabsTrigger value="psp-country">PSP by Country</TabsTrigger>
            <TabsTrigger value="retried">Retried Transactions</TabsTrigger>
            <TabsTrigger value="time-analysis">Time Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="psp-analysis-1">
            {transactions.length > 0 ? (
              <ImprovedPSPAnalysis results={analysisResults || {}} transactions={transactions} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Data Available</CardTitle>
                  <CardDescription>Please upload transaction data to see the PSP analysis</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="psp-analysis-2">
            {analysisResults ? (
              <PSPAnalysisResults results={analysisResults.pspAnalysis} transactions={transactions} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Data Available</CardTitle>
                  <CardDescription>Please upload transaction data to see PSP analysis</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="psp-country">
            {analysisResults ? (
              <PSPCountryAnalysis results={analysisResults.countryAnalysis} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Data Available</CardTitle>
                  <CardDescription>Please upload transaction data to see PSP by country analysis</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="retried">
            {analysisResults ? (
              <RetriedTransactions
                retriedTransactions={analysisResults.retriedTransactions}
                crossPSPFlows={analysisResults.crossPSPFlows}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Data Available</CardTitle>
                  <CardDescription>Please upload transaction data to see retried transactions</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="time-analysis">
            {analysisResults ? (
              <TimeAnalysisComponent 
                timeAnalysis={analysisResults.timeAnalysis} 
                transactions={transactions} 
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Data Available</CardTitle>
                  <CardDescription>Please upload transaction data to see time analysis</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
