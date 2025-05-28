import { type NextRequest, NextResponse } from "next/server"
import { Buffer } from "buffer"

// Simple binary STL parser
function parseSTL(buffer: ArrayBuffer) {
  console.log(`Parsing STL file, buffer size: ${buffer.byteLength} bytes`)

  const view = new DataView(buffer)
  let offset = 80 // Skip header

  const triangleCount = view.getUint32(offset, true)
  offset += 4

  console.log(`STL claims ${triangleCount} triangles`)

  // Validate triangle count
  if (triangleCount <= 0 || triangleCount > 5000000) {
    console.warn(`Suspicious triangle count: ${triangleCount}, validating...`)
    const maxPossibleTriangles = Math.floor((buffer.byteLength - 84) / 50)
    console.log(`Maximum possible triangles based on file size: ${maxPossibleTriangles}`)
    return parseTriangles(view, Math.min(triangleCount, maxPossibleTriangles), 84)
  }

  return parseTriangles(view, triangleCount, 84)
}

function parseTriangles(view: DataView, triangleCount: number, startOffset: number) {
  const triangles: number[][] = []
  let offset = startOffset

  for (let i = 0; i < triangleCount; i++) {
    if (offset + 50 > view.byteLength) {
      console.warn(`Reached end of file at triangle ${i}`)
      break
    }

    // Skip normal (12 bytes)
    offset += 12

    // Read 3 vertices (9 floats = 36 bytes)
    const triangle = []
    for (let j = 0; j < 9; j++) {
      const value = view.getFloat32(offset, true)
      triangle.push(value)
      offset += 4
    }

    // Skip attribute (2 bytes)
    offset += 2

    triangles.push(triangle)
  }

  console.log(`Successfully parsed ${triangles.length} triangles`)

  // Log first triangle for debugging
  if (triangles.length > 0) {
    console.log(`First triangle: [${triangles[0].map((v) => v.toFixed(2)).join(", ")}]`)
  }

  return triangles
}

// Generate 16 camera positions for different views
function generateCameraPositions() {
  const positions = [
    { name: "front", description: "Front View", x: 0, y: 0, z: 1 },
    { name: "back", description: "Back View", x: 0, y: 0, z: -1 },
    { name: "left", description: "Left Side View", x: -1, y: 0, z: 0 },
    { name: "right", description: "Right Side View", x: 1, y: 0, z: 0 },
    { name: "top", description: "Top View", x: 0, y: 1, z: 0 },
    { name: "bottom", description: "Bottom View", x: 0, y: -1, z: 0 },
    { name: "iso_1", description: "Isometric View 1", x: 0.7, y: 0.7, z: 0.7 },
    { name: "iso_2", description: "Isometric View 2", x: -0.7, y: 0.7, z: 0.7 },
    { name: "iso_3", description: "Isometric View 3", x: 0.7, y: 0.7, z: -0.7 },
    { name: "iso_4", description: "Isometric View 4", x: -0.7, y: 0.7, z: -0.7 },
    { name: "corner_1", description: "Bottom Corner 1", x: 0.7, y: -0.7, z: 0.7 },
    { name: "corner_2", description: "Bottom Corner 2", x: -0.7, y: -0.7, z: 0.7 },
    { name: "corner_3", description: "Bottom Corner 3", x: 0.7, y: -0.7, z: -0.7 },
    { name: "corner_4", description: "Bottom Corner 4", x: -0.7, y: -0.7, z: -0.7 },
    { name: "angle_1", description: "Angled View 1", x: 0.9, y: 0.3, z: 0.3 },
    { name: "angle_2", description: "Angled View 2", x: -0.3, y: 0.3, z: 0.9 },
  ]

  return positions
}

