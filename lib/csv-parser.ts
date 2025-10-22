import type { Transaction } from "./types"

export async function parseCSV(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string
        const lines = csv.split("\n")

        if (lines.length < 2) {
          reject(new Error("CSV file must have at least a header row and one data row"))
          return
        }

        // Parse header
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

        // Find column indices
        const getColumnIndex = (possibleNames: string[]) => {
          for (const name of possibleNames) {
            const index = headers.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()))
            if (index !== -1) return index
          }
          return -1
        }

        const transactionIdIndex = getColumnIndex(["transactionId", "transaction_id", "id"])
        const merchantOrderIdIndex = getColumnIndex(["merchantOrderId", "merchant_order_id", "orderId", "order_id"])
        const pspNameIndex = getColumnIndex(["pspName", "psp_name", "psp", "provider"])
        const countryIndex = getColumnIndex(["country", "country_code"])
        const statusIndex = getColumnIndex(["status", "transaction_status"])
        const amountIndex = getColumnIndex(["merchantAmount", "merchant_amount", "amount"])
        const currencyIndex = getColumnIndex(["currency", "currency_code"])
        const dateIndex = getColumnIndex(["processing_date", "date", "timestamp", "created_at"])
        const declineReasonIndex = getColumnIndex(["declineReason", "decline_reason", "reason"])

        const transactions: Transaction[] = []

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))

          if (values.length < headers.length) continue

          const transaction: Transaction = {}

          if (transactionIdIndex !== -1) transaction.transactionId = values[transactionIdIndex]
          if (merchantOrderIdIndex !== -1) transaction.merchantOrderId = values[merchantOrderIdIndex]
          if (pspNameIndex !== -1) transaction.pspName = values[pspNameIndex]
          if (countryIndex !== -1) transaction.country = values[countryIndex]
          if (statusIndex !== -1) transaction.status = values[statusIndex]
          if (declineReasonIndex !== -1) transaction.declineReason = values[declineReasonIndex]

          if (amountIndex !== -1) {
            const amount = Number.parseFloat(values[amountIndex])
            if (!isNaN(amount)) transaction.merchantAmount = amount
          }

          if (currencyIndex !== -1) transaction.currency = values[currencyIndex]

          if (dateIndex !== -1) {
            const dateStr = values[dateIndex]
            if (dateStr) {
              const date = new Date(dateStr)
              if (!isNaN(date.getTime())) {
                transaction.processing_date = date
              }
            }
          }

          transactions.push(transaction)
        }

        resolve(transactions)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}
