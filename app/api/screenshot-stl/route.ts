import { type NextRequest, NextResponse } from "next/server"

// Simple STL parser for binary STL files
function parseSTL(buffer: ArrayBuffer) {
  const view = new DataView(buffer)

  // Check if it's ASCII STL (starts with "solid")
  const header = new TextDecoder().decode(buffer.slice(0, 5))
  if (header === "solid") {
    return parseASCIISTL(buffer)
  }

  // Parse binary STL
  // Skip 80-byte header
  let offset = 80

  // Read number of triangles
  const triangleCount = view.getUint32(offset, true)
  offset += 4

  const vertices: number[] = []

  for (let i = 0; i < triangleCount; i++) {
    // Skip normal (3 floats)
    offset += 12

    // Read 3 vertices (9 floats total)
    for (let j = 0; j < 3; j++) {
      const x = view.getFloat32(offset, true)
      const y = view.getFloat32(offset + 4, true)
      const z = view.getFloat32(offset + 8, true)
      offset += 12

      vertices.push(x, y, z)
    }

    // Skip attribute byte count
    offset += 2
  }

  return { vertices, triangleCount }
}

// Parse ASCII STL files
function parseASCIISTL(buffer: ArrayBuffer) {
  const text = new TextDecoder().decode(buffer)
  const lines = text.split("\n")

  const vertices: number[] = []
  let triangleCount = 0

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("vertex")) {
      const parts = trimmed.split(/\s+/)
      vertices.push(Number.parseFloat(parts[1]), Number.parseFloat(parts[2]), Number.parseFloat(parts[3]))
    } else if (trimmed === "endfacet") {
      triangleCount++
    }
  }

  return { vertices, triangleCount }
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

// Simple orthographic projection renderer
async function renderModelSimple(
  vertices: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} (${cameraPos.description}) from position:`, cameraPos)

    // Create a regular canvas using a data URL approach
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")!

    // Clear canvas with white background
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, width, height)

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

    // Handle special case for view 1 (right side) - ensure it's not at origin
    let camX = cameraPos.x
    let camY = cameraPos.y
    let camZ = cameraPos.z

    // If camera is too close to origin, move it away
    const camDistance = Math.sqrt(camX * camX + camY * camY + camZ * camZ)
    if (camDistance < 1) {
      camX = 5 // Default to right side view
      camY = 0
      camZ = 0
    }

    // Simple camera transformation (rotate model instead of camera)
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

      // Simple rotation around Y axis then X axis
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

      // Project to 2D (orthographic projection)
      const screenPoints: [number, number][] = rotatedVertices.map((v) => [
        width / 2 + v[0] * scale,
        height / 2 - v[1] * scale, // Flip Y axis
      ])

      // Calculate average depth for sorting
      const avgDepth = (rotatedVertices[0][2] + rotatedVertices[1][2] + rotatedVertices[2][2]) / 3

      projectedTriangles.push({
        points: screenPoints,
        depth: avgDepth,
      })
    }

    console.log(`${cameraPos.name}: projecting ${projectedTriangles.length} triangles`)

    // Sort by depth (back to front)
    projectedTriangles.sort((a, b) => a.depth - b.depth)

    // Draw triangles
    projectedTriangles.forEach((triangle, idx) => {
      const { points, depth } = triangle

      // Calculate shading based on depth
      const normalizedDepth = Math.max(0, Math.min(1, (depth + maxDimension) / (2 * maxDimension)))
      const brightness = Math.floor(80 + normalizedDepth * 120) // 80-200

      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      ctx.lineTo(points[1][0], points[1][1])
      ctx.lineTo(points[2][0], points[2][1])
      ctx.closePath()

      // Fill with shaded color
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${Math.floor(brightness * 1.1)})`
      ctx.fill()

      // Add outline
      ctx.strokeStyle = `rgb(${Math.floor(brightness * 0.6)}, ${Math.floor(brightness * 0.6)}, ${Math.floor(brightness * 0.7)})`
      ctx.lineWidth = 0.2
      ctx.stroke()
    })

    // Add view name and number
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
    ctx.fillRect(10, 10, 120, 35)
    ctx.fillStyle = "white"
    ctx.font = "bold 12px Arial"
    ctx.fillText(`${index + 1}. ${cameraPos.name.toUpperCase()}`, 15, 25)
    ctx.font = "10px Arial"
    ctx.fillText(cameraPos.description, 15, 38)

    console.log(`Successfully rendered ${cameraPos.name}`)

    // Convert to data URL
    const blob = await canvas.convertToBlob({ type: "image/png" })
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    return {
      dataUrl: `data:image/png;base64,${base64}`,
      name: cameraPos.name,
      description: cameraPos.description,
    }
  } catch (error) {
    console.error(`Error in renderModelSimple for ${cameraPos.name}:`, error)

    // Create a simple fallback image with error info
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")!

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = "red"
    ctx.font = "16px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Render Error", width / 2, height / 2 - 20)
    ctx.fillText(`${cameraPos.name}`, width / 2, height / 2)
    ctx.fillText(error instanceof Error ? error.message : "Unknown error", width / 2, height / 2 + 20)

    const blob = await canvas.convertToBlob({ type: "image/png" })
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    return {
      dataUrl: `data:image/png;base64,${base64}`,
      name: cameraPos.name,
      description: `Error: ${cameraPos.description}`,
    }
  }
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
    const arrayBuffer = await file.arrayBuffer()
    console.log("Parsing STL...")

    const { vertices, triangleCount } = parseSTL(arrayBuffer)
    console.log(`Parsed STL: ${triangleCount} triangles, ${vertices.length / 3} vertices`)

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

        // Create a simple error image
        const canvas = new OffscreenCanvas(512, 512)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "lightgray"
        ctx.fillRect(0, 0, 512, 512)
        ctx.fillStyle = "black"
        ctx.font = "20px Arial"
        ctx.textAlign = "center"
        ctx.fillText(`Error: ${cameraPositions[i].name}`, 256, 256)

        const blob = await canvas.convertToBlob({ type: "image/png" })
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString("base64")
        screenshots.push(`data:image/png;base64,${base64}`)
        viewNames.push(cameraPositions[i].name)
        viewDescriptions.push(`Error: ${cameraPositions[i].description}`)
      }
    }

    console.log("All screenshots generated:", screenshots.length)

    // In your POST function, update the return statements to include CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    // Update your success response
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

    // In your POST function, update the return statements to include CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    // Update your error responses too
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
  return NextResponse.json({
    message: "STL Screenshot API is running",
    endpoint: "/api/screenshot-stl",
    method: "POST",
    status: "operational",
  })
}
