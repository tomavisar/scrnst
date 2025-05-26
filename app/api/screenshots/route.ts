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

    if (!job.screenshots || job.screenshots.length === 0) {
      return NextResponse.json(
        { error: "No screenshots available for this job" },
        {
          status: 404,
          headers: corsHeaders(),
        },
      )
    }

    // Upload all screenshots to Vercel Blob if not already done
    const screenshotsWithUrls = []

    for (let i = 0; i < job.screenshots.length; i++) {
      const screenshot = job.screenshots[i]

      // If already has a direct URL, use it
      if (screenshot.directUrl) {
        screenshotsWithUrls.push({
          image: screenshot.directUrl,
          label: screenshot.label,
        })
        continue
      }

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

        // Store the URL for future use
        screenshot.directUrl = blob.url

        screenshotsWithUrls.push({
          image: blob.url,
          label: screenshot.label,
        })
      } catch (uploadError) {
        console.error(`Error uploading screenshot ${i}:`, uploadError)
        // Fall back to the original base64 data
        screenshotsWithUrls.push({
          image: screenshot.image,
          label: screenshot.label,
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        screenshots: screenshotsWithUrls,
        jobId: jobId,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in screenshots route:", error)
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}
