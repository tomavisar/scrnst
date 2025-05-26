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
  const startTime = Date.now()

  try {
    const { stlUrl, apiKey } = await request.json()

    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    const jobId = uuidv4()

    // Take REAL screenshots using Puppeteer
    const screenshots = await takeRealScreenshots(stlUrl, jobId)

    const processingTime = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Real screenshots captured successfully",
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

async function takeRealScreenshots(stlUrl: string, jobId: string) {
  try {
    console.log("Starting Puppeteer to take REAL screenshots...")

    // Import Puppeteer
    const puppeteer = await import("puppeteer")

    // Launch browser
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 800 })

    // Navigate to your working STL viewer
    const baseUrl = process.env.NEXT_PUBLIC_URL || "https://v0-3d-model-screenshots.vercel.app"
    const viewerUrl = `${baseUrl}?url=${encodeURIComponent(stlUrl)}`

    console.log("Loading STL viewer page:", viewerUrl)
    await page.goto(viewerUrl, { waitUntil: "networkidle0", timeout: 60000 })

    // Wait for the STL to load
    console.log("Waiting for STL model to load...")
    await page.waitForTimeout(10000) // Wait 10 seconds for model to load

    // Switch to viewer tab
    await page.click('[data-value="viewer"]')
    await page.waitForTimeout(2000)

    // Wait for the 3D canvas to be ready
    await page.waitForSelector("canvas", { timeout: 30000 })
    await page.waitForTimeout(3000)

    console.log("Taking screenshots of the actual 3D model...")

    // Take multiple screenshots by rotating the model
    const screenshots = []
    const cameraPositions = [
      { name: "Front View", script: "window.stlViewerRef?.setCamera?.(0, 0, 5)" },
      { name: "Top View", script: "window.stlViewerRef?.setCamera?.(0, 5, 0)" },
      { name: "Right View", script: "window.stlViewerRef?.setCamera?.(5, 0, 0)" },
      { name: "Isometric", script: "window.stlViewerRef?.setCamera?.(3, 3, 3)" },
    ]

    for (let i = 0; i < cameraPositions.length; i++) {
      const position = cameraPositions[i]

      try {
        // Try to set camera position (if the viewer supports it)
        await page.evaluate(position.script)
        await page.waitForTimeout(1000)

        // Take screenshot of the canvas area
        const canvas = await page.$("canvas")
        if (canvas) {
          const screenshotBuffer = await canvas.screenshot({ type: "png" })

          // Upload to Vercel Blob
          const blob = await put(
            `stl-screenshots/${jobId}/${i}-${position.name.replace(/\s+/g, "-").toLowerCase()}.png`,
            screenshotBuffer,
            {
              contentType: "image/png",
              access: "public",
            },
          )

          screenshots.push({
            image: blob.url,
            directUrl: blob.url,
            label: position.name,
          })

          console.log(`✅ Captured ${position.name}: ${blob.url}`)
        }
      } catch (error) {
        console.error(`Error capturing ${position.name}:`, error)
      }
    }

    await browser.close()

    if (screenshots.length === 0) {
      throw new Error("No screenshots were captured")
    }

    console.log(`✅ Successfully captured ${screenshots.length} REAL screenshots`)
    return screenshots
  } catch (error) {
    console.error("Error taking real screenshots:", error)
    throw new Error(`Failed to capture real screenshots: ${error.message}`)
  }
}
