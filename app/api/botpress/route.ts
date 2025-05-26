import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { processingJobs } from "@/lib/processing-jobs"

// We'll use a different approach for server-side rendering
// Instead of trying to mock the DOM, we'll use Three.js in headless mode

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
    const { stlUrl, apiKey } = await request.json()

    // Validate input
    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    // Optional API key validation
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    // Create a job ID
    const jobId = uuidv4()

    // Initialize job
    processingJobs[jobId] = {
      id: jobId,
      status: "pending",
      progress: 0,
      message: "Job created",
      startTime: Date.now(),
      fileUrl: stlUrl,
      fileName: stlUrl.split("/").pop() || "unknown.stl",
    }

    // Start processing in the background
    processStlFile(stlUrl, jobId).catch((error) => {
      console.error("Error processing STL file:", error)
      processingJobs[jobId].status = "failed"
      processingJobs[jobId].error = error.message
    })

    // Return immediately with the job ID
    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Processing started",
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in botpress API route:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() })
  }
}

async function processStlFile(stlUrl: string, jobId: string) {
  try {
    // Update job status
    processingJobs[jobId].status = "processing"
    processingJobs[jobId].progress = 10
    processingJobs[jobId].message = "Fetching STL file"

    // Fetch the STL file
    const response = await fetch(stlUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch STL file: ${response.statusText}`)
    }

    processingJobs[jobId].progress = 30
    processingJobs[jobId].message = "Processing STL data"

    // Get the STL data
    const arrayBuffer = await response.arrayBuffer()

    // Since we can't use Three.js with DOM in a server environment,
    // we'll generate mock screenshots instead
    processingJobs[jobId].progress = 70
    processingJobs[jobId].message = "Generating screenshots"

    // Generate mock screenshots with different view labels
    const screenshots = await generateAndUploadScreenshots(jobId, stlUrl)

    // Update job with screenshots
    processingJobs[jobId].progress = 90
    processingJobs[jobId].message = "Finalizing screenshots"
    processingJobs[jobId].screenshots = screenshots

    // Complete the job
    processingJobs[jobId].status = "completed"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "Processing completed"

    return screenshots
  } catch (error) {
    processingJobs[jobId].status = "failed"
    processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
    processingJobs[jobId].progress = 0
    throw error
  }
}

// Helper function to trigger client-side screenshot generation
async function generateAndUploadScreenshots(jobId: string, stlUrl: string) {
  try {
    // Instead of generating placeholders, we'll trigger the client to generate real screenshots
    // For now, return a message indicating the model needs to be viewed in the browser

    const viewerUrl = `${process.env.NEXT_PUBLIC_URL || "https://v0-3d-model-screenshots.vercel.app"}?url=${encodeURIComponent(stlUrl)}&jobId=${jobId}&autoCapture=true`

    // Return a single "screenshot" that's actually a link to view the model
    return [
      {
        image: viewerUrl,
        directUrl: viewerUrl,
        label: "View 3D Model",
        isPlaceholder: true,
      },
    ]
  } catch (error) {
    console.error("Error in generateAndUploadScreenshots:", error)
    throw error
  }
}
