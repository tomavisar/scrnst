"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import StlViewer from "@/components/stl-viewer"

export default function CapturePage() {
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [screenshots, setScreenshots] = useState<Array<{ image: string; label: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("Loading...")
  const viewerRef = useRef(null)

  useEffect(() => {
    // Get URL parameters
    const params = new URLSearchParams(window.location.search)
    const urlParam = params.get("url")
    const jobIdParam = params.get("jobId")
    const captureParam = params.get("capture")

    if (urlParam) {
      setStlUrl(urlParam)
      setJobId(jobIdParam || `job_${Date.now()}`)

      if (captureParam === "true") {
        // Auto-start capture after model loads
        setTimeout(() => {
          handleCapture()
        }, 8000) // Wait 8 seconds for model to load
      }
    } else {
      setError("No STL URL provided")
    }
  }, [])

  const handleCapture = async () => {
    if (!viewerRef.current || !stlUrl || !jobId) {
      setError("Viewer not ready")
      return
    }

    setIsCapturing(true)
    setStatus("Capturing screenshots...")

    try {
      // Capture screenshots using the working viewer
      const capturedScreenshots = await (viewerRef.current as any).captureScreenshots()

      if (!capturedScreenshots || capturedScreenshots.length === 0) {
        throw new Error("No screenshots captured")
      }

      setScreenshots(capturedScreenshots)
      setStatus("Uploading screenshots...")

      // Send screenshots to API for processing
      const response = await fetch("/api/botpress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stlUrl: stlUrl,
          jobId: jobId,
          screenshots: capturedScreenshots,
          apiKey: "Tla21317462!",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process screenshots")
      }

      const result = await response.json()

      if (result.success) {
        setStatus("✅ Screenshots captured and uploaded successfully!")
        setScreenshots(result.screenshots)

        // Display the first screenshot URL for Botpress
        console.log("=== FOR BOTPRESS ===")
        console.log("Image URL:", result.firstScreenshot.image)
        console.log("Image Title:", result.firstScreenshot.label)

        // Also display in the UI
        const resultDiv = document.getElementById("botpress-result")
        if (resultDiv) {
          resultDiv.innerHTML = `
            <h3>✅ Success! Use these in Botpress:</h3>
            <p><strong>Image URL:</strong> ${result.firstScreenshot.image}</p>
            <p><strong>Image Title:</strong> ${result.firstScreenshot.label}</p>
            <p><strong>Total Screenshots:</strong> ${result.screenshots.length}</p>
          `
        }
      } else {
        throw new Error(result.error || "Processing failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture screenshots")
      setStatus("❌ Capture failed")
    } finally {
      setIsCapturing(false)
    }
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p>{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">STL Screenshot Capture</h1>

      <div className="mb-4 text-center">
        <p className="text-lg">{status}</p>
        {jobId && <p className="text-sm text-gray-600">Job ID: {jobId}</p>}
      </div>

      {stlUrl && (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="h-[500px] w-full">
              <StlViewer stlUrl={stlUrl} ref={viewerRef} />
            </div>
          </Card>

          <div className="flex justify-center mb-6">
            <Button onClick={handleCapture} disabled={isCapturing} className="px-6">
              {isCapturing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                "Capture Screenshots"
              )}
            </Button>
          </div>
        </>
      )}

      <div id="botpress-result" className="mb-6 p-4 bg-gray-50 rounded-lg"></div>

      {screenshots.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {screenshots.map((screenshot, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="relative aspect-square">
                <img
                  src={screenshot.image || "/placeholder.svg"}
                  alt={screenshot.label}
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                  {screenshot.label}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
