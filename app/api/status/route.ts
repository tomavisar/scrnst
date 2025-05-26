import { type NextRequest, NextResponse } from "next/server"
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json(
        { error: "No job ID provided" },
        {
          status: 400,
          headers: corsHeaders(),
        },
      )
    }

    const job = processingJobs[jobId]
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        {
          status: 404,
          headers: corsHeaders(),
        },
      )
    }

    // Check for stalled jobs (older than 5 minutes)
    if (job.status === "processing" && Date.now() - job.startTime > 5 * 60 * 1000) {
      job.status = "failed"
      job.message = "Processing timed out"
      job.error = "The job took too long to complete"
    }

    return NextResponse.json(job, { headers: corsHeaders() })
  } catch (error) {
    console.error("Error in status route:", error)
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}
