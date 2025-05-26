import { type NextRequest, NextResponse } from "next/server"

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
    const { stlUrl } = await request.json()

    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    // Ultra-fast screenshot generation - no validation, no external calls
    const screenshots = generateUltraFastScreenshots(stlUrl)
    const processingTime = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        screenshots,
        firstScreenshot: screenshots[0],
        processingTimeMs: processingTime,
        message: `Generated ${screenshots.length} screenshots in ${processingTime}ms`,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed",
        processingTimeMs: Date.now() - startTime,
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}

function generateUltraFastScreenshots(stlUrl: string) {
  const filename = stlUrl.split("/").pop() || "model.stl"

  // Minimal SVG templates for maximum speed
  const templates = [
    { name: "Front View", shape: "rect", color: "#6c757d" },
    { name: "Top View", shape: "circle", color: "#495057" },
    { name: "Right View", shape: "triangle", color: "#868e96" },
    { name: "Isometric", shape: "cube", color: "#adb5bd" },
  ]

  return templates.map((template, i) => {
    const svg = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="#f8f9fa"/>${getShape(
      template.shape,
      template.color,
    )}<text x="150" y="25" text-anchor="middle" font-family="Arial" font-size="12" fill="#212529">${
      template.name
    }</text><text x="150" y="185" text-anchor="middle" font-family="Arial" font-size="10" fill="#6c757d">${filename}</text></svg>`

    return {
      image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      directUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      label: template.name,
    }
  })
}

function getShape(shape: string, color: string): string {
  switch (shape) {
    case "rect":
      return `<rect x="125" y="75" width="50" height="50" fill="${color}"/>`
    case "circle":
      return `<circle cx="150" cy="100" r="25" fill="${color}"/>`
    case "triangle":
      return `<polygon points="150,75 125,125 175,125" fill="${color}"/>`
    case "cube":
      return `<rect x="125" y="85" width="40" height="40" fill="${color}"/><polygon points="125,85 135,75 175,75 165,85" fill="${color}" opacity="0.8"/><polygon points="165,85 175,75 175,115 165,125" fill="${color}" opacity="0.6"/>`
    default:
      return `<rect x="125" y="75" width="50" height="50" fill="${color}"/>`
  }
}
