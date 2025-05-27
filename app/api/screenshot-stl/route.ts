import { type NextRequest, NextResponse } from "next/server"

// Simple STL parser
function parseSTL(buffer: ArrayBuffer) {
  console.log(`Parsing STL file, buffer size: ${buffer.byteLength} bytes`)

  const view = new DataView(buffer)
  let offset = 80 // Skip header

  const triangleCount = view.getUint32(offset, true)
  offset += 4

  console.log(`STL has ${triangleCount} triangles`)

  const triangles: number[][] = []

  for (let i = 0; i < triangleCount && offset + 50 <= buffer.byteLength; i++) {
    offset += 12 // Skip normal

    const triangle = []
    for (let j = 0; j < 9; j++) {
      triangle.push(view.getFloat32(offset, true))
      offset += 4
    }

    offset += 2 // Skip attribute
    triangles.push(triangle)
  }

  console.log(`Parsed ${triangles.length} triangles`)
  return triangles
}

// Create a simple bitmap and convert to PNG manually
function createSimplePNG(width: number, height: number, pixels: Uint8Array): string {
  // Create a simple PNG manually (this is a hack but it works)
  const canvas = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    ${pixels
      .map((pixel, i) => {
        if (pixel === 0) return "" // Skip white pixels
        const x = i % width
        const y = Math.floor(i / width)
        return `<rect x="${x}" y="${y}" width="1" height="1" fill="#666"/>`
      })
      .join("")}
  </svg>`

  // Convert SVG to base64
  const base64 = Buffer.from(canvas).toString("base64")
  return `data:image/svg+xml;base64,${base64}`
}

// Simple renderer using manual pixel manipulation
function renderTriangles(triangles: number[][], viewName: string): string {
  const width = 512
  const height = 512

  console.log(`Rendering ${triangles.length} triangles for ${viewName}`)

  // Create pixel buffer (1 = filled, 0 = empty)
  const pixels = new Uint8Array(width * height)

  // Find bounds
  let minX = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY

  for (const triangle of triangles) {
    for (let i = 0; i < 9; i += 3) {
      minX = Math.min(minX, triangle[i])
      maxX = Math.max(maxX, triangle[i])
      minY = Math.min(minY, triangle[i + 1])
      maxY = Math.max(maxY, triangle[i + 1])
    }
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const maxSize = Math.max(maxX - minX, maxY - minY)
  const scale = maxSize > 0 ? (Math.min(width, height) * 0.8) / maxSize : 1

  console.log(`Model bounds: X(${minX.toFixed(2)} to ${maxX.toFixed(2)}), Y(${minY.toFixed(2)} to ${maxY.toFixed(2)})`)
  console.log(`Scale: ${scale.toFixed(2)}`)

  // Draw each triangle
  let trianglesDrawn = 0
  for (const triangle of triangles) {
    // Get screen coordinates
    const points = []
    for (let i = 0; i < 9; i += 3) {
      const x = width / 2 + (triangle[i] - centerX) * scale
      const y = height / 2 - (triangle[i + 1] - centerY) * scale
      points.push([Math.round(x), Math.round(y)])
    }

    // Fill triangle using simple scanline
    fillTriangle(pixels, width, height, points[0], points[1], points[2])
    trianglesDrawn++
  }

  console.log(`Drew ${trianglesDrawn} triangles`)

  // Convert to image
  return createSimplePNG(width, height, pixels)
}

// Simple triangle fill
function fillTriangle(pixels: Uint8Array, width: number, height: number, p1: number[], p2: number[], p3: number[]) {
  const minX = Math.max(0, Math.min(p1[0], p2[0], p3[0]))
  const maxX = Math.min(width - 1, Math.max(p1[0], p2[0], p3[0]))
  const minY = Math.max(0, Math.min(p1[1], p2[1], p3[1]))
  const maxY = Math.min(height - 1, Math.max(p1[1], p2[1], p3[1]))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle([x, y], p1, p2, p3)) {
        pixels[y * width + x] = 1
      }
    }
  }
}

function pointInTriangle(p: number[], a: number[], b: number[], c: number[]): boolean {
  const denom = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  if (Math.abs(denom) < 1e-10) return false

  const alpha = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / denom
  const beta = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / denom
  const gamma = 1 - alpha - beta

  return alpha >= 0 && beta >= 0 && gamma >= 0
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== SVG-BASED STL RENDERER ===")

    const formData = await request.formData()
    const file = formData.get("stl") as File

    if (!file) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "No STL file provided" }, { status: 400, headers: corsHeaders })
    }

    console.log(`File: ${file.name}, size: ${file.size} bytes`)

    // Read file
    const arrayBuffer = await file.arrayBuffer()

    // Parse triangles
    const triangles = parseSTL(arrayBuffer)

    if (triangles.length === 0) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "No triangles found in STL file" }, { status: 400, headers: corsHeaders })
    }

    // Generate screenshot using SVG
    const screenshot = renderTriangles(triangles, "front")

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    return NextResponse.json(
      {
        success: true,
        screenshots: [screenshot],
        viewNames: ["front"],
        viewDescriptions: ["Front View"],
        count: 1,
        filename: file.name,
        triangles: triangles.length,
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error("Error:", error)

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process STL file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders },
    )
  }
}

export async function GET() {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  return NextResponse.json(
    {
      message: "SVG-based STL Screenshot API",
      status: "operational",
    },
    { headers: corsHeaders },
  )
}
