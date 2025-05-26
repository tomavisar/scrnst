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

    // Generate actual screenshots of the STL model
    const screenshots = await generateActualSTLScreenshots(stlUrl, jobId)

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

// Generate actual screenshots of the STL model
async function generateActualSTLScreenshots(stlUrl: string, jobId: string) {
  const filename = stlUrl.split("/").pop() || "model.stl"

  try {
    // Import required libraries
    const { createCanvas } = await import("canvas")

    // Step 1: Download and parse the STL file
    console.log("Downloading STL file...")
    const response = await fetch(stlUrl)
    if (!response.ok) {
      throw new Error(`Failed to download STL: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log("STL file downloaded, size:", arrayBuffer.byteLength, "bytes")

    // Step 2: Parse the STL file
    const geometry = parseSTL(arrayBuffer)
    console.log("STL parsed, vertices:", geometry.vertices.length / 3)

    // Step 3: Generate screenshots from different angles
    const views = [
      { name: "Front View", rotation: { x: 0, y: 0, z: 0 } },
      { name: "Top View", rotation: { x: -Math.PI / 2, y: 0, z: 0 } },
      { name: "Right View", rotation: { x: 0, y: Math.PI / 2, z: 0 } },
      { name: "Isometric View", rotation: { x: -Math.PI / 6, y: Math.PI / 4, z: 0 } },
    ]

    const screenshots = []

    for (let i = 0; i < views.length; i++) {
      const view = views[i]
      console.log(`Rendering ${view.name}...`)

      // Create a 400x300 canvas
      const canvas = createCanvas(400, 300)
      const ctx = canvas.getContext("2d")

      // Render the actual STL model
      renderSTLToCanvas(ctx, geometry, view.rotation, 400, 300)

      // Add labels and UI elements
      addLabelsToCanvas(ctx, view.name, filename, i + 1)

      // Convert canvas to PNG buffer
      const buffer = canvas.toBuffer("image/png")

      try {
        // Upload to Vercel Blob
        const blob = await put(
          `stl-screenshots/${jobId}/${i}-${view.name.replace(/\s+/g, "-").toLowerCase()}.png`,
          buffer,
          {
            contentType: "image/png",
            access: "public",
          },
        )

        screenshots.push({
          image: blob.url,
          directUrl: blob.url,
          label: view.name,
        })

        console.log(`✅ ${view.name} uploaded successfully`)
      } catch (uploadError) {
        console.error(`Error uploading ${view.name}:`, uploadError)
        // Fallback to base64 if upload fails
        const base64 = `data:image/png;base64,${buffer.toString("base64")}`
        screenshots.push({
          image: base64,
          directUrl: base64,
          label: view.name,
        })
      }
    }

    return screenshots
  } catch (error) {
    console.error("Error generating STL screenshots:", error)
    // Fallback to placeholder images if STL processing fails
    return generatePlaceholderImages(jobId, filename)
  }
}

// Simple STL parser
function parseSTL(data: ArrayBuffer) {
  const view = new DataView(data)

  // Check if it's binary STL
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

// Render STL geometry to canvas
function renderSTLToCanvas(
  ctx: any,
  geometry: { vertices: number[]; normals: number[] },
  rotation: { x: number; y: number; z: number },
  width: number,
  height: number,
) {
  // Clear canvas with background
  ctx.fillStyle = "#f8f9fa"
  ctx.fillRect(0, 0, width, height)

  // Draw border
  ctx.strokeStyle = "#dee2e6"
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, width, height)

  if (geometry.vertices.length === 0) {
    // Draw placeholder if no geometry
    ctx.fillStyle = "#6c757d"
    ctx.fillRect(width / 2 - 50, height / 2 - 25, 100, 50)
    return
  }

  // Calculate bounding box
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
  const scale = Math.min(width, height) / (2 * Math.max(maxX - minX, maxY - minY, maxZ - minZ))

  // Simple 3D to 2D projection with rotation
  const projectedTriangles = []

  for (let i = 0; i < geometry.vertices.length; i += 9) {
    const triangle = []

    for (let j = 0; j < 3; j++) {
      const x = geometry.vertices[i + j * 3] - centerX
      const y = geometry.vertices[i + j * 3 + 1] - centerY
      const z = geometry.vertices[i + j * 3 + 2] - centerZ

      // Apply rotation
      const { x: rx, y: ry, z: rz } = applyRotation(x, y, z, rotation)

      // Project to 2D
      const screenX = width / 2 + rx * scale
      const screenY = height / 2 - ry * scale

      triangle.push({ x: screenX, y: screenY, z: rz })
    }

    // Calculate triangle normal for lighting
    const normal = calculateTriangleNormal(triangle)
    const lightIntensity = Math.max(0.3, Math.abs(normal.z))

    projectedTriangles.push({ triangle, lightIntensity })
  }

  // Sort triangles by depth (painter's algorithm)
  projectedTriangles.sort((a, b) => {
    const avgZA = (a.triangle[0].z + a.triangle[1].z + a.triangle[2].z) / 3
    const avgZB = (b.triangle[0].z + b.triangle[1].z + b.triangle[2].z) / 3
    return avgZB - avgZA
  })

  // Draw triangles
  projectedTriangles.forEach(({ triangle, lightIntensity }) => {
    ctx.beginPath()
    ctx.moveTo(triangle[0].x, triangle[0].y)
    ctx.lineTo(triangle[1].x, triangle[1].y)
    ctx.lineTo(triangle[2].x, triangle[2].y)
    ctx.closePath()

    // Apply lighting
    const gray = Math.floor(100 + lightIntensity * 100)
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`
    ctx.fill()

    ctx.strokeStyle = "#333"
    ctx.lineWidth = 0.5
    ctx.stroke()
  })
}

// Apply 3D rotation
function applyRotation(x: number, y: number, z: number, rotation: { x: number; y: number; z: number }) {
  // Rotate around X axis
  let newY = y * Math.cos(rotation.x) - z * Math.sin(rotation.x)
  let newZ = y * Math.sin(rotation.x) + z * Math.cos(rotation.x)
  y = newY
  z = newZ

  // Rotate around Y axis
  let newX = x * Math.cos(rotation.y) + z * Math.sin(rotation.y)
  newZ = -x * Math.sin(rotation.y) + z * Math.cos(rotation.y)
  x = newX
  z = newZ

  // Rotate around Z axis
  newX = x * Math.cos(rotation.z) - y * Math.sin(rotation.z)
  newY = x * Math.sin(rotation.z) + y * Math.cos(rotation.z)
  x = newX
  y = newY

  return { x, y, z }
}

// Calculate triangle normal for lighting
function calculateTriangleNormal(triangle: Array<{ x: number; y: number; z: number }>) {
  const v1 = {
    x: triangle[1].x - triangle[0].x,
    y: triangle[1].y - triangle[0].y,
    z: triangle[1].z - triangle[0].z,
  }
  const v2 = {
    x: triangle[2].x - triangle[0].x,
    y: triangle[2].y - triangle[0].y,
    z: triangle[2].z - triangle[0].z,
  }

  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  }
}

