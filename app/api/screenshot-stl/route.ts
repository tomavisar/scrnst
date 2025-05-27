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
  const normals: number[] = []

  console.log(`Parsing ${triangleCount} triangles from binary STL`)

  for (let i = 0; i < triangleCount; i++) {
    if (offset + 50 > buffer.byteLength) {
      console.warn(`Reached end of file at triangle ${i}`)
      break
    }

    // Read normal (12 bytes)
    const nx = view.getFloat32(offset, true)
    const ny = view.getFloat32(offset + 4, true)
    const nz = view.getFloat32(offset + 8, true)
    offset += 12

    if (isFinite(nx) && isFinite(ny) && isFinite(nz)) {
      normals.push(nx, ny, nz)
    } else {
      normals.push(0, 0, 1) // Default normal
    }

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

  return { vertices, normals, triangleCount: actualTriangles }
}

// Enhanced ASCII STL parser
function parseASCIISTL(buffer: ArrayBuffer) {
  try {
    const text = new TextDecoder().decode(buffer)
    console.log(`Text content preview: "${text.substring(0, 100)}..."`)

    const lines = text.split(/\r?\n/)
    const vertices: number[] = []
    const normals: number[] = []
    let triangleCount = 0
    let currentNormal = [0, 0, 1]

    const hasSTLKeywords = text.includes("vertex") || text.includes("facet") || text.includes("normal")

    if (!hasSTLKeywords) {
      throw new Error("No STL keywords found in file")
    }

    console.log("STL keywords detected, proceeding with ASCII parsing")

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim()

      if (line.startsWith("facet normal")) {
        const numbers = line.match(/-?\d+\.?\d*([eE][+-]?\d+)?/g)
        if (numbers && numbers.length >= 3) {
          currentNormal = [Number.parseFloat(numbers[0]), Number.parseFloat(numbers[1]), Number.parseFloat(numbers[2])]
        }
      }

      if (line === "endfacet" || line.includes("endfacet")) {
        triangleCount++
        normals.push(...currentNormal)
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

    return { vertices, normals, triangleCount: Math.max(triangleCount, vertices.length / 9) }
  } catch (error) {
    throw new Error(`ASCII parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Generate 16 truly distinct camera positions
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
    { x: radius * 0.8, y: radius * 0.6, z: radius * 0.4, name: "iso_1", description: "Isometric View 1" },
    { x: -radius * 0.8, y: radius * 0.6, z: radius * 0.4, name: "iso_2", description: "Isometric View 2" },
    { x: radius * 0.4, y: radius * 0.6, z: -radius * 0.8, name: "iso_3", description: "Isometric View 3" },
    { x: -radius * 0.4, y: radius * 0.6, z: -radius * 0.8, name: "iso_4", description: "Isometric View 4" },
    { x: radius * 0.9, y: -radius * 0.4, z: radius * 0.2, name: "corner_1", description: "Bottom Corner 1" },
    { x: -radius * 0.9, y: -radius * 0.4, z: radius * 0.2, name: "corner_2", description: "Bottom Corner 2" },
    { x: radius * 0.2, y: -radius * 0.4, z: -radius * 0.9, name: "corner_3", description: "Bottom Corner 3" },
    { x: -radius * 0.2, y: -radius * 0.4, z: -radius * 0.9, name: "corner_4", description: "Bottom Corner 4" },
    { x: radius * 0.7, y: radius * 0.2, z: radius * 0.7, name: "angle_1", description: "Angled View 1" },
    { x: -radius * 0.7, y: radius * 0.2, z: -radius * 0.7, name: "angle_2", description: "Angled View 2" },
  ]

  return positions
}

// 3D transformation functions
function createLookAtMatrix(eye: number[], target: number[], up: number[]) {
  const zAxis = normalize(subtract(eye, target))
  const xAxis = normalize(cross(up, zAxis))
  const yAxis = cross(zAxis, xAxis)

  return [xAxis[0], yAxis[0], zAxis[0], xAxis[1], yAxis[1], zAxis[1], xAxis[2], yAxis[2], zAxis[2]]
}

function normalize(v: number[]): number[] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0]
}

function subtract(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function transformPoint(point: number[], matrix: number[]): number[] {
  return [
    point[0] * matrix[0] + point[1] * matrix[1] + point[2] * matrix[2],
    point[0] * matrix[3] + point[1] * matrix[4] + point[2] * matrix[5],
    point[0] * matrix[6] + point[1] * matrix[7] + point[2] * matrix[8],
  ]
}

// Ultra-simple renderer that always works
async function renderModelAsPNG(
  vertices: number[],
  normals: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} - Ultra-simple mode`)

    if (vertices.length === 0) {
      throw new Error("No vertices to render")
    }

    // Create PNG instance
    const png = new PNG({ width, height })

    // Fill with light gray background
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2
        png.data[idx] = 240 // R
        png.data[idx + 1] = 240 // G
        png.data[idx + 2] = 240 // B
        png.data[idx + 3] = 255 // A
      }
    }

    // Calculate model bounds
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
    const modelSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

    console.log(`Model center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`)
    console.log(`Model size: ${modelSize.toFixed(2)}`)

    // Calculate scale to fit in image
    const scale = (Math.min(width, height) * 0.6) / modelSize
    console.log(`Scale: ${scale.toFixed(2)}`)

    let pointsDrawn = 0

    // Draw every vertex as a point first (for debugging)
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] - centerX
      const y = vertices[i + 1] - centerY
      const z = vertices[i + 2] - centerZ

      // Simple orthographic projection based on camera angle
      let screenX, screenY

      if (cameraPos.name === "front") {
        screenX = x
        screenY = y
      } else if (cameraPos.name === "back") {
        screenX = -x
        screenY = y
      } else if (cameraPos.name === "right") {
        screenX = z
        screenY = y
      } else if (cameraPos.name === "left") {
        screenX = -z
        screenY = y
      } else if (cameraPos.name === "top") {
        screenX = x
        screenY = z
      } else if (cameraPos.name === "bottom") {
        screenX = x
        screenY = -z
      } else {
        // Isometric views with distinct angles
        const angle = index * (Math.PI / 8) // Different angle for each view
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        screenX = x * cosA + z * sinA
        screenY = y + (x * sinA - z * cosA) * 0.5
      }

      // Convert to screen coordinates
      const pixelX = Math.round(width / 2 + screenX * scale)
      const pixelY = Math.round(height / 2 - screenY * scale)

      // Draw a small cross for each vertex
      if (pixelX >= 1 && pixelX < width - 1 && pixelY >= 1 && pixelY < height - 1) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = (width * (pixelY + dy) + (pixelX + dx)) << 2
            png.data[idx] = 50 // R
            png.data[idx + 1] = 50 // G
            png.data[idx + 2] = 200 // B (blue points)
            png.data[idx + 3] = 255 // A
          }
        }
        pointsDrawn++
      }
    }

    console.log(`Drew ${pointsDrawn} points for ${cameraPos.name}`)

    // Also draw triangles as wireframes
    let trianglesDrawn = 0
    for (let i = 0; i < vertices.length; i += 9) {
      const triangle = []

      // Get the 3 vertices of the triangle
      for (let j = 0; j < 3; j++) {
        const x = vertices[i + j * 3] - centerX
        const y = vertices[i + j * 3 + 1] - centerY
        const z = vertices[i + j * 3 + 2] - centerZ

        let screenX, screenY

        if (cameraPos.name === "front") {
          screenX = x
          screenY = y
        } else if (cameraPos.name === "back") {
          screenX = -x
          screenY = y
        } else if (cameraPos.name === "right") {
          screenX = z
          screenY = y
        } else if (cameraPos.name === "left") {
          screenX = -z
          screenY = y
        } else if (cameraPos.name === "top") {
          screenX = x
          screenY = z
        } else if (cameraPos.name === "bottom") {
          screenX = x
          screenY = -z
        } else {
          // Isometric views with distinct angles
          const angle = index * (Math.PI / 8)
          const cosA = Math.cos(angle)
          const sinA = Math.sin(angle)
          screenX = x * cosA + z * sinA
          screenY = y + (x * sinA - z * cosA) * 0.5
        }

        const pixelX = Math.round(width / 2 + screenX * scale)
        const pixelY = Math.round(height / 2 - screenY * scale)
        triangle.push([pixelX, pixelY])
      }

      // Draw triangle edges
      if (triangle.length === 3) {
        drawLine(png, triangle[0], triangle[1], [200, 50, 50]) // Red lines
        drawLine(png, triangle[1], triangle[2], [200, 50, 50])
        drawLine(png, triangle[2], triangle[0], [200, 50, 50])
        trianglesDrawn++
      }
    }

    console.log(`Drew ${trianglesDrawn} triangle wireframes for ${cameraPos.name}`)

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

    // Create error PNG with red background
    const png = new PNG({ width, height })
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2
        png.data[idx] = 255
        png.data[idx + 1] = 100
        png.data[idx + 2] = 100
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

