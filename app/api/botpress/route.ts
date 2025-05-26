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

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { stlUrl, apiKey } = await request.json()

    // Quick validation
    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    // Optional API key validation
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    const jobId = uuidv4()

    // Use the frontend to capture screenshots
    const screenshots = await captureScreenshotsFromFrontend(stlUrl, jobId)

    const processingTime = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Processing completed successfully",
        screenshots: screenshots,
        firstScreenshot: screenshots[0],
        processingTimeMs: processingTime,
      },
      { headers: corsHeaders() },
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

// Capture screenshots by calling the frontend component
async function captureScreenshotsFromFrontend(stlUrl: string, jobId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || "https://v0-3d-model-screenshots.vercel.app"

    // Call the frontend page with auto-capture enabled
    const frontendUrl = `${baseUrl}?url=${encodeURIComponent(stlUrl)}&autoCapture=true&jobId=${jobId}`

    console.log("Calling frontend for screenshot capture:", frontendUrl)

    // Wait for the frontend to process and capture screenshots
    let attempts = 0
    const maxAttempts = 30 // 60 seconds total

    while (attempts < maxAttempts) {
      attempts++

      // Wait 2 seconds between checks
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Check if screenshots are ready
      const statusResponse = await fetch(`${baseUrl}/api/screenshots?jobId=${jobId}`)

      if (statusResponse.ok) {
        const result = await statusResponse.json()

        if (result.success && result.screenshots && result.screenshots.length > 0) {
          console.log(`✅ Screenshots captured successfully after ${attempts * 2} seconds`)
          return result.screenshots
        }
      }

      console.log(`Waiting for screenshots... attempt ${attempts}`)
    }

    throw new Error("Timeout waiting for screenshots")
  } catch (error) {
    console.error("Error capturing screenshots from frontend:", error)
    throw error
  }
}
