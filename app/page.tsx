"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, AlertCircle, CheckCircle } from "lucide-react"

export default function APITestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [error, setError] = useState<string>("")
  const [response, setResponse] = useState<any>(null)
  const [apiHealth, setApiHealth] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError("")
    }
  }

  const checkHealth = async () => {
    try {
      const response = await fetch("/api/health")
      const result = await response.json()
      setApiHealth(`API Health: ${result.status} (${result.timestamp})`)
    } catch (err) {
      setApiHealth(`API Health: Error - ${err}`)
    }
  }

  const testGET = async () => {
    try {
      const response = await fetch("/api/screenshot-stl")
      const result = await response.json()
      setResponse(result)
      setError("")
    } catch (err) {
      setError("GET test failed: " + (err instanceof Error ? err.message : "Unknown error"))
    }
  }

  const testAPI = async () => {
    if (!file) {
      setError("Please select an STL file")
      return
    }

    setLoading(true)
    setError("")
    setScreenshots([])
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append("stl", file)

      console.log("Sending request to API...")

      const response = await fetch("/api/screenshot-stl", {
        method: "POST",
        body: formData,
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", response.headers)

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`)
      }

      const result = await response.json()
      console.log("Response data:", result)

      setResponse(result)

      if (result.success) {
        setScreenshots(result.screenshots)
      } else {
        setError(result.error || "Failed to process file")
      }
    } catch (err) {
      console.error("API test error:", err)
      setError("API Error: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  const downloadScreenshot = (dataUrl: string, index: number) => {
    const link = document.createElement("a")
    link.download = `screenshot_${index + 1}.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">STL Screenshot API Test</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>API Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={checkHealth} variant="outline" size="sm">
                Check Health
              </Button>
              <Button onClick={testGET} variant="outline" size="sm">
                Test GET
              </Button>
            </div>
            {apiHealth && <div className="text-sm bg-gray-100 p-2 rounded">{apiHealth}</div>}
            {response && (
              <div className="text-sm bg-blue-50 p-2 rounded">
                <strong>API Response:</strong>
                <pre className="mt-1 text-xs overflow-auto">{JSON.stringify(response, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test File Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="stl-file">Upload STL File</Label>
              <Input id="stl-file" type="file" accept=".stl" onChange={handleFileChange} />
              {file && (
                <div className="text-sm text-gray-600 mt-1">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            <Button onClick={testAPI} disabled={!file || loading} className="w-full">
              {loading ? "Processing..." : "Test API"}
            </Button>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {screenshots.length > 0 && (
              <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded">
                <CheckCircle className="w-4 h-4" />
                Successfully generated {screenshots.length} screenshots
              </div>
            )}
          </CardContent>
        </Card>

        {screenshots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Screenshots ({screenshots.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {screenshots.map((screenshot, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={screenshot || "/placeholder.svg"}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-32 object-cover rounded border"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <Button
                        size="sm"
                        onClick={() => downloadScreenshot(screenshot, index)}
                        className="bg-white text-black hover:bg-gray-100"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-center mt-1">View {index + 1}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
