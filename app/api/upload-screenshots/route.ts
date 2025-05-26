import { type NextRequest, NextResponse } from "next/server"
import { processingJobs } from "@/lib/processing-jobs"
import { put } from "@vercel/blob"

// Add CORS headers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, screenshots } = await request.json()

    if (!jobId || !screenshots || !Array.isArray(screenshots)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400, headers: corsHeaders() })
    }

    const job = processingJobs[jobId]
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: corsHeaders() })
    }

    // Upload each screenshot to Vercel Blob
    const uploadedScreenshots = []

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i]

      try {
        // Convert base64 to buffer
        const base64Data = screenshot.image.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")

        // Upload to Vercel Blob as PNG
        const blob = await put(
          `stl-screenshots/${jobId}/${i}-${screenshot.label.replace(/\s+/g, "-").toLowerCase()}.png`,
          buffer,
          {
            contentType: "image/png",
            access: "public",
          },
        )

        uploadedScreenshots.push({
          image: screenshot.image, // Keep original for fallback
          directUrl: blob.url,
          label: screenshot.label,
        })

        console.log(`Uploaded screenshot ${i}: ${blob.url}`)
      } catch (error) {
        console.error(`Error uploading screenshot ${i}:`, error)
        uploadedScreenshots.push(screenshot)
      }
    }

    // Update the job with real screenshots
    processingJobs[jobId].screenshots = uploadedScreenshots
    processingJobs[jobId].status = "completed"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "Screenshots captured successfully"

    return NextResponse.json(
      {
        success: true,
        screenshots: uploadedScreenshots,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error uploading screenshots:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() })
  }
}
