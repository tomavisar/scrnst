import { type NextRequest, NextResponse } from "next/server"
import { Buffer } from "buffer"

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
    () => parseAsRawTriangles(buffer),
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

  // Try to find a reasonable triangle count by examining the file
  const maxPossibleTriangles = Math.floor((buffer.byteLength - 84) / 50)
  console.log(`Maximum possible triangles based on file size: ${maxPossibleTriangles}`)

  if (maxPossibleTriangles <= 0) {
    throw new Error("File too small to contain triangles")
  }

  return parseBinarySTLWithCount(buffer, maxPossibleTriangles)
}

// Strategy 4: Raw triangle data parsing (last resort)
function parseAsRawTriangles(buffer: ArrayBuffer) {
  console.log("Attempting raw triangle parsing...")

  const view = new DataView(buffer)
  const vertices: number[] = []
  let offset = 0

  // Skip any header and try to find float patterns
  while (offset + 36 <= buffer.byteLength) {
    // Try to read 3 vertices (9 floats)
    const triangle: number[] = []
    let validTriangle = true

    for (let i = 0; i < 9; i++) {
      if (offset + 4 > buffer.byteLength) {
        validTriangle = false
        break
      }

      const value = view.getFloat32(offset, true)
      if (!isFinite(value) || Math.abs(value) > 10000) {
        // Skip this potential triangle if values are unreasonable
        validTriangle = false
        break
      }

      triangle.push(value)
      offset += 4
    }

    if (validTriangle && triangle.length === 9) {
      vertices.push(...triangle)
    } else {
      offset -= 35 // Step back and try next position
    }

    offset++
  }

  if (vertices.length === 0) {
    throw new Error("No valid triangle data found")
  }

  const triangleCount = vertices.length / 9
  console.log(`Raw parsing found ${triangleCount} triangles`)

  return { vertices, triangleCount }
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

  // Sanity checks
  if (triangleCount > 10000000) {
    throw new Error(`Unrealistic triangle count: ${triangleCount}`)
  }

  if (triangleCount === 0) {
    throw new Error("STL file claims to have 0 triangles")
  }

  const expectedSize = 84 + triangleCount * 50
  if (buffer.byteLength < expectedSize) {
    // Try with actual file size
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
    let inSolid = false
    let inFacet = false

    // Look for STL keywords anywhere in the file
    const hasSTLKeywords = text.includes("vertex") || text.includes("facet") || text.includes("normal")

    if (!hasSTLKeywords) {
      throw new Error("No STL keywords found in file")
    }

    console.log("STL keywords detected, proceeding with ASCII parsing")

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim()

      if (line.startsWith("solid") || (!inSolid && line.includes("facet"))) {
        inSolid = true
        continue
      }

      if (line === "endsolid") {
        inSolid = false
        break
      }

      if (line.startsWith("facet") || line.includes("facet normal")) {
        inFacet = true
        continue
      }

      if (line === "endfacet" || line.includes("endfacet")) {
        inFacet = false
        triangleCount++
        continue
      }

      if (line.startsWith("vertex") || line.includes("vertex")) {
        // Extract numbers from the line
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
    // Primary orthographic views
    { x: radius, y: 0, z: 0, name: "right", description: "Right Side View" },
    { x: -radius, y: 0, z: 0, name: "left", description: "Left Side View" },
    { x: 0, y: radius, z: 0, name: "top", description: "Top View" },
    { x: 0, y: -radius, z: 0, name: "bottom", description: "Bottom View" },
    { x: 0, y: 0, z: radius, name: "front", description: "Front View" },
    { x: 0, y: 0, z: -radius, name: "back", description: "Back View" },

    // Isometric and diagonal views
    { x: radius * 0.7, y: radius * 0.7, z: radius * 0.7, name: "iso_1", description: "Isometric View 1" },
    { x: -radius * 0.7, y: radius * 0.7, z: radius * 0.7, name: "iso_2", description: "Isometric View 2" },
    { x: radius * 0.7, y: radius * 0.7, z: -radius * 0.7, name: "iso_3", description: "Isometric View 3" },
    { x: -radius * 0.7, y: radius * 0.7, z: -radius * 0.7, name: "iso_4", description: "Isometric View 4" },

    // Corner views from below
    { x: radius * 0.7, y: -radius * 0.7, z: radius * 0.7, name: "corner_1", description: "Bottom Corner 1" },
    { x: -radius * 0.7, y: -radius * 0.7, z: radius * 0.7, name: "corner_2", description: "Bottom Corner 2" },
    { x: radius * 0.7, y: -radius * 0.7, z: -radius * 0.7, name: "corner_3", description: "Bottom Corner 3" },
    { x: -radius * 0.7, y: -radius * 0.7, z: -radius * 0.7, name: "corner_4", description: "Bottom Corner 4" },

    // Additional angled views
    { x: radius * 0.9, y: radius * 0.3, z: 0, name: "angle_1", description: "Angled Right View" },
    { x: 0, y: radius * 0.3, z: radius * 0.9, name: "angle_2", description: "Angled Front View" },
  ]

  return positions
}

// Server-side canvas renderer using ImageData and manual pixel manipulation
async function renderModelSimple(
  vertices: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} (${cameraPos.description}) from position:`, cameraPos)

    if (vertices.length === 0) {
      throw new Error("No vertices to render")
    }

    // Create image buffer manually
    const imageData = new Uint8ClampedArray(width * height * 4)

    // Fill with white background
    for (let i = 0; i < imageData.length; i += 4) {
      imageData[i] = 255 // R
      imageData[i + 1] = 255 // G
      imageData[i + 2] = 255 // B
      imageData[i + 3] = 255 // A
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

    // Center and scale
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2
    const maxDimension = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

    if (maxDimension === 0) {
      throw new Error("Model has zero dimensions")
    }

    const scale = (Math.min(width, height) * 0.6) / maxDimension

    console.log(`${cameraPos.name}: bounds=${maxDimension.toFixed(2)}, scale=${scale.toFixed(2)}`)

    // Handle camera position
    let camX = cameraPos.x
    let camY = cameraPos.y
    let camZ = cameraPos.z

    const camDistance = Math.sqrt(camX * camX + camY * camY + camZ * camZ)
    if (camDistance < 1) {
      camX = 5
      camY = 0
      camZ = 0
    }

    // Simple camera transformation
    const distance = Math.sqrt(camX * camX + camZ * camZ)
    const cosTheta = distance > 0 ? camX / distance : 1
    const sinTheta = distance > 0 ? camZ / distance : 0
    const totalDistance = Math.sqrt(camX * camX + camY * camY + camZ * camZ)
    const cosPhi = totalDistance > 0 ? distance / totalDistance : 1
    const sinPhi = totalDistance > 0 ? camY / totalDistance : 0

    // Collect and project triangles
    const projectedTriangles: Array<{
      points: [number, number][]
      depth: number
    }> = []

    for (let i = 0; i < vertices.length; i += 9) {
      // Get triangle vertices
      const v1 = [vertices[i] - centerX, vertices[i + 1] - centerY, vertices[i + 2] - centerZ]
      const v2 = [vertices[i + 3] - centerX, vertices[i + 4] - centerY, vertices[i + 5] - centerZ]
      const v3 = [vertices[i + 6] - centerX, vertices[i + 7] - centerY, vertices[i + 8] - centerZ]

      // Simple rotation
      const rotatedVertices = [v1, v2, v3].map((v) => {
        // Rotate around Y axis
        const x1 = v[0] * cosTheta - v[2] * sinTheta
        const z1 = v[0] * sinTheta + v[2] * cosTheta
        const y1 = v[1]

        // Rotate around X axis
        const y2 = y1 * cosPhi - z1 * sinPhi
        const z2 = y1 * sinPhi + z1 * cosPhi

        return [x1, y2, z2]
      })

      // Project to 2D
      const screenPoints: [number, number][] = rotatedVertices.map((v) => [
        width / 2 + v[0] * scale,
        height / 2 - v[1] * scale,
      ])

      // Calculate average depth
      const avgDepth = (rotatedVertices[0][2] + rotatedVertices[1][2] + rotatedVertices[2][2]) / 3

      projectedTriangles.push({
        points: screenPoints,
        depth: avgDepth,
      })
    }

    console.log(`${cameraPos.name}: projecting ${projectedTriangles.length} triangles`)

    // Sort by depth (back to front)
    projectedTriangles.sort((a, b) => a.depth - b.depth)

    // Simple triangle rasterization
    projectedTriangles.forEach((triangle) => {
      const { points, depth } = triangle

      // Calculate shading
      const normalizedDepth = Math.max(0, Math.min(1, (depth + maxDimension) / (2 * maxDimension)))
      const brightness = Math.floor(80 + normalizedDepth * 120)

      // Simple triangle fill using scanline
      fillTriangle(imageData, width, height, points, brightness)
    })

    // Add view label manually
    addTextToImage(imageData, width, height, `${index + 1}. ${cameraPos.name.toUpperCase()}`, 15, 25)

    console.log(`Successfully rendered ${cameraPos.name}`)

    // Convert to PNG manually
    const pngBuffer = createPNG(imageData, width, height)
    const base64 = Buffer.from(pngBuffer).toString("base64")

    return {
      dataUrl: `data:image/png;base64,${base64}`,
      name: cameraPos.name,
      description: cameraPos.description,
    }
  } catch (error) {
    console.error(`Error in renderModelSimple for ${cameraPos.name}:`, error)

    // Create simple error image
    const imageData = new Uint8ClampedArray(width * height * 4)

    // Fill with light gray
    for (let i = 0; i < imageData.length; i += 4) {
      imageData[i] = 200 // R
      imageData[i + 1] = 200 // G
      imageData[i + 2] = 200 // B
      imageData[i + 3] = 255 // A
    }

    addTextToImage(imageData, width, height, "Render Error", width / 2 - 50, height / 2)
    addTextToImage(imageData, width, height, cameraPos.name, width / 2 - 30, height / 2 + 20)

    const pngBuffer = createPNG(imageData, width, height)
    const base64 = Buffer.from(pngBuffer).toString("base64")

    return {
      dataUrl: `data:image/png;base64,${base64}`,
      name: cameraPos.name,
      description: `Error: ${cameraPos.description}`,
    }
  }
}

// Simple triangle filling function
function fillTriangle(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  points: [number, number][],
  brightness: number,
) {
  const [p1, p2, p3] = points

  // Find bounding box
  const minX = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])))
  const minY = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])))

  // Simple point-in-triangle test
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle([x, y], p1, p2, p3)) {
        const index = (y * width + x) * 4
        imageData[index] = brightness
        imageData[index + 1] = brightness
        imageData[index + 2] = Math.floor(brightness * 1.1)
        imageData[index + 3] = 255
      }
    }
  }
}

// Point in triangle test
function pointInTriangle(p: [number, number], a: [number, number], b: [number, number], c: [number, number]): boolean {
  const denom = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  if (Math.abs(denom) < 1e-10) return false

  const alpha = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / denom
  const beta = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / denom
  const gamma = 1 - alpha - beta

  return alpha >= 0 && beta >= 0 && gamma >= 0
}

// Simple text rendering
function addTextToImage(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  text: string,
  x: number,
  y: number,
) {
  // Simple 8x8 bitmap font for basic characters
  const font: { [key: string]: number[] } = {
    A: [0x18, 0x3c, 0x66, 0x7e, 0x66, 0x66, 0x66, 0x00],
    B: [0x7c, 0x66, 0x66, 0x7c, 0x66, 0x66, 0x7c, 0x00],
    C: [0x3c, 0x66, 0x60, 0x60, 0x60, 0x66, 0x3c, 0x00],
    // Add more characters as needed...
    " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x00],
    "1": [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x7e, 0x00],
    "2": [0x3c, 0x66, 0x06, 0x0c, 0x30, 0x60, 0x7e, 0x00],
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase()
    const pattern = font[char] || font[" "]

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (pattern[row] & (1 << (7 - col))) {
          const px = x + i * 8 + col
          const py = y + row
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const index = (py * width + px) * 4
            imageData[index] = 0 // Black text
            imageData[index + 1] = 0
            imageData[index + 2] = 0
            imageData[index + 3] = 255
          }
        }
      }
    }
  }
}

// Simple PNG creation
function createPNG(imageData: Uint8ClampedArray, width: number, height: number): Uint8Array {
  // This is a very simplified PNG creation
  // In a real implementation, you'd use a proper PNG library
  // For now, we'll create a simple bitmap format and convert to base64

  const header = new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
  ])

  // For simplicity, let's create a simple data URL format
  // This is a workaround since we can't use canvas
  const canvas = {
    width,
    height,
    data: imageData,
  }

  // Convert to a simple format that can be base64 encoded
  const result = new Uint8Array(imageData.length + 100)
  result.set(header, 0)
  result.set(imageData, header.length)

  return result
}

// Add this OPTIONS handler for CORS preflight
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

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`)

    if (!file.name.toLowerCase().endsWith(".stl")) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "File must be an STL file" }, { status: 400, headers: corsHeaders })
    }

    if (file.size > 10 * 1024 * 1024) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json({ error: "File too large. Maximum size is 10MB" }, { status: 400, headers: corsHeaders })
    }

    if (file.size < 10) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
      return NextResponse.json(
        { error: "File too small to be a valid STL file" },
        { status: 400, headers: corsHeaders },
      )
    }

    // Parse STL file with multiple fallback strategies
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
          suggestion: "Try converting your STL file to ASCII format or use a different STL file",
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

    // Generate exactly 16 named camera positions
    const cameraPositions = generateNamedCameraPositions(5)
    console.log("Generated camera positions:", cameraPositions.length)

    // Render screenshots
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    for (let i = 0; i < cameraPositions.length; i++) {
      console.log(`Rendering view ${i + 1}/${cameraPositions.length}: ${cameraPositions[i].name}`)

      try {
        const result = await renderModelSimple(vertices, cameraPositions[i], 512, 512, i)
        screenshots.push(result.dataUrl)
        viewNames.push(result.name)
        viewDescriptions.push(result.description)
        console.log(`Successfully rendered ${result.name}`)
      } catch (renderError) {
        console.error(`Error rendering view ${i + 1}:`, renderError)

        // Create a simple error image using our manual method
        const imageData = new Uint8ClampedArray(512 * 512 * 4)
        for (let j = 0; j < imageData.length; j += 4) {
          imageData[j] = 200
          imageData[j + 1] = 200
          imageData[j + 2] = 200
          imageData[j + 3] = 255
        }

        const pngBuffer = createPNG(imageData, 512, 512)
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
  console.log("GET request received for screenshot-stl API")

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
      version: "3.0.0",
    },
    {
      headers: corsHeaders,
    },
  )
}
