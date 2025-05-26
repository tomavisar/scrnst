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

    // Initialize job - but don't generate screenshots yet
    processingJobs[jobId] = {
      id: jobId,
      status: "pending",
      progress: 0,
      message: "Job created - ready for screenshot capture",
      startTime: Date.now(),
      fileUrl: stlUrl,
      fileName: stlUrl.split("/").pop() || "unknown.stl",
    }

    // Start basic processing (just validate the STL file)
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
        message: "STL file ready for processing",
        viewerUrl: `${process.env.NEXT_PUBLIC_URL || "https://v0-3d-model-screenshots.vercel.app"}?url=${encodeURIComponent(stlUrl)}&jobId=${jobId}&autoCapture=true`,
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
    processingJobs[jobId].message = "Validating STL file"

    // Just validate that the STL file exists and is accessible
    const response = await fetch(stlUrl, { method: "HEAD" })

    if (!response.ok) {
      throw new Error(`Failed to access STL file: ${response.statusText}`)
    }

    processingJobs[jobId].progress = 50
    processingJobs[jobId].message = "STL file validated - ready for screenshot capture"

    // Mark as ready for screenshot capture (not completed yet)
    processingJobs[jobId].status = "ready"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "STL file ready - use the viewer URL to capture screenshots"
  } catch (error) {
    processingJobs[jobId].status = "failed"
    processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
    processingJobs[jobId].progress = 0
    throw error
  }
}
