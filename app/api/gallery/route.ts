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
    // In a real app, you would fetch this data from a database
    // For this example, we're using the in-memory processingJobs object

    // Clean up old jobs (older than 24 hours)
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000

    Object.keys(processingJobs).forEach((jobId) => {
      if (now - processingJobs[jobId].startTime > oneDayMs) {
        delete processingJobs[jobId]
      }
    })

    return NextResponse.json(
      {
        success: true,
        jobs: processingJobs,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error fetching gallery:", error)
    return NextResponse.json(
      { error: "Failed to fetch gallery" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}
