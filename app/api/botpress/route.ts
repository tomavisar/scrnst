import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { put } from "@vercel/blob"

// Add CORS headers to all responses
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { stlUrl, apiKey } = await request.json()

    // Quick validation
    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    // Optional API key validation
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    const jobId = uuidv4()

    // Use the same screenshot generation logic as the web UI
    const screenshots = await generateScreenshotsLikeWebUI(stlUrl, jobId)

    const processingTime = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Processing completed successfully",
        screenshots: screenshots,
        firstScreenshot: screenshots[0],
        processingTimeMs: processingTime,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("API error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Processing failed",
        processingTimeMs: processingTime,
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}

// Generate screenshots using the same method as the web UI
async function generateScreenshotsLikeWebUI(stlUrl: string, jobId: string) {
  try {
    // Import the canvas library for server-side rendering
    const { createCanvas } = await import("canvas")

    // Download and parse the STL file (same as web UI)
    console.log("Downloading STL file...")
    const response = await fetch(stlUrl)
    if (!response.ok) {
      throw new Error(`Failed to download STL: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log("STL file downloaded, size:", arrayBuffer.byteLength, "bytes")

    // Parse STL using the same parser as the web UI
    const geometry = parseSTLFile(arrayBuffer)
    console.log("STL parsed, vertices:", geometry.vertices.length / 3)

    // Generate screenshots from the same camera positions as web UI
    const cameraPositions = [
      { position: [1, 1, 1], label: "Top Front Right" },
      { position: [-1, 1, 1], label: "Top Front Left" },
      { position: [1, -1, 1], label: "Bottom Front Right" },
      { position: [-1, -1, 1], label: "Bottom Front Left" },
    ]

    const screenshots = []

    for (let i = 0; i < cameraPositions.length; i++) {
      const { position, label } = cameraPositions[i]
      console.log(`Rendering ${label}...`)

      // Create canvas and render the STL model (same as web UI)
      const canvas = createCanvas(400, 300)
      const ctx = canvas.getContext("2d")

      // Render the STL model using the same 3D projection as web UI
      renderSTLModel(ctx, geometry, position, 400, 300)

      // Convert to PNG buffer
      const buffer = canvas.toBuffer("image/png")

      try {
        // Upload to Vercel Blob to get a real URL
        const blob = await put(
          `stl-screenshots/${jobId}/${i}-${label.replace(/\s+/g, "-").toLowerCase()}.png`,
          buffer,
          {
            contentType: "image/png",
            access: "public",
          },
        )

        screenshots.push({
          image: blob.url,
          directUrl: blob.url,
          label: label,
        })

        console.log(`✅ ${label} uploaded successfully: ${blob.url}`)
      } catch (uploadError) {
        console.error(`Error uploading ${label}:`, uploadError)
        // Fallback to base64 if upload fails
        const base64 = `data:image/png;base64,${buffer.toString("base64")}`
        screenshots.push({
          image: base64,
          directUrl: base64,
          label: label,
        })
      }
    }

    return screenshots
  } catch (error) {
    console.error("Error generating screenshots:", error)
    throw error
  }
}

// STL parser - same as the web UI component
function parseSTLFile(data: ArrayBuffer) {
  const view = new DataView(data)

  // Check if it's binary STL (same logic as web UI)
  const isBinary = data.byteLength > 80 && view.getUint32(80, true) * 50 + 84 === data.byteLength

  if (isBinary) {
    return parseBinarySTL(data)
  } else {
    return parseASCIISTL(new TextDecoder().decode(data))
  }
}

function parseBinarySTL(data: ArrayBuffer) {
  const view = new DataView(data)
  const triangles = view.getUint32(80, true)

  const vertices: number[] = []
  const normals: number[] = []

  let offset = 84

  for (let i = 0; i < triangles; i++) {
    // Normal vector
    const nx = view.getFloat32(offset, true)
    const ny = view.getFloat32(offset + 4, true)
    const nz = view.getFloat32(offset + 8, true)
    offset += 12

    // Three vertices
    for (let j = 0; j < 3; j++) {
      const x = view.getFloat32(offset, true)
      const y = view.getFloat32(offset + 4, true)
      const z = view.getFloat32(offset + 8, true)
      offset += 12

      vertices.push(x, y, z)
      normals.push(nx, ny, nz)
    }

    offset += 2 // Skip attribute byte count
  }

  return { vertices, normals }
}

function parseASCIISTL(data: string) {
  const vertices: number[] = []
  const normals: number[] = []

  const lines = data.split("\n")
  let currentNormal = [0, 0, 0]

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("facet normal")) {
      const parts = trimmed.split(/\s+/)
      currentNormal = [Number.parseFloat(parts[2]), Number.parseFloat(parts[3]), Number.parseFloat(parts[4])]
    } else if (trimmed.startsWith("vertex")) {
      const parts = trimmed.split(/\s+/)
      vertices.push(Number.parseFloat(parts[1]), Number.parseFloat(parts[2]), Number.parseFloat(parts[3]))
      normals.push(...currentNormal)
    }
  }

  return { vertices, normals }
}

// Render STL model - same 3D projection logic as the web UI
function renderSTLModel(
  ctx: any,
  geometry: { vertices: number[]; normals: number[] },
  cameraPosition: number[],
  width: number,
  height: number,
) {
  // Clear canvas with background
  ctx.fillStyle = "#f8f9fa"
  ctx.fillRect(0, 0, width, height)

  if (geometry.vertices.length === 0) {
    return
  }

  // Calculate bounding box (same as web UI)
  let minX = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY,
    maxZ = Number.NEGATIVE_INFINITY

  for (let i = 0; i < geometry.vertices.length; i += 3) {
    const x = geometry.vertices[i]
    const y = geometry.vertices[i + 1]
    const z = geometry.vertices[i + 2]

    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2
  const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

  // Normalize camera position
  const camLength = Math.sqrt(
    cameraPosition[0] * cameraPosition[0] +
      cameraPosition[1] * cameraPosition[1] +
      cameraPosition[2] * cameraPosition[2],
  )
  const camX = (cameraPosition[0] / camLength) * maxDim * 3
  const camY = (cameraPosition[1] / camLength) * maxDim * 3
  const camZ = (cameraPosition[2] / camLength) * maxDim * 3

  const scale = Math.min(width, height) / (2 * maxDim)

  // Project and render triangles (same logic as web UI)
  const triangles = []

  for (let i = 0; i < geometry.vertices.length; i += 9) {
    const triangle = []

    for (let j = 0; j < 3; j++) {
      const x = geometry.vertices[i + j * 3] - centerX
      const y = geometry.vertices[i + j * 3 + 1] - centerY
      const z = geometry.vertices[i + j * 3 + 2] - centerZ

      // Simple 3D to 2D projection from camera position
      const dx = x - camX
      const dy = y - camY
      const dz = z - camZ

      // Project to screen
      const screenX = width / 2 + dx * scale
      const screenY = height / 2 - dy * scale

      triangle.push({ x: screenX, y: screenY, z: dz })
    }

    // Calculate lighting based on normal
    const normalIndex = Math.floor(i / 3)
    const nx = geometry.normals[normalIndex * 3] || 0
    const ny = geometry.normals[normalIndex * 3 + 1] || 0
    const nz = geometry.normals[normalIndex * 3 + 2] || 0

    // Simple lighting calculation
    const lightDir = [0.5, 0.5, 1]
    const lightIntensity = Math.max(0.3, Math.abs(nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]))

    triangles.push({ triangle, lightIntensity })
  }

  // Sort by depth (painter's algorithm)
  triangles.sort((a, b) => {
    const avgZA = (a.triangle[0].z + a.triangle[1].z + a.triangle[2].z) / 3
    const avgZB = (b.triangle[0].z + b.triangle[1].z + b.triangle[2].z) / 3
    return avgZB - avgZA
  })

  // Draw triangles
  triangles.forEach(({ triangle, lightIntensity }) => {
    ctx.beginPath()
    ctx.moveTo(triangle[0].x, triangle[0].y)
    ctx.lineTo(triangle[1].x, triangle[1].y)
    ctx.lineTo(triangle[2].x, triangle[2].y)
    ctx.closePath()

    // Apply lighting
    const gray = Math.floor(80 + lightIntensity * 120)
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`
    ctx.fill()

    ctx.strokeStyle = "#333"
    ctx.lineWidth = 0.3
    ctx.stroke()
  })
}