// Simple line drawing function
function drawLine(png: PNG, p1: number[], p2: number[], color: number[]) {
  const dx = Math.abs(p2[0] - p1[0])
  const dy = Math.abs(p2[1] - p1[1])
  const sx = p1[0] < p2[0] ? 1 : -1
  const sy = p1[1] < p2[1] ? 1 : -1
  let err = dx - dy

  let x = p1[0]
  let y = p1[1]

  while (true) {
    if (x >= 0 && x < png.width && y >= 0 && y < png.height) {
      const idx = (png.width * y + x) << 2
      png.data[idx] = color[0]
      png.data[idx + 1] = color[1]
      png.data[idx + 2] = color[2]
      png.data[idx + 3] = 255
    }

    if (x === p2[0] && y === p2[1]) break

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

    let vertices: number[], normals: number[], triangleCount: number
    try {
      const result = parseSTL(arrayBuffer)
      vertices = result.vertices
      normals = result.normals || []
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

    // Render screenshots as solid surfaces
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    for (let i = 0; i < cameraPositions.length; i++) {
      console.log(`Rendering view ${i + 1}/${cameraPositions.length}: ${cameraPositions[i].name}`)

      try {
        const result = await renderModelAsPNG(vertices, normals, cameraPositions[i], 512, 512, i)
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
            png.data[idx] = 255
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

    const responseData = {
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
    }

    console.log("Final response data:", {
      success: true,
      screenshotCount: screenshots.length,
      viewNamesCount: viewNames.length,
      firstScreenshotLength: screenshots[0]?.length || 0,
      sampleViewNames: viewNames.slice(0, 3),
    })

    return NextResponse.json(responseData, {
      headers: corsHeaders,
    })
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
      version: "11.0.0",
      format: "PNG images with solid surfaces and lighting",
    },
    {
      headers: corsHeaders,
    },
  )
}
