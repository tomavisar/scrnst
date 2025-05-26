"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download } from "lucide-react"

export default function APITestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [error, setError] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError("")
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

    try {
      const formData = new FormData()
      formData.append("stl", file)

      const response = await fetch("/api/screenshot-stl", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setScreenshots(result.screenshots)
      } else {
        setError(result.error || "Failed to process file")
      }
    } catch (err) {
      setError("Network error: " + (err instanceof Error ? err.message : "Unknown error"))
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
            <CardTitle>API Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Endpoint:</strong> <code>/api/screenshot-stl</code>
            </p>
            <p>
              <strong>Method:</strong> POST
            </p>
            <p>
              <strong>Content-Type:</strong> multipart/form-data
            </p>
            <p>
              <strong>Field Name:</strong> "stl"
            </p>
            <p>
              <strong>Output:</strong> JSON with 16 base64 PNG images
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test the API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="stl-file">Upload STL File</Label>
              <Input id="stl-file" type="file" accept=".stl" onChange={handleFileChange} />
            </div>

            <Button onClick={testAPI} disabled={!file || loading} className="w-full">
              {loading ? "Processing..." : "Generate Screenshots"}
            </Button>

            {error && <div className="text-red-600 text-sm">{error}</div>}
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
