import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { put } from "@vercel/blob"

// Add CORS headers to all responses
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
    const { screenshots, jobId } = await request.json()

    if (!screenshots || !Array.isArray(screenshots)) {
      return NextResponse.json({ error: "No screenshots provided" }, { status: 400, headers: corsHeaders() })
    }

    const finalJobId = jobId || uuidv4()
    const uploadedScreenshots = []

    console.log(`Uploading ${screenshots.length} screenshots for job ${finalJobId}`)

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i]

      try {
        // Convert base64 to buffer
        const base64Data = screenshot.image.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")

        // Upload to Vercel Blob
        const blob = await put(
          `stl-screenshots/${finalJobId}/${i}-${screenshot.label.replace(/\s+/g, "-").toLowerCase()}.png`,
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

        console.log(`✅ Uploaded ${screenshot.label}: ${blob.url}`)
      } catch (uploadError) {
        console.error(`Error uploading screenshot ${i}:`, uploadError)
        // Keep original if upload fails
        uploadedScreenshots.push(screenshot)
      }
    }

    return NextResponse.json(
      {
        success: true,
        screenshots: uploadedScreenshots,
        jobId: finalJobId,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in capture-direct route:", error)
    return NextResponse.json({ error: "Failed to process screenshots" }, { status: 500, headers: corsHeaders() })
  }
}