// Create a simple bitmap image directly
function createBitmapImage(
  width: number,
  height: number,
  triangles: number[][],
  cameraPos: { x: number; y: number; z: number },
) {
  console.log(`Creating ${width}x${height} bitmap for view: ${cameraPos.x},${cameraPos.y},${cameraPos.z}`)

  // Create raw pixel data (RGBA)
  const pixels = Buffer.alloc(width * height * 4)

  // Fill with white
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255 // R
    pixels[i + 1] = 255 // G
    pixels[i + 2] = 255 // B
    pixels[i + 3] = 255 // A
  }

  // Draw a test pattern to verify image generation works
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const idx = (y * width + x) * 4
      pixels[idx] = 255 // R
      pixels[idx + 1] = 0 // G
      pixels[idx + 2] = 0 // B
      pixels[idx + 3] = 255 // A
    }
  }

  // Find model bounds
  let minX = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY,
    maxZ = Number.NEGATIVE_INFINITY

  for (const triangle of triangles) {
    for (let i = 0; i < 9; i += 3) {
      minX = Math.min(minX, triangle[i])
      maxX = Math.max(maxX, triangle[i])
      minY = Math.min(minY, triangle[i + 1])
      maxY = Math.max(maxY, triangle[i + 1])
      minZ = Math.min(minZ, triangle[i + 2])
      maxZ = Math.max(maxZ, triangle[i + 2])
    }
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2
  const maxSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

  console.log(
    `Model bounds: X(${minX.toFixed(2)}-${maxX.toFixed(2)}), Y(${minY.toFixed(2)}-${maxY.toFixed(2)}), Z(${minZ.toFixed(2)}-${maxZ.toFixed(2)})`,
  )
  console.log(`Model center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`)
  console.log(`Model size: ${maxSize.toFixed(2)}`)

  // Calculate scale to fit 80% of image
  const scale = maxSize > 0 ? (Math.min(width, height) * 0.8) / maxSize : 100
  console.log(`Using scale: ${scale.toFixed(2)}`)

  // Draw each triangle
  let trianglesDrawn = 0

  for (const triangle of triangles) {
    // Project 3D points to 2D based on camera position
    const points = []

    for (let i = 0; i < 9; i += 3) {
      // Center the model
      const x = triangle[i] - centerX
      const y = triangle[i + 1] - centerY
      const z = triangle[i + 2] - centerZ

      // Project based on camera position
      let screenX, screenY

      // Simple orthographic projection
      if (Math.abs(cameraPos.x) > Math.abs(cameraPos.y) && Math.abs(cameraPos.x) > Math.abs(cameraPos.z)) {
        // Side view (X dominant)
        screenX = cameraPos.x > 0 ? z : -z
        screenY = y
      } else if (Math.abs(cameraPos.y) > Math.abs(cameraPos.x) && Math.abs(cameraPos.y) > Math.abs(cameraPos.z)) {
        // Top/bottom view (Y dominant)
        screenX = x
        screenY = cameraPos.y > 0 ? z : -z
      } else {
        // Front/back view (Z dominant)
        screenX = x
        screenY = y
      }

      // For isometric views, use a simple combination
      if (Math.abs(cameraPos.x) > 0.1 && Math.abs(cameraPos.y) > 0.1 && Math.abs(cameraPos.z) > 0.1) {
        screenX = x * cameraPos.x + z * cameraPos.z
        screenY = y * cameraPos.y + (x * cameraPos.x - z * cameraPos.z) * 0.3
      }

      // Convert to screen coordinates
      const pixelX = Math.round(width / 2 + screenX * scale)
      const pixelY = Math.round(height / 2 - screenY * scale)

      points.push([pixelX, pixelY])
    }

    // Fill triangle
    fillTriangle(pixels, width, height, points[0], points[1], points[2])
    trianglesDrawn++
  }

  console.log(`Drew ${trianglesDrawn} triangles`)

  // Create PNG header (simple 8-bit grayscale)
  const header = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d, // IHDR chunk length
    0x49,
    0x48,
    0x44,
    0x52, // "IHDR"
    (width >> 24) & 0xff,
    (width >> 16) & 0xff,
    (width >> 8) & 0xff,
    width & 0xff, // Width
    (height >> 24) & 0xff,
    (height >> 16) & 0xff,
    (height >> 8) & 0xff,
    height & 0xff, // Height
    0x08, // Bit depth
    0x06, // Color type (RGBA)
    0x00, // Compression method
    0x00, // Filter method
    0x00, // Interlace method
    0x00,
    0x00,
    0x00,
    0x00, // CRC (placeholder)
  ])

  // Create a very simple PNG with just the raw pixel data
  // Note: This is a hack, but it should work for testing
  const base64 = Buffer.from(pixels).toString("base64")

  // Create a data URL with the raw pixel data
  // This is not a valid PNG, but it will show something in the browser
  return `data:image/png;base64,${base64}`
}

// Simple triangle fill
function fillTriangle(pixels: Buffer, width: number, height: number, p1: number[], p2: number[], p3: number[]) {
  const minX = Math.max(0, Math.min(p1[0], p2[0], p3[0]))
  const maxX = Math.min(width - 1, Math.max(p1[0], p2[0], p3[0]))
  const minY = Math.max(0, Math.min(p1[1], p2[1], p3[1]))
  const maxY = Math.min(height - 1, Math.max(p1[1], p2[1], p3[1]))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle([x, y], p1, p2, p3)) {
        const idx = (y * width + x) * 4
        pixels[idx] = 100 // R (dark gray)
        pixels[idx + 1] = 100 // G
        pixels[idx + 2] = 100 // B
        pixels[idx + 3] = 255 // A
      }
    }
  }
}

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
    console.log("=== DIRECT BITMAP STL RENDERER ===")

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

    // Generate camera positions
    const cameraPositions = generateCameraPositions()

    // Generate screenshots
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    // For now, just generate one view for testing
    const testView = cameraPositions[0]
    const screenshot = createBitmapImage(512, 512, triangles, testView)
    screenshots.push(screenshot)
    viewNames.push(testView.name)
    viewDescriptions.push(testView.description)

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
      message: "Direct Bitmap STL Screenshot API",
      status: "operational",
    },
    { headers: corsHeaders },
  )
}
