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
    const { stlUrl, jobId: existingJobId } = await request.json()

    if (!stlUrl) {
      return NextResponse.json(
        { error: "No STL URL provided" },
        {
          status: 400,
          headers: corsHeaders(),
        },
      )
    }

    // Use existing job ID or create a new one
    const jobId = existingJobId || uuidv4()

    // Initialize or update the job
    if (!existingJobId) {
      processingJobs[jobId] = {
        status: "pending",
        progress: 0,
        message: "Preparing to capture screenshots",
        startTime: Date.now(),
        fileUrl: stlUrl,
      }
    } else if (processingJobs[jobId]) {
      processingJobs[jobId].status = "processing"
      processingJobs[jobId].progress = 50
      processingJobs[jobId].message = "Capturing screenshots"
    } else {
      return NextResponse.json(
        { error: "Job not found" },
        {
          status: 404,
          headers: corsHeaders(),
        },
      )
    }

    // Start processing in the background
    captureScreenshots(stlUrl, jobId).catch((error) => {
      console.error("Background processing error:", error)
      processingJobs[jobId].status = "failed"
      processingJobs[jobId].message = "Screenshot capture failed"
      processingJobs[jobId].error = error.message
    })

    // Return immediately with the job ID
    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Screenshot capture started",
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in capture-screenshots route:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}

async function captureScreenshots(stlUrl: string, jobId: string) {
  try {
    // Update job status
    processingJobs[jobId].status = "processing"
    processingJobs[jobId].message = "Setting up 3D renderer"
    processingJobs[jobId].progress = 60

    // Simulate screenshot generation with a delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    processingJobs[jobId].progress = 80
    processingJobs[jobId].message = "Capturing views"

    // Simulate more processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Generate mock screenshots (in a real app, you'd generate these from the 3D model)
    const screenshots = [
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        label: "Top Front Right",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        label: "Top Front Left",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        label: "Bottom Front Right",
      },
      {
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        label: "Bottom Front Left",
      },
    ]

    processingJobs[jobId].screenshots = screenshots
    processingJobs[jobId].status = "completed"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "Screenshot capture completed"

    // In a production app, you would store this data in a database
  } catch (error) {
    console.error("Error capturing screenshots:", error)
    processingJobs[jobId].status = "failed"
    processingJobs[jobId].message = "Screenshot capture failed"
    processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
    processingJobs[jobId].progress = 0
  }
}
