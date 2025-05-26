import { type NextRequest, NextResponse } from "next/server"
import { processingJobs } from "@/lib/processing-jobs"
import { put } from "@vercel/blob"

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
    const { jobId, screenshots } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: "No job ID provided" }, { status: 400, headers: corsHeaders() })
    }

    if (!screenshots || !Array.isArray(screenshots)) {
      return NextResponse.json({ error: "No screenshots provided" }, { status: 400, headers: corsHeaders() })
    }

    const job = processingJobs[jobId]
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: corsHeaders() })
    }

    // Update job status
    job.status = "processing"
    job.progress = 70
    job.message = "Uploading screenshots"

    // Upload screenshots to Vercel Blob
    const uploadedScreenshots = []

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i]

      try {
        // Convert base64 to buffer
        const base64Data = screenshot.image.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")

        // Upload to Vercel Blob
        const blob = await put(
          `stl-screenshots/${jobId}/${i}-${screenshot.label.replace(/\s+/g, "-").toLowerCase()}.png`,
          buffer,
          {
            contentType: "image/png",
            access: "public",
          },
        )

        uploadedScreenshots.push({
          image: blob.url,
          directUrl: blob.url,
          label: screenshot.label,
        })
      } catch (error) {
        console.error(`Error uploading screenshot ${i}:`, error)
        // If upload fails, keep the base64 data
        uploadedScreenshots.push({
          image: screenshot.image,
          directUrl: screenshot.image,
          label: screenshot.label,
        })
      }
    }

    // Update job with screenshots
    job.screenshots = uploadedScreenshots
    job.status = "completed"
    job.progress = 100
    job.message = "Screenshots captured and uploaded successfully"

    return NextResponse.json(
      {
        success: true,
        message: "Screenshots stored successfully",
        screenshots: uploadedScreenshots,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error storing screenshots:", error)
    return NextResponse.json({ error: "Failed to store screenshots" }, { status: 500, headers: corsHeaders() })
  }
}
