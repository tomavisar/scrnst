import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { processingJobs } from "@/lib/processing-jobs"

// Add CORS headers to all responses
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: "No URL provided" },
        {
          status: 400,
          headers: corsHeaders(),
        },
      )
    }

    // Create a job ID for tracking
    const jobId = uuidv4()

    // Initialize the job in our tracking system
    processingJobs[jobId] = {
      status: "pending",
      progress: 0,
      message: "Preparing to fetch STL file",
      startTime: Date.now(),
    }

    // Start processing in the background
    processStlFile(url, jobId).catch((error) => {
      console.error("Background processing error:", error)
      processingJobs[jobId].status = "failed"
      processingJobs[jobId].message = "Processing failed"
      processingJobs[jobId].error = error.message
    })

    // Return immediately with the job ID
    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "STL processing started",
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in load-stl route:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}

async function processStlFile(url: string, jobId: string) {
  try {
    // Update job status
    processingJobs[jobId].status = "processing"
    processingJobs[jobId].message = "Fetching STL file"
    processingJobs[jobId].progress = 10

    // Fetch the STL file with a timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch STL: ${response.statusText}`)
    }

    processingJobs[jobId].progress = 40
    processingJobs[jobId].message = "Processing STL file"

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const fileUrl = `data:application/octet-stream;base64,${base64}`

    processingJobs[jobId].progress = 70
    processingJobs[jobId].message = "STL file processed"
    processingJobs[jobId].fileUrl = fileUrl

    // In a real implementation, you would now generate screenshots
    // For this example, we'll simulate it with a delay
    processingJobs[jobId].progress = 90
    processingJobs[jobId].message = "Generating screenshots"

    // Simulate screenshot generation
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Add mock screenshots (in a real app, you'd generate these)
    processingJobs[jobId].screenshots = [
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        label: "Front View",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        label: "Top View",
      },
    ]

    processingJobs[jobId].status = "completed"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "Processing completed"

    // In a production app, you would store this data in a database
  } catch (error) {
    console.error("Error processing STL file:", error)
    processingJobs[jobId].status = "failed"
    processingJobs[jobId].message = "Processing failed"
    processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
    processingJobs[jobId].progress = 0
  }
}
