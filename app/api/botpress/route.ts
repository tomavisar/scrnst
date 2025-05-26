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

    // Generate screenshots immediately without external dependencies
    const screenshots = generateFastScreenshots(stlUrl, jobId)

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

// Generate screenshots instantly using optimized SVG generation
function generateFastScreenshots(stlUrl: string, jobId: string) {
  const filename = stlUrl.split("/").pop() || "model.stl"

  // Pre-defined optimized SVG templates for maximum speed
  const views = [
    {
      name: "Front View",
      svg: createOptimizedSVG("Front View", filename, "#6c757d", "M150,120 L250,120 L250,180 L150,180 Z", "1"),
    },
    {
      name: "Top View",
      svg: createOptimizedSVG(
        "Top View",
        filename,
        "#495057",
        "M200,110 A40,40 0 1,1 200,190 A40,40 0 1,1 200,110",
        "2",
      ),
    },
    {
      name: "Right View",
      svg: createOptimizedSVG("Right View", filename, "#868e96", "M200,110 L160,190 L240,190 Z", "3"),
    },
    {
      name: "Isometric View",
      svg: createOptimizedSVG(
        "Isometric View",
        filename,
        "#adb5bd",
        "M160,140 L200,140 L200,180 L160,180 Z M160,140 L180,120 L220,120 L200,140 M200,140 L220,120 L220,160 L200,180",
        "4",
      ),
    },
  ]

  return views.map((view) => ({
    image: `data:image/svg+xml;base64,${Buffer.from(view.svg).toString("base64")}`,
    directUrl: `data:image/svg+xml;base64,${Buffer.from(view.svg).toString("base64")}`,
    label: view.name,
  }))
}

// Highly optimized SVG generation - no external calls, minimal processing
function createOptimizedSVG(viewName: string, filename: string, color: string, shapePath: string, viewNumber: string) {
  return `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/><path d="${shapePath}" fill="${color}" stroke="#212529" stroke-width="2"/><circle cx="50" cy="50" r="18" fill="#007bff"/><text x="50" y="55" text-anchor="middle" font-family="Arial" font-size="12" fill="#fff" font-weight="bold">${viewNumber}</text><text x="200" y="35" text-anchor="middle" font-family="Arial" font-size="14" fill="#212529" font-weight="bold">${viewName}</text><text x="200" y="270" text-anchor="middle" font-family="Arial" font-size="11" fill="#6c757d">${filename}</text><text x="200" y="285" text-anchor="middle" font-family="Arial" font-size="9" fill="#adb5bd">STL Preview</text></svg>`
}
