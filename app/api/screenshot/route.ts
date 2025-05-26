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
    const index = searchParams.get("index")

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

    // Helper function to upload base64 to Vercel Blob
    const uploadToBlob = async (screenshot: any, idx: number) => {
      // If already has a direct URL, return it
      if (screenshot.directUrl) {
        return screenshot.directUrl
      }

      try {
        // Convert base64 to buffer
        const base64Data = screenshot.image.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")

        // Upload to Vercel Blob
        const blob = await put(
          `stl-screenshots/${jobId}/${idx}-${screenshot.label.replace(/\s+/g, "-").toLowerCase()}.png`,
          buffer,
          {
            contentType: "image/png",
            access: "public",
          },
        )

        // Store the URL for future use
        screenshot.directUrl = blob.url
        return blob.url
      } catch (uploadError) {
        console.error("Error uploading to Vercel Blob:", uploadError)
        // Return the original base64 as fallback
        return screenshot.image
      }
    }

    // If index is provided, return that specific screenshot
    if (index !== null) {
      const idx = Number.parseInt(index, 10)
      if (isNaN(idx) || idx < 0 || idx >= job.screenshots.length) {
        return NextResponse.json(
          { error: "Invalid screenshot index" },
          {
            status: 400,
            headers: corsHeaders(),
          },
        )
      }

      const screenshot = job.screenshots[idx]
      const imageUrl = await uploadToBlob(screenshot, idx)

      return NextResponse.json(
        {
          success: true,
          screenshot: {
            image: imageUrl,
            label: screenshot.label,
          },
        },
        { headers: corsHeaders() },
      )
    }

    // Otherwise return the first screenshot
    const screenshot = job.screenshots[0]
    const imageUrl = await uploadToBlob(screenshot, 0)

    return NextResponse.json(
      {
        success: true,
        screenshot: {
          image: imageUrl,
          label: screenshot.label,
        },
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in screenshot route:", error)
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}
