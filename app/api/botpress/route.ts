import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

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
  const startTime = Date.now()

  try {
    const { stlUrl, apiKey, screenshots } = await request.json()

    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    const jobId = uuidv4()

    // If screenshots are provided (from frontend), process them
    if (screenshots && Array.isArray(screenshots) && screenshots.length > 0) {
      console.log("Processing screenshots from frontend...")

      // Upload the real screenshots to Vercel Blob
      const { put } = await import("@vercel/blob")
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

          console.log(`✅ Uploaded ${screenshot.label}: ${blob.url}`)
        } catch (uploadError) {
          console.error(`Error uploading screenshot ${i}:`, uploadError)
          // Keep original if upload fails
          uploadedScreenshots.push(screenshot)
        }
      }

      const processingTime = Date.now() - startTime

      return NextResponse.json(
        {
          success: true,
          jobId,
          message: "Real screenshots processed successfully",
          screenshots: uploadedScreenshots,
          firstScreenshot: uploadedScreenshots[0],
          processingTimeMs: processingTime,
        },
        { headers: corsHeaders() },
      )
    }

    // If no screenshots provided, return instructions for frontend capture
    return NextResponse.json(
      {
        success: false,
        error: "No screenshots provided",
        message: "Please capture screenshots using the frontend first",
        jobId,
        captureUrl: `${process.env.NEXT_PUBLIC_URL || "https://v0-3d-model-screenshots.vercel.app"}?url=${encodeURIComponent(stlUrl)}&capture=true&jobId=${jobId}`,
      },
      { status: 400, headers: corsHeaders() },
    )
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("API error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Processing failed",
        processingTimeMs: processingTime,
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}
