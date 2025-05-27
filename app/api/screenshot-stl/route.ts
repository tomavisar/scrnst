import { type NextRequest, NextResponse } from "next/server"

// Simple STL parser with detailed logging
function parseSTL(buffer: ArrayBuffer) {
  try {
    console.log(`=== STL PARSING START ===`)
    console.log(`Buffer size: ${buffer.byteLength} bytes`)

    if (buffer.byteLength < 84) {
      throw new Error(`File too small: ${buffer.byteLength} bytes (minimum 84 bytes for STL)`)
    }

    const view = new DataView(buffer)

    // Read header
    const headerBytes = new Uint8Array(buffer, 0, 80)
    const headerText = new TextDecoder().decode(headerBytes.slice(0, 20))
    console.log(`Header preview: "${headerText}"`)

    let offset = 80

    // Read triangle count
    const triangleCount = view.getUint32(offset, true)
    offset += 4
    console.log(`Triangle count from file: ${triangleCount}`)

    if (triangleCount === 0) {
      throw new Error("STL file claims to have 0 triangles")
    }

    if (triangleCount > 1000000) {
      throw new Error(`Unrealistic triangle count: ${triangleCount}`)
    }

    const expectedSize = 84 + triangleCount * 50
    console.log(`Expected file size: ${expectedSize} bytes, actual: ${buffer.byteLength} bytes`)

    if (buffer.byteLength < expectedSize) {
      const maxTriangles = Math.floor((buffer.byteLength - 84) / 50)
      console.log(`File size mismatch, using ${maxTriangles} triangles instead`)
      return parseTriangles(view, maxTriangles, 84)
    }

    return parseTriangles(view, triangleCount, 84)
  } catch (error) {
    console.error("STL parsing error:", error)
    throw error
  }
}

function parseTriangles(view: DataView, triangleCount: number, startOffset: number) {
  console.log(`=== PARSING ${triangleCount} TRIANGLES ===`)

  const triangles: number[][] = []
  let offset = startOffset

  for (let i = 0; i < triangleCount; i++) {
    if (offset + 50 > view.byteLength) {
      console.log(`Reached end of file at triangle ${i}`)
      break
    }

    // Skip normal (12 bytes)
    offset += 12

    // Read 3 vertices (9 floats = 36 bytes)
    const triangle = []
    for (let j = 0; j < 9; j++) {
      const value = view.getFloat32(offset, true)
      if (!isFinite(value)) {
        console.warn(`Invalid vertex value at triangle ${i}, vertex ${Math.floor(j / 3)}, component ${j % 3}: ${value}`)
      }
      triangle.push(value)
      offset += 4
    }

    // Skip attribute (2 bytes)
    offset += 2

    triangles.push(triangle)

    // Log first few triangles
    if (i < 3) {
      console.log(`Triangle ${i}: [${triangle.map((v) => v.toFixed(2)).join(", ")}]`)
    }
  }

  console.log(`Successfully parsed ${triangles.length} triangles`)
  return triangles
}

// Simple Canvas renderer with detailed logging
async function renderWithCanvas(triangles: number[][], viewName: string) {
  try {
    console.log(`=== RENDERING START ===`)
    console.log(`Triangles to render: ${triangles.length}`)
    console.log(`View: ${viewName}`)

    const width = 512
    const height = 512

    // Check if OffscreenCanvas is available
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas not available in this environment")
    }

    console.log("Creating OffscreenCanvas...")
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      throw new Error("Failed to get 2D context from OffscreenCanvas")
    }

    console.log("Canvas created successfully")

    // White background
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, width, height)
    console.log("Background filled")

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

    console.log(
      `Model bounds: X(${minX.toFixed(2)} to ${maxX.toFixed(2)}), Y(${minY.toFixed(2)} to ${maxY.toFixed(2)})`,
    )

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const maxSize = Math.max(maxX - minX, maxY - minY)
    const scale = maxSize > 0 ? (Math.min(width, height) * 0.8) / maxSize : 1

    console.log(`Center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`)
    console.log(`Max size: ${maxSize.toFixed(2)}`)
    console.log(`Scale: ${scale.toFixed(2)}`)

    // Draw triangles
    ctx.fillStyle = "#666666"
    ctx.strokeStyle = "#333333"
    ctx.lineWidth = 1

    let trianglesDrawn = 0
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i]

      ctx.beginPath()

      // Project vertices to screen coordinates
      const x1 = width / 2 + (triangle[0] - centerX) * scale
      const y1 = height / 2 - (triangle[1] - centerY) * scale
      const x2 = width / 2 + (triangle[3] - centerX) * scale
      const y2 = height / 2 - (triangle[4] - centerY) * scale
      const x3 = width / 2 + (triangle[6] - centerX) * scale
      const y3 = height / 2 - (triangle[7] - centerY) * scale

      // Log first few triangles
      if (i < 3) {
        console.log(
          `Triangle ${i} screen coords: (${x1.toFixed(1)},${y1.toFixed(1)}) (${x2.toFixed(1)},${y2.toFixed(1)}) (${x3.toFixed(1)},${y3.toFixed(1)})`,
        )
      }

      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x3, y3)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      trianglesDrawn++
    }

    console.log(`Drew ${trianglesDrawn} triangles`)

    // Convert to blob
    console.log("Converting canvas to blob...")
    const blob = await canvas.convertToBlob({ type: "image/png" })
    console.log(`Blob created, size: ${blob.size} bytes`)

    // Convert to base64
    console.log("Converting blob to base64...")
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    console.log(`Base64 created, length: ${base64.length}`)

    return `data:image/png;base64,${base64}`
  } catch (error) {
    console.error("Rendering error:", error)
    throw error
  }
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
    console.log("=== API REQUEST START ===")

    const formData = await request.formData()
    const file = formData.get("stl") as File

    if (!file) {
      console.error("No file provided")
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "No STL file provided" }, { status: 400, headers: corsHeaders })
    }

    console.log(`File received: ${file.name}, size: ${file.size} bytes, type: ${file.type}`)

    // Read file
    console.log("Reading file to ArrayBuffer...")
    const arrayBuffer = await file.arrayBuffer()
    console.log(`ArrayBuffer created, size: ${arrayBuffer.byteLength} bytes`)

    // Parse triangles
    console.log("Parsing STL...")
    const triangles = parseSTL(arrayBuffer)

    if (triangles.length === 0) {
      console.error("No triangles parsed")
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "No triangles found in STL file" }, { status: 400, headers: corsHeaders })
    }

    // Render
    console.log("Starting render...")
    const screenshot = await renderWithCanvas(triangles, "front")
    console.log("Render completed")

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    const response = {
      success: true,
      screenshots: [screenshot],
      viewNames: ["front"],
      viewDescriptions: ["Front View"],
      count: 1,
      filename: file.name,
      triangles: triangles.length,
    }

    console.log("=== API REQUEST SUCCESS ===")
    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error("=== API REQUEST FAILED ===")
    console.error("Error details:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

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
        stack: error instanceof Error ? error.stack : undefined,
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
      message: "Detailed logging STL Screenshot API",
      status: "operational",
      timestamp: new Date().toISOString(),
    },
    { headers: corsHeaders },
  )
}
