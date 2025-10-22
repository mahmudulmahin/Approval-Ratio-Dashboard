"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Loader2 } from "lucide-react"
import { parseCSV } from "@/lib/csv-parser"
import type { Transaction } from "@/lib/types"

interface FileUploaderProps {
  onDataLoaded: (data: Transaction[]) => void
  isLoading: boolean
}

export function FileUploader({ onDataLoaded, isLoading }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState<string>("")

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const file = files[0]
      if (!file.name.toLowerCase().endsWith(".csv")) {
        alert("Please upload a CSV file")
        return
      }

      setFileName(file.name)

      try {
        const data = await parseCSV(file)
        onDataLoaded(data)
      } catch (error) {
        console.error("Error parsing CSV:", error)
        alert("Error parsing CSV file. Please check the file format.")
      }
    },
    [onDataLoaded],
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault()
      handleFiles(e.target.files)
    },
    [handleFiles],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Transaction Data</CardTitle>
        <CardDescription>Upload a CSV file containing your transaction data for analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            {isLoading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Processing your file...</p>
                  <p className="text-xs text-muted-foreground">This may take a moment</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  {fileName ? (
                    <FileText className="h-6 w-6 text-primary" />
                  ) : (
                    <Upload className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {fileName ? `Selected: ${fileName}` : "Drop your CSV file here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">Supports CSV files with transaction data</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file-upload" className="sr-only">
                    Choose file
                  </Label>
                  <Input id="file-upload" type="file" accept=".csv" onChange={handleChange} className="hidden" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={isLoading}
                  >
                    Choose File
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {fileName && !isLoading && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              Expected columns: transactionId, merchantOrderId, pspName, country, status, merchantAmount, currency,
              processing_date
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
