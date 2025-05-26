import { type NextRequest, NextResponse } from "next/server"
import puppeteer from "puppeteer"
import { put } from "@vercel/blob"

// This endpoint uses Puppeteer to render the STL file in a headless browser
export async function POST(request: NextRequest) {
  let browser = null

  try {
    const { stlUrl, jobId } = await request.json()

    if (!stlUrl || !jobId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()

    // Set viewport size
    await page.setViewport({ width: 1200, height: 900 })

    // Navigate to the viewer with the STL URL
    const viewerUrl = `${process.env.NEXT_PUBLIC_URL || "https://v0-3d-model-screenshots.vercel.app"}?url=${encodeURIComponent(stlUrl)}&headless=true`
    await page.goto(viewerUrl, { waitUntil: "networkidle0" })

    // Wait for the model to load
    await page.waitForTimeout(5000)

    // Define camera positions
    const cameraPositions = [
      { name: "front", rotation: { x: 0, y: 0, z: 0 } },
      { name: "back", rotation: { x: 0, y: Math.PI, z: 0 } },
      { name: "left", rotation: { x: 0, y: Math.PI / 2, z: 0 } },
      { name: "right", rotation: { x: 0, y: -Math.PI / 2, z: 0 } },
      { name: "top", rotation: { x: -Math.PI / 2, y: 0, z: 0 } },
      { name: "bottom", rotation: { x: Math.PI / 2, y: 0, z: 0 } },
    ]

    const screenshots = []

    // Capture screenshots from different angles
    for (const position of cameraPositions) {
      // Execute JavaScript to rotate the camera
      await page.evaluate((pos) => {
        // This assumes the viewer exposes a global function to set camera position
        if (window.setCameraPosition) {
          window.setCameraPosition(pos.rotation)
        }
      }, position)

      // Wait for the camera to update
      await page.waitForTimeout(500)

      // Take screenshot
      const screenshot = await page.screenshot({
        type: "png",
        encoding: "base64",
      })

      // Upload to Vercel Blob
      const buffer = Buffer.from(screenshot, "base64")
      const blob = await put(`stl-screenshots/${jobId}/${position.name}.png`, buffer, {
        contentType: "image/png",
        access: "public",
      })

      screenshots.push({
        image: `data:image/png;base64,${screenshot}`,
        directUrl: blob.url,
        label: position.name.charAt(0).toUpperCase() + position.name.slice(1) + " View",
      })
    }

    await browser.close()

    return NextResponse.json({
      success: true,
      screenshots,
    })
  } catch (error) {
    console.error("Error rendering STL:", error)

    if (browser) {
      await browser.close()
    }

    return NextResponse.json({ error: "Failed to render STL file" }, { status: 500 })
  }
}