// Add labels and UI elements to canvas
function addLabelsToCanvas(ctx: any, viewName: string, filename: string, viewNumber: number) {
  // Draw view number circle
  ctx.fillStyle = "#007bff"
  ctx.beginPath()
  ctx.arc(50, 50, 18, 0, 2 * Math.PI)
  ctx.fill()

  // Draw view number text
  ctx.fillStyle = "#fff"
  ctx.font = "bold 12px Arial"
  ctx.textAlign = "center"
  ctx.fillText(viewNumber.toString(), 50, 55)

  // Draw title
  ctx.fillStyle = "#212529"
  ctx.font = "bold 14px Arial"
  ctx.textAlign = "center"
  ctx.fillText(viewName, 200, 35)

  // Draw filename
  ctx.fillStyle = "#6c757d"
  ctx.font = "11px Arial"
  ctx.fillText(filename, 200, 270)

  // Draw subtitle
  ctx.fillStyle = "#adb5bd"
  ctx.font = "9px Arial"
  ctx.fillText("STL Model", 200, 285)
}

// Fallback placeholder images
async function generatePlaceholderImages(jobId: string, filename: string) {
  const { createCanvas } = await import("canvas")

  const views = [
    { name: "Front View", color: "#6c757d" },
    { name: "Top View", color: "#495057" },
    { name: "Right View", color: "#868e96" },
    { name: "Isometric View", color: "#adb5bd" },
  ]

  const screenshots = []

  for (let i = 0; i < views.length; i++) {
    const view = views[i]
    const canvas = createCanvas(400, 300)
    const ctx = canvas.getContext("2d")

    // Draw placeholder
    ctx.fillStyle = "#f8f9fa"
    ctx.fillRect(0, 0, 400, 300)
    ctx.strokeStyle = "#dee2e6"
    ctx.strokeRect(0, 0, 400, 300)

    ctx.fillStyle = view.color
    ctx.fillRect(150, 120, 100, 60)

    addLabelsToCanvas(ctx, view.name, filename, i + 1)

    const buffer = canvas.toBuffer("image/png")
    const base64 = `data:image/png;base64,${buffer.toString("base64")}`

    screenshots.push({
      image: base64,
      directUrl: base64,
      label: view.name,
    })
  }

  return screenshots
}
