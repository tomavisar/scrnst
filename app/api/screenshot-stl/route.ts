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

// Solid surface renderer with proper 3D camera system
async function renderModelAsPNG(
  vertices: number[],
  normals: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} from position (${cameraPos.x}, ${cameraPos.y}, ${cameraPos.z})`)

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

    // Calculate model center and bounds
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

    const modelCenter = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
    const modelSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

    // Adjust camera distance based on model size
    const distance = modelSize * 2
    const adjustedCameraPos = {
      x: (cameraPos.x * distance) / 5,
      y: (cameraPos.y * distance) / 5,
      z: (cameraPos.z * distance) / 5,
    }
    const eye = [adjustedCameraPos.x, adjustedCameraPos.y, adjustedCameraPos.z]

    // Create camera transformation matrix
    const target = modelCenter
    const up = [0, 1, 0] // Y is up
    const viewMatrix = createLookAtMatrix(eye, target, up)

    // Calculate scale to fit model in view
    const scale = (Math.min(width, height) * 0.8) / modelSize

    // Add debugging information
    console.log(
      `Model bounds: X(${minX.toFixed(2)} to ${maxX.toFixed(2)}), Y(${minY.toFixed(2)} to ${maxY.toFixed(2)}), Z(${minZ.toFixed(2)} to ${maxZ.toFixed(2)})`,
    )
    console.log(
      `Model center: (${modelCenter[0].toFixed(2)}, ${modelCenter[1].toFixed(2)}, ${modelCenter[2].toFixed(2)})`,
    )
    console.log(`Model size: ${modelSize.toFixed(2)}`)
    console.log(`Camera position: (${eye[0].toFixed(2)}, ${eye[1].toFixed(2)}, ${eye[2].toFixed(2)})`)
    console.log(`Scale: ${scale.toFixed(2)}`)

    let trianglesRendered = 0

    // Create depth buffer
    const depthBuffer = new Float32Array(width * height)
    depthBuffer.fill(Number.NEGATIVE_INFINITY)

    // Light direction (from camera position)
    const lightDir = normalize(subtract(eye, target))

    // Render triangles
    for (let i = 0; i < vertices.length; i += 9) {
      const triangle = []

      // Transform each vertex of the triangle
      for (let j = 0; j < 3; j++) {
        const worldPos = [
          vertices[i + j * 3] - modelCenter[0],
          vertices[i + j * 3 + 1] - modelCenter[1],
          vertices[i + j * 3 + 2] - modelCenter[2],
        ]

        // Transform to camera space
        const cameraPos = transformPoint(worldPos, viewMatrix)

        // Project to screen space
        const screenX = Math.round(width / 2 + cameraPos[0] * scale)
        const screenY = Math.round(height / 2 - cameraPos[1] * scale)
        const depth = cameraPos[2]

        triangle.push([screenX, screenY, depth])
      }

      // Get triangle normal for lighting
      let normal = [0, 0, 1]
      if (normals.length > (i / 9) * 3) {
        const normalIndex = (i / 9) * 3
        normal = [normals[normalIndex], normals[normalIndex + 1], normals[normalIndex + 2]]
      }

      // Calculate lighting intensity
      const dotProduct = normal[0] * lightDir[0] + normal[1] * lightDir[1] + normal[2] * lightDir[2]
      const lightIntensity = Math.max(0.3, Math.abs(dotProduct))

      // Calculate color
      const baseColor = 120
      const finalColor = Math.round(baseColor * lightIntensity)

      // Fill triangle
      if (triangle.length === 3) {
        fillTriangle(png, depthBuffer, triangle, [finalColor, finalColor, finalColor + 20])
      }

      trianglesRendered++
      if (trianglesRendered % 100 === 0) {
        console.log(`Rendered ${trianglesRendered} triangles for ${cameraPos.name}`)
      }
    }

    console.log(`Total triangles rendered for ${cameraPos.name}: ${trianglesRendered}`)

    console.log(`Successfully rendered ${cameraPos.name}`)

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
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2
        png.data[idx] = 255
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

// Fill triangle with depth testing
function fillTriangle(png: PNG, depthBuffer: Float32Array, triangle: number[][], color: number[]) {
  const [p1, p2, p3] = triangle

  const minX = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])))
  const maxX = Math.min(png.width - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])))
  const minY = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])))
  const maxY = Math.min(png.height - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle([x, y], [p1[0], p1[1]], [p2[0], p2[1]], [p3[0], p3[1]])) {
        // Calculate depth at this point
        const depth = interpolateDepth([x, y], triangle)
        const depthIndex = y * png.width + x

        // Depth test
        if (depth > depthBuffer[depthIndex]) {
          depthBuffer[depthIndex] = depth

          const idx = (png.width * y + x) << 2
          png.data[idx] = color[0]
          png.data[idx + 1] = color[1]
          png.data[idx + 2] = color[2]
          png.data[idx + 3] = 255
        }
      }
    }
  }
}

// Interpolate depth within triangle
function interpolateDepth(point: number[], triangle: number[][]): number {
  const [p1, p2, p3] = triangle
  const [x, y] = point

  // Barycentric coordinates
  const denom = (p2[1] - p3[1]) * (p1[0] - p3[0]) + (p3[0] - p2[0]) * (p1[1] - p3[1])
  if (Math.abs(denom) < 1e-10) return p1[2]

  const a = ((p2[1] - p3[1]) * (x - p3[0]) + (p3[0] - p2[0]) * (y - p3[1])) / denom
  const b = ((p3[1] - p1[1]) * (x - p3[0]) + (p1[0] - p3[0]) * (y - p3[1])) / denom
  const c = 1 - a - b

  return a * p1[2] + b * p2[2] + c * p3[2]
}

// Point in triangle test
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
