import { type NextRequest, NextResponse } from "next/server"
import { Buffer } from "buffer"
import { PNG } from "pngjs"

// Enhanced STL parser with multiple fallback strategies
function parseSTL(buffer: ArrayBuffer) {
  console.log(`Parsing STL file, buffer size: ${buffer.byteLength} bytes`)

  if (buffer.byteLength < 5) {
    throw new Error("File too small to be a valid STL file")
  }

  // Try multiple parsing strategies
  const strategies = [
    () => parseAsDetectedFormat(buffer),
    () => parseAsASCII(buffer),
    () => parseAsBinaryWithRepair(buffer),
  ]

  let lastError: Error | null = null

  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`Trying parsing strategy ${i + 1}...`)
      const result = strategies[i]()
      if (result.vertices.length > 0) {
        console.log(`Strategy ${i + 1} succeeded!`)
        return result
      }
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error instanceof Error ? error.message : "Unknown error")
      lastError = error instanceof Error ? error : new Error("Unknown error")
    }
  }

  throw new Error(`All parsing strategies failed. Last error: ${lastError?.message || "Unknown error"}`)
}

// Strategy 1: Parse based on detected format
function parseAsDetectedFormat(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const header = new TextDecoder().decode(buffer.slice(0, 5))

  if (header === "solid") {
    return parseASCIISTL(buffer)
  } else {
    return parseBinarySTLSafe(buffer)
  }
}

// Strategy 2: Force ASCII parsing
function parseAsASCII(buffer: ArrayBuffer) {
  console.log("Forcing ASCII STL parsing...")
  return parseASCIISTL(buffer)
}

// Strategy 3: Binary with repair attempts
function parseAsBinaryWithRepair(buffer: ArrayBuffer) {
  console.log("Attempting binary STL with repair...")

  if (buffer.byteLength < 84) {
    throw new Error("File too small for binary STL")
  }

  const maxPossibleTriangles = Math.floor((buffer.byteLength - 84) / 50)
  console.log(`Maximum possible triangles based on file size: ${maxPossibleTriangles}`)

  if (maxPossibleTriangles <= 0) {
    throw new Error("File too small to contain triangles")
  }

  return parseBinarySTLWithCount(buffer, maxPossibleTriangles)
}

// Safe binary STL parser
function parseBinarySTLSafe(buffer: ArrayBuffer) {
  if (buffer.byteLength < 84) {
    throw new Error("Binary STL file too small")
  }

  const view = new DataView(buffer)
  let offset = 80

  const triangleCount = view.getUint32(offset, true)
  offset += 4

  console.log(`Binary STL claims ${triangleCount} triangles`)

  if (triangleCount > 10000000) {
    throw new Error(`Unrealistic triangle count: ${triangleCount}`)
  }

  if (triangleCount === 0) {
    throw new Error("STL file claims to have 0 triangles")
  }

  const expectedSize = 84 + triangleCount * 50
  if (buffer.byteLength < expectedSize) {
    const actualTriangleCount = Math.floor((buffer.byteLength - 84) / 50)
    console.log(`File size mismatch, trying with ${actualTriangleCount} triangles`)
    return parseBinarySTLWithCount(buffer, actualTriangleCount)
  }

  return parseBinarySTLWithCount(buffer, triangleCount)
}

// Helper function to parse binary STL with a specific triangle count
function parseBinarySTLWithCount(buffer: ArrayBuffer, triangleCount: number) {
  const view = new DataView(buffer)
  let offset = 84
  const vertices: number[] = []

  console.log(`Parsing ${triangleCount} triangles from binary STL`)

  for (let i = 0; i < triangleCount; i++) {
    if (offset + 50 > buffer.byteLength) {
      console.warn(`Reached end of file at triangle ${i}`)
      break
    }

    // Skip normal (12 bytes)
    offset += 12

    // Read 3 vertices (36 bytes)
    for (let j = 0; j < 3; j++) {
      if (offset + 12 > buffer.byteLength) break

      const x = view.getFloat32(offset, true)
      const y = view.getFloat32(offset + 4, true)
      const z = view.getFloat32(offset + 8, true)
      offset += 12

      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        vertices.push(x, y, z)
      }
    }

    // Skip attribute bytes (2 bytes)
    offset += 2
  }

  const actualTriangles = vertices.length / 9
  console.log(`Binary parsing: ${actualTriangles} triangles, ${vertices.length / 3} vertices`)

  return { vertices, triangleCount: actualTriangles }
}

