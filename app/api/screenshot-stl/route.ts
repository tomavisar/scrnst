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

// Create image using OffscreenCanvas (works in Node.js)
async function renderWithCanvas(triangles: number[][], viewName: string) {
  const width = 512
  const height = 512

  console.log(`Rendering ${triangles.length} triangles for ${viewName}`)

  // Use OffscreenCanvas which works in Node.js
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext("2d")!

  // White background
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, width, height)

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

  // Draw triangles
  ctx.fillStyle = "#666666"
  ctx.strokeStyle = "#333333"
  ctx.lineWidth = 1

  let trianglesDrawn = 0
  for (const triangle of triangles) {
    ctx.beginPath()

    // First vertex
    const x1 = width / 2 + (triangle[0] - centerX) * scale
    const y1 = height / 2 - (triangle[1] - centerY) * scale
    ctx.moveTo(x1, y1)

    // Second vertex
    const x2 = width / 2 + (triangle[3] - centerX) * scale
    const y2 = height / 2 - (triangle[4] - centerY) * scale
    ctx.lineTo(x2, y2)

    // Third vertex
    const x3 = width / 2 + (triangle[6] - centerX) * scale
    const y3 = height / 2 - (triangle[7] - centerY) * scale
    ctx.lineTo(x3, y3)

    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    trianglesDrawn++
  }

  console.log(`Drew ${trianglesDrawn} triangles`)

  // Convert to blob then to base64
  const blob = await canvas.convertToBlob({ type: "image/png" })
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString("base64")

  return `data:image/png;base64,${base64}`
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
    console.log("=== CANVAS-BASED STL RENDERER ===")

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

    // Generate single view using Canvas
    const screenshot = await renderWithCanvas(triangles, "front")

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
      message: "Canvas-based STL Screenshot API",
      status: "operational",
    },
    { headers: corsHeaders },
  )
}
