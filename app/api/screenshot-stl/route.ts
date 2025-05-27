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

// Simple SVG renderer - more reliable than PNG in serverless
async function renderModelAsSVG(
  vertices: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} as SVG`)

    if (vertices.length === 0) {
      throw new Error("No vertices to render")
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

    const scale = (Math.min(width, height) * 0.6) / maxDimension

    // Camera transformation
    let camX = cameraPos.x
    let camY = cameraPos.y
    let camZ = cameraPos.z

    const camDistance = Math.sqrt(camX * camX + camY * camY + camZ * camZ)
    if (camDistance < 1) {
      camX = 5
      camY = 0
      camZ = 0
    }

    const distance = Math.sqrt(camX * camX + camZ * camZ)
    const cosTheta = distance > 0 ? camX / distance : 1
    const sinTheta = distance > 0 ? camZ / distance : 0
    const totalDistance = Math.sqrt(camX * camX + camY * camY + camZ * camZ)
    const cosPhi = totalDistance > 0 ? distance / totalDistance : 1
    const sinPhi = totalDistance > 0 ? camY / totalDistance : 0

    // Start SVG
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="100%" height="100%" fill="white"/>`

    // Project and render triangles
    const projectedTriangles: Array<{
      points: [number, number][]
      depth: number
    }> = []

    for (let i = 0; i < vertices.length; i += 9) {
      const v1 = [vertices[i] - centerX, vertices[i + 1] - centerY, vertices[i + 2] - centerZ]
      const v2 = [vertices[i + 3] - centerX, vertices[i + 4] - centerY, vertices[i + 5] - centerZ]
      const v3 = [vertices[i + 6] - centerX, vertices[i + 7] - centerY, vertices[i + 8] - centerZ]

      const rotatedVertices = [v1, v2, v3].map((v) => {
        const x1 = v[0] * cosTheta - v[2] * sinTheta
        const z1 = v[0] * sinTheta + v[2] * cosTheta
        const y1 = v[1]

        const y2 = y1 * cosPhi - z1 * sinPhi
        const z2 = y1 * sinPhi + z1 * cosPhi

        return [x1, y2, z2]
      })

      const screenPoints: [number, number][] = rotatedVertices.map((v) => [
        width / 2 + v[0] * scale,
        height / 2 - v[1] * scale,
      ])

      const avgDepth = (rotatedVertices[0][2] + rotatedVertices[1][2] + rotatedVertices[2][2]) / 3

      projectedTriangles.push({
        points: screenPoints,
        depth: avgDepth,
      })
    }

    // Sort by depth
    projectedTriangles.sort((a, b) => a.depth - b.depth)

    // Render triangles as SVG polygons
    projectedTriangles.forEach((triangle) => {
      const { points, depth } = triangle

      const normalizedDepth = Math.max(0, Math.min(1, (depth + maxDimension) / (2 * maxDimension)))
      const brightness = Math.floor(80 + normalizedDepth * 120)

      const pointsStr = points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")

      svg += `<polygon points="${pointsStr}" fill="rgb(${brightness},${brightness},${Math.floor(
        brightness * 1.1,
      )})" stroke="rgb(${Math.floor(brightness * 0.6)},${Math.floor(brightness * 0.6)},${Math.floor(
        brightness * 0.7,
      )})" stroke-width="0.2"/>`
    })

    // Add label
    svg += `<rect x="10" y="10" width="120" height="35" fill="rgba(0,0,0,0.8)"/>`
    svg += `<text x="15" y="25" fill="white" font-family="Arial" font-size="12" font-weight="bold">${
      index + 1
    }. ${cameraPos.name.toUpperCase()}</text>`
    svg += `<text x="15" y="38" fill="white" font-family="Arial" font-size="10">${cameraPos.description}</text>`

    svg += `</svg>`

    console.log(`Successfully rendered ${cameraPos.name} as SVG`)

    // Convert SVG to base64 data URL
    const base64 = Buffer.from(svg).toString("base64")
    const dataUrl = `data:image/svg+xml;base64,${base64}`

    return {
      dataUrl,
      name: cameraPos.name,
      description: cameraPos.description,
    }
  } catch (error) {
    console.error(`Error rendering ${cameraPos.name}:`, error)

    // Simple error SVG
    const errorSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="lightgray"/>
      <text x="${width / 2}" y="${height / 2 - 20}" text-anchor="middle" font-family="Arial" font-size="16" fill="red">Render Error</text>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial" font-size="14">${
        cameraPos.name
      }</text>
    </svg>`

    const base64 = Buffer.from(errorSvg).toString("base64")
    return {
      dataUrl: `data:image/svg+xml;base64,${base64}`,
      name: cameraPos.name,
      description: `Error: ${cameraPos.description}`,
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

    // Render screenshots as SVG
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    for (let i = 0; i < cameraPositions.length; i++) {
      console.log(`Rendering view ${i + 1}/${cameraPositions.length}: ${cameraPositions[i].name}`)

      try {
        const result = await renderModelAsSVG(vertices, cameraPositions[i], 512, 512, i)
        screenshots.push(result.dataUrl)
        viewNames.push(result.name)
        viewDescriptions.push(result.description)
        console.log(`Successfully rendered ${result.name}`)
      } catch (renderError) {
        console.error(`Error rendering view ${i + 1}:`, renderError)

        const errorSvg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="lightgray"/>
          <text x="256" y="256" text-anchor="middle" font-family="Arial" font-size="20">Error: ${cameraPositions[i].name}</text>
        </svg>`

        const base64 = Buffer.from(errorSvg).toString("base64")
        screenshots.push(`data:image/svg+xml;base64,${base64}`)
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
      version: "4.0.0",
      format: "SVG images",
    },
    {
      headers: corsHeaders,
    },
  )
}