// Enhanced ASCII STL parser
function parseASCIISTL(buffer: ArrayBuffer) {
  try {
    const text = new TextDecoder().decode(buffer)
    console.log(`Text content preview: "${text.substring(0, 100)}..."`)

    const lines = text.split(/\r?\n/)
    const vertices: number[] = []
    let triangleCount = 0

    const hasSTLKeywords = text.includes("vertex") || text.includes("facet") || text.includes("normal")

    if (!hasSTLKeywords) {
      throw new Error("No STL keywords found in file")
    }

    console.log("STL keywords detected, proceeding with ASCII parsing")

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim()

      if (line === "endfacet" || line.includes("endfacet")) {
        triangleCount++
        continue
      }

      if (line.startsWith("vertex") || line.includes("vertex")) {
        const numbers = line.match(/-?\d+\.?\d*([eE][+-]?\d+)?/g)
        if (numbers && numbers.length >= 3) {
          const x = Number.parseFloat(numbers[numbers.length - 3])
          const y = Number.parseFloat(numbers[numbers.length - 2])
          const z = Number.parseFloat(numbers[numbers.length - 1])

          if (isFinite(x) && isFinite(y) && isFinite(z)) {
            vertices.push(x, y, z)
          }
        }
      }
    }

    console.log(`ASCII STL: ${triangleCount} triangles, ${vertices.length / 3} vertices`)

    if (vertices.length === 0) {
      throw new Error("No valid vertices found")
    }

    return { vertices, triangleCount: Math.max(triangleCount, vertices.length / 9) }
  } catch (error) {
    throw new Error(`ASCII parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Generate 16 distinct camera positions with names
function generateNamedCameraPositions(radius = 5) {
  const positions: Array<{
    x: number
    y: number
    z: number
    name: string
    description: string
  }> = [
    { x: radius, y: 0, z: 0, name: "right", description: "Right Side View" },
    { x: -radius, y: 0, z: 0, name: "left", description: "Left Side View" },
    { x: 0, y: radius, z: 0, name: "top", description: "Top View" },
    { x: 0, y: -radius, z: 0, name: "bottom", description: "Bottom View" },
    { x: 0, y: 0, z: radius, name: "front", description: "Front View" },
    { x: 0, y: 0, z: -radius, name: "back", description: "Back View" },
    { x: radius * 0.7, y: radius * 0.7, z: radius * 0.7, name: "iso_1", description: "Isometric View 1" },
    { x: -radius * 0.7, y: radius * 0.7, z: radius * 0.7, name: "iso_2", description: "Isometric View 2" },
    { x: radius * 0.7, y: radius * 0.7, z: -radius * 0.7, name: "iso_3", description: "Isometric View 3" },
    { x: -radius * 0.7, y: radius * 0.7, z: -radius * 0.7, name: "iso_4", description: "Isometric View 4" },
    { x: radius * 0.7, y: -radius * 0.7, z: radius * 0.7, name: "corner_1", description: "Bottom Corner 1" },
    { x: -radius * 0.7, y: -radius * 0.7, z: radius * 0.7, name: "corner_2", description: "Bottom Corner 2" },
    { x: radius * 0.7, y: -radius * 0.7, z: -radius * 0.7, name: "corner_3", description: "Bottom Corner 3" },
    { x: -radius * 0.7, y: -radius * 0.7, z: -radius * 0.7, name: "corner_4", description: "Bottom Corner 4" },
    { x: radius * 0.9, y: radius * 0.3, z: 0, name: "angle_1", description: "Angled Right View" },
    { x: 0, y: radius * 0.3, z: radius * 0.9, name: "angle_2", description: "Angled Front View" },
  ]

  return positions
}

// PNG renderer using pngjs library - FIXED VERSION
async function renderModelAsPNG(
  vertices: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} as PNG`)

    if (vertices.length === 0) {
      throw new Error("No vertices to render")
    }

    // Create PNG instance
    const png = new PNG({ width, height })

    // Fill with white background
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2
        png.data[idx] = 255 // R
        png.data[idx + 1] = 255 // G
        png.data[idx + 2] = 255 // B
        png.data[idx + 3] = 255 // A
      }
    }

    // Calculate bounding box
    let minX = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY,
      maxZ = Number.NEGATIVE_INFINITY

    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i])
      maxX = Math.max(maxX, vertices[i])
      minY = Math.min(minY, vertices[i + 1])
      maxY = Math.max(maxY, vertices[i + 1])
      minZ = Math.min(minZ, vertices[i + 2])
      maxZ = Math.max(maxZ, vertices[i + 2])
    }

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2
    const maxDimension = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

    if (maxDimension === 0) {
      throw new Error("Model has zero dimensions")
    }

    const scale = (Math.min(width, height) * 0.8) / maxDimension

    // Simple orthographic projection - FIXED
    for (let i = 0; i < vertices.length; i += 9) {
      const triangle = []

      // Get triangle vertices
      for (let j = 0; j < 3; j++) {
        const x = vertices[i + j * 3] - centerX
        const y = vertices[i + j * 3 + 1] - centerY
        const z = vertices[i + j * 3 + 2] - centerZ

        // Project to 2D based on camera view
        let screenX, screenY

        switch (cameraPos.name) {
          case "front":
          case "back":
            screenX = x * scale
            screenY = y * scale
            break
          case "right":
          case "left":
            screenX = z * scale
            screenY = y * scale
            break
          case "top":
          case "bottom":
            screenX = x * scale
            screenY = z * scale
            break
          default:
            // Isometric views
            screenX = (x + z * 0.5) * scale
            screenY = (y + z * 0.3) * scale
            break
        }

        triangle.push([Math.round(width / 2 + screenX), Math.round(height / 2 - screenY)])
      }

      // Draw triangle wireframe in black
      if (triangle.length === 3) {
        drawLinePNG(png, triangle[0], triangle[1])
        drawLinePNG(png, triangle[1], triangle[2])
        drawLinePNG(png, triangle[2], triangle[0])
      }
    }

    console.log(`Successfully rendered ${cameraPos.name} as PNG`)

    // Convert to base64
    const pngBuffer = PNG.sync.write(png)
    const base64 = Buffer.from(pngBuffer).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`

    return {
      dataUrl,
      name: cameraPos.name,
      description: cameraPos.description,
    }
  } catch (error) {
    console.error(`Error rendering ${cameraPos.name}:`, error)

    // Create error PNG
    const png = new PNG({ width, height })

    // Fill with light gray
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2
        png.data[idx] = 200
        png.data[idx + 1] = 200
        png.data[idx + 2] = 200
        png.data[idx + 3] = 255
      }
    }

    const pngBuffer = PNG.sync.write(png)
    const base64 = Buffer.from(pngBuffer).toString("base64")

    return {
      dataUrl: `data:image/png;base64,${base64}`,
      name: cameraPos.name,
      description: `Error: ${cameraPos.description}`,
    }
  }
}

// Simple line drawing for PNG
function drawLinePNG(png: PNG, start: number[], end: number[]) {
  const [x0, y0] = start
  const [x1, y1] = end

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  let x = x0
  let y = y0

  while (true) {
    if (x >= 0 && x < png.width && y >= 0 && y < png.height) {
      const idx = (png.width * y + x) << 2
      png.data[idx] = 0 // Black line
      png.data[idx + 1] = 0
      png.data[idx + 2] = 0
      png.data[idx + 3] = 255
    }

    if (x === x1 && y === y1) break

    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
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
    console.log("Starting STL processing...")

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

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`)

    // Parse STL file
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
      console.log(`Successfully read file into buffer: ${arrayBuffer.byteLength} bytes`)
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    let vertices: number[], triangleCount: number
    try {
      const result = parseSTL(arrayBuffer)
      vertices = result.vertices
      triangleCount = result.triangleCount
      console.log(`Parsed STL: ${triangleCount} triangles, ${vertices.length / 3} vertices`)
    } catch (parseError) {
      console.error("STL parsing error:", parseError)
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json(
        {
          error: "Invalid STL file format",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 400, headers: corsHeaders },
      )
    }

    if (vertices.length === 0) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "Invalid STL file - no geometry found" }, { status: 400, headers: corsHeaders })
    }

    // Generate camera positions
    const cameraPositions = generateNamedCameraPositions(5)
    console.log("Generated camera positions:", cameraPositions.length)

    // Render screenshots as PNG
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    for (let i = 0; i < cameraPositions.length; i++) {
      console.log(`Rendering view ${i + 1}/${cameraPositions.length}: ${cameraPositions[i].name}`)

      try {
        const result = await renderModelAsPNG(vertices, cameraPositions[i], 512, 512, i)
        screenshots.push(result.dataUrl)
        viewNames.push(result.name)
        viewDescriptions.push(result.description)
        console.log(`Successfully rendered ${result.name}`)
      } catch (renderError) {
        console.error(`Error rendering view ${i + 1}:`, renderError)

        // Create error PNG
        const png = new PNG({ width: 512, height: 512 })
        for (let y = 0; y < 512; y++) {
          for (let x = 0; x < 512; x++) {
            const idx = (512 * y + x) << 2
            png.data[idx] = 200
            png.data[idx + 1] = 200
            png.data[idx + 2] = 200
            png.data[idx + 3] = 255
          }
        }

        const pngBuffer = PNG.sync.write(png)
        const base64 = Buffer.from(pngBuffer).toString("base64")
        screenshots.push(`data:image/png;base64,${base64}`)
        viewNames.push(cameraPositions[i].name)
        viewDescriptions.push(`Error: ${cameraPositions[i].description}`)
      }
    }

    console.log("All screenshots generated:", screenshots.length)

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    return NextResponse.json(
      {
        success: true,
        screenshots: screenshots,
        viewNames: viewNames,
        viewDescriptions: viewDescriptions,
        count: screenshots.length,
        filename: file.name,
        triangles: triangleCount,
        views: cameraPositions.map((pos, i) => ({
          index: i + 1,
          name: pos.name,
          description: pos.description,
          position: { x: pos.x, y: pos.y, z: pos.z },
        })),
      },
      {
        headers: corsHeaders,
      },
    )
  } catch (error) {
    console.error("Error processing STL file:", error)

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
      {
        status: 500,
        headers: corsHeaders,
      },
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
      message: "STL Screenshot API is running",
      endpoint: "/api/screenshot-stl",
      method: "POST",
      status: "operational",
      timestamp: new Date().toISOString(),
      version: "10.0.0",
      format: "PNG images",
    },
    {
      headers: corsHeaders,
    },
  )
}
