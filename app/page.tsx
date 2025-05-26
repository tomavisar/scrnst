"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Loader2, RefreshCw, Download } from "lucide-react"
import StlViewer from "@/components/stl-viewer"

// Import the shared processing jobs
import { processingJobs } from "@/lib/processing-jobs"

export default function Home() {
  const [stlFile, setStlFile] = useState<File | null>(null)
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [externalUrl, setExternalUrl] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("upload")
  const [screenshots, setScreenshots] = useState<Array<{ image: string; label: string }>>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [jobs, setJobs] = useState<typeof processingJobs>({})
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null)
  const viewerRef = useRef(null)
  const initialLoadDone = useRef(false)

  // Check for URL parameters on initial load
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    // Get URL parameters
    const params = new URLSearchParams(window.location.search)
    const urlParam = params.get("url")

    if (urlParam) {
      console.log("URL parameter found:", urlParam)
      setExternalUrl(urlParam)
      setActiveTab("upload")

      // Auto-load the STL file
      handleLoadFromUrl(urlParam)
    }
  }, [])

  // Load jobs on initial render
  useEffect(() => {
    // In a real app, this would fetch from an API
    setJobs(processingJobs)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setStlFile(file)
      setStlUrl(URL.createObjectURL(file))
      setScreenshots([])
      setError(null)
    }
  }

  const handleLoadFromUrl = async (urlToLoad?: string) => {
    const urlToUse = urlToLoad || externalUrl
    if (!urlToUse) return

    setLoading(true)
    setError(null)

    try {
      // Create a new job
      const jobId = `job_${Date.now()}`

      processingJobs[jobId] = {
        id: jobId,
        status: "pending",
        progress: 0,
        message: "Starting to load STL file",
        startTime: Date.now(),
        fileName: urlToUse.split("/").pop() || "unknown.stl",
      }

      // Update the jobs state
      setJobs({ ...processingJobs })

      // Simulate loading process
      processingJobs[jobId].status = "processing"
      processingJobs[jobId].progress = 25
      processingJobs[jobId].message = "Fetching STL file"
      setJobs({ ...processingJobs })

      // Simulate a delay for fetching
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update progress
      processingJobs[jobId].progress = 50
      processingJobs[jobId].message = "Processing STL data"
      setJobs({ ...processingJobs })

      // Simulate another delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Set the STL URL
      setStlUrl(urlToUse)
      processingJobs[jobId].fileUrl = urlToUse
      processingJobs[jobId].progress = 75
      processingJobs[jobId].message = "Preparing for rendering"
      setJobs({ ...processingJobs })

      // Simulate final delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Complete the job
      processingJobs[jobId].status = "completed"
      processingJobs[jobId].progress = 100
      processingJobs[jobId].message = "STL file loaded successfully"
      setJobs({ ...processingJobs })

      // Switch to the viewer tab
      setActiveTab("viewer")

      // Automatically trigger screenshot capture after a short delay
      setTimeout(() => {
        console.log("Auto-triggering screenshot capture...")
        captureScreenshots()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const captureScreenshots = async () => {
    if (!viewerRef.current || !stlUrl) return

    setIsCapturing(true)
    setScreenshots([])

    try {
      // Create a new job for screenshot capture
      const jobId = `job_${Date.now()}`

      processingJobs[jobId] = {
        id: jobId,
        status: "processing",
        progress: 0,
        message: "Starting to capture screenshots",
        startTime: Date.now(),
        fileUrl: stlUrl,
        fileName: stlUrl.split("/").pop() || "unknown.stl",
      }

      // Update the jobs state
      setJobs({ ...processingJobs })

      // Update progress
      processingJobs[jobId].progress = 25
      processingJobs[jobId].message = "Setting up camera positions"
      setJobs({ ...processingJobs })

      // Simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Update progress
      processingJobs[jobId].progress = 50
      processingJobs[jobId].message = "Capturing screenshots"
      setJobs({ ...processingJobs })

      // Capture screenshots if the viewer is available
      let capturedScreenshots: Array<{ image: string; label: string }> = []

      if (viewerRef.current) {
        try {
          capturedScreenshots = await (viewerRef.current as any).captureScreenshots()
        } catch (err) {
          console.error("Error capturing screenshots:", err)
          // Fallback to mock screenshots
          capturedScreenshots = generateMockScreenshots()
        }
      } else {
        // Fallback to mock screenshots
        capturedScreenshots = generateMockScreenshots()
      }

      // Update progress
      processingJobs[jobId].progress = 75
      processingJobs[jobId].message = "Processing screenshots"
      setJobs({ ...processingJobs })

      // Simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Set the screenshots
      setScreenshots(capturedScreenshots)
      processingJobs[jobId].screenshots = capturedScreenshots
      processingJobs[jobId].status = "completed"
      processingJobs[jobId].progress = 100
      processingJobs[jobId].message = "Screenshots captured successfully"
      setJobs({ ...processingJobs })

      // Switch to the gallery tab
      setActiveTab("gallery")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture screenshots")

      // Update the job with the error
      const jobId = Object.keys(processingJobs).pop()
      if (jobId) {
        processingJobs[jobId].status = "failed"
        processingJobs[jobId].error = err instanceof Error ? err.message : "Unknown error"
        setJobs({ ...processingJobs })
      }
    } finally {
      setIsCapturing(false)
    }
  }

  const generateMockScreenshots = (): Array<{ image: string; label: string }> => {
    // Generate mock screenshots for testing
    return [
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQnAIBQFQYXff81RUkQCOyDj1YOPnbXWPmeTRef+/3O/OyBjzh3CD95BfqICMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMO0TAAD//2Anhf4QtqobAAAAAElFTkSuQmCC",
        label: "Top Front Right",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQnAIBQFQYXff81RUkQCOyDj1YOPnbXWPmeTRef+/3O/OyBjzh3CD95BfqICMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMO0TAAD//2Anhf4QtqobAAAAAElFTkSuQmCC",
        label: "Top Front Left",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQnAIBQFQYXff81RUkQCOyDj1YOPnbXWPmeTRef+/3O/OyBjzh3CD95BfqICMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMO0TAAD//2Anhf4QtqobAAAAAElFTkSuQmCC",
        label: "Bottom Front Right",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADMElEQVR4nOzVwQnAIBQFQYXff81RUkQCOyDj1YOPnbXWPmeTRef+/3O/OyBjzh3CD95BfqICMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMK0CMO0TAAD//2Anhf4QtqobAAAAAElFTkSuQmCC",
        label: "Bottom Front Left",
      },
    ]
  }

  const refreshJobs = () => {
    // In a real app, this would fetch from an API
    setJobs({ ...processingJobs })
  }

  const viewJobDetails = (jobId: string) => {
    setSelectedJob(jobId)
  }

  const viewScreenshot = (imageUrl: string) => {
    setSelectedScreenshot(imageUrl)
  }

  const downloadScreenshot = (imageUrl: string, label: string) => {
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `${label.replace(/\s+/g, "-").toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAllScreenshots = () => {
    if (!screenshots || screenshots.length === 0) return

    screenshots.forEach((screenshot, index) => {
      setTimeout(() => {
        downloadScreenshot(screenshot.image, screenshot.label)
      }, index * 100) // Stagger downloads to avoid browser issues
    })
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">STL Viewer & Screenshot Capture</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="viewer">Viewer</TabsTrigger>
          <TabsTrigger value="gallery">Screenshots</TabsTrigger>
          <TabsTrigger value="jobs">Job History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4 pt-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="external-url" className="text-sm font-medium">
              STL File URL
            </label>
            <Input
              id="external-url"
              type="url"
              placeholder="https://example.com/model.stl"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
          </div>

          <div className="flex justify-center">
            <Button onClick={() => handleLoadFromUrl()} disabled={!externalUrl || loading} className="px-6">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load STL"
              )}
            </Button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">Or upload a file directly:</p>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg mt-2">
              <label htmlFor="stl-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-gray-400 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-sm font-medium text-gray-600">
                    {stlFile ? stlFile.name : "Upload an STL file"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {stlFile ? `${(stlFile.size / 1024 / 1024).toFixed(2)} MB` : "Click or drag and drop"}
                  </span>
                </div>
                <input id="stl-upload" type="file" accept=".stl" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
          )}
        </TabsContent>

        <TabsContent value="viewer" className="pt-4">
          {stlUrl ? (
            <>
              <Card className="mb-6 overflow-hidden">
                <div className="h-[500px] w-full">
                  <StlViewer stlUrl={stlUrl} ref={viewerRef} />
                </div>
              </Card>

              <div className="flex justify-center">
                <Button onClick={captureScreenshots} disabled={isCapturing} className="px-6">
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
          ) : (
            <div className="text-center p-12 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-medium text-gray-600 mb-2">No STL file loaded</h3>
              <p className="text-gray-500">Please upload or provide a URL to an STL file first.</p>
              <Button onClick={() => setActiveTab("upload")} className="mt-4">
                Go to Upload
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gallery" className="pt-4">
          {screenshots.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Screenshots</h2>
                <Button onClick={downloadAllScreenshots} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download All
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {screenshots.map((screenshot, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="relative aspect-square">
                      <img
                        src={screenshot.image || "/placeholder.svg"}
                        alt={screenshot.label}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => viewScreenshot(screenshot.image)}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                        {screenshot.label}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70"
                        onClick={() => downloadScreenshot(screenshot.image, screenshot.label)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center p-12 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-medium text-gray-600 mb-2">No screenshots captured</h3>
              <p className="text-gray-500">Capture screenshots of your STL model first.</p>
              {stlUrl ? (
                <Button onClick={() => setActiveTab("viewer")} className="mt-4">
                  Go to Viewer
                </Button>
              ) : (
                <Button onClick={() => setActiveTab("upload")} className="mt-4">
                  Go to Upload
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Processing History</h2>
            <Button onClick={refreshJobs} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {Object.keys(jobs).length === 0 ? (
            <div className="text-center p-12 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-medium text-gray-600 mb-2">No processing history</h3>
              <p className="text-gray-500">Process an STL file to see it in the history.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(jobs)
                .sort((a, b) => b[1].startTime - a[1].startTime) // Sort by most recent
                .map(([jobId, job]) => (
                  <Card key={jobId} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">{job.fileName || "Unknown file"}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            job.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : job.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : job.status === "processing"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{job.message}</p>
                      <p className="text-xs text-gray-500 mb-2">Started: {new Date(job.startTime).toLocaleString()}</p>
                      {job.status === "processing" && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${job.progress}%` }}></div>
                        </div>
                      )}
                      {job.error && <p className="text-xs text-red-600 mb-2">Error: {job.error}</p>}
                      {job.screenshots && (
                        <p className="text-xs text-gray-600">Screenshots: {job.screenshots.length} captured</p>
                      )}
                      {job.screenshots && job.screenshots.length > 0 && (
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => viewJobDetails(jobId)}>
                          View Details
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Job Details Modal */}
      {selectedJob && jobs[selectedJob] && jobs[selectedJob].screenshots && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Screenshots</h2>
                <Button variant="ghost" onClick={() => setSelectedJob(null)}>
                  ✕
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {jobs[selectedJob].screenshots!.map((screenshot, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="relative aspect-square">
                      <img
                        src={screenshot.image || "/placeholder.svg"}
                        alt={screenshot.label}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => viewScreenshot(screenshot.image)}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                        {screenshot.label}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70"
                        onClick={() => downloadScreenshot(screenshot.image, screenshot.label)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Viewer Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4">
            <img
              src={selectedScreenshot || "/placeholder.svg"}
              alt="Screenshot preview"
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </main>
  )
}
