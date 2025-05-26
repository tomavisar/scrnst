"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, RefreshCw, Eye, Download } from "lucide-react"

interface Job {
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  message: string
  startTime: number
  fileUrl?: string
  screenshots?: Array<{ image: string; label: string }>
  error?: string
}

export default function GalleryPage() {
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null)

  useEffect(() => {
    fetchAllJobs()
  }, [])

  const fetchAllJobs = async () => {
    try {
      setLoading(true)
      setError(null)

      // In a real app, this would be an API call to get all jobs
      // For this example, we'll use the /api/gallery endpoint
      const response = await fetch("/api/gallery")

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`)
      }

      const data = await response.json()
      setJobs(data.jobs || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery")
      console.error("Error fetching jobs:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchAllJobs()
  }

  const handleViewJob = (jobId: string) => {
    setSelectedJob(jobId)
  }

  const handleViewScreenshot = (imageUrl: string) => {
    setSelectedScreenshot(imageUrl)
  }

  const handleDownloadScreenshot = (imageUrl: string, label: string) => {
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `${label.replace(/\s+/g, "-").toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">STL Model Gallery</h1>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading gallery...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">{error}</div>
      ) : Object.keys(jobs).length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-lg">
          <h3 className="text-xl font-medium text-gray-600 mb-2">No models found</h3>
          <p className="text-gray-500">Upload an STL file to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(jobs).map(([jobId, job]) => (
            <Card key={jobId} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span className="truncate">Job {jobId.substring(0, 8)}...</span>
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
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                {job.screenshots && job.screenshots.length > 0 ? (
                  <div className="aspect-square bg-gray-100 rounded-md overflow-hidden">
                    <img
                      src={job.screenshots[0].image || "/placeholder.svg"}
                      alt={job.screenshots[0].label}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                    <p className="text-gray-500 text-sm">No screenshots available</p>
                  </div>
                )}
                <div className="mt-2">
                  <p className="text-sm text-gray-600">{job.message}</p>
                  {job.status === "processing" && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${job.progress}%` }}></div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleViewJob(jobId)}
                  className="w-full flex items-center justify-center gap-2"
                  disabled={!job.screenshots || job.screenshots.length === 0}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && jobs[selectedJob] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Job Details</h2>
                <Button variant="ghost" onClick={() => setSelectedJob(null)}>
                  ✕
                </Button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Status:</strong> {jobs[selectedJob].status}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Started:</strong> {new Date(jobs[selectedJob].startTime).toLocaleString()}
                </p>
                {jobs[selectedJob].error && (
                  <p className="text-sm text-red-600 mt-2">
                    <strong>Error:</strong> {jobs[selectedJob].error}
                  </p>
                )}
              </div>

              <Tabs defaultValue="screenshots">
                <TabsList className="mb-4">
                  <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                  <TabsTrigger value="model">3D Model</TabsTrigger>
                </TabsList>

                <TabsContent value="screenshots">
                  {jobs[selectedJob].screenshots && jobs[selectedJob].screenshots.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {jobs[selectedJob].screenshots.map((screenshot, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-md overflow-hidden">
                            <img
                              src={screenshot.image || "/placeholder.svg"}
                              alt={screenshot.label}
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={() => handleViewScreenshot(screenshot.image)}
                            />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 bg-white text-gray-800"
                              onClick={() => handleDownloadScreenshot(screenshot.image, screenshot.label)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-center mt-1">{screenshot.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No screenshots available</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="model">
                  {jobs[selectedJob].fileUrl ? (
                    <div className="h-[400px] bg-gray-100 rounded-md">
                      {/* In a real app, you would render the 3D model here */}
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">3D viewer would be rendered here with the model</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No model available</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
    </div>
  )
}
