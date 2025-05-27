import { type NextRequest, NextResponse } from "next/server"
import { Buffer } from "buffer"

// Simple STL parser
function parseSTL(buffer: ArrayBuffer) {
  console.log(`Parsing STL file, buffer size: ${buffer.byteLength} bytes`)

  if (buffer.byteLength < 84) {
    throw new Error("File too small for binary STL")
  }

  const view = new DataView(buffer)
  let offset = 80

  const triangleCount = view.getUint32(offset, true)
  offset += 4

  console.log(`Binary STL claims ${triangleCount} triangles`)

  if (triangleCount > 50000) {
    throw new Error(`Too many triangles: ${triangleCount}`)
  }

  const vertices: number[] = []

  for (let i = 0; i < triangleCount; i++) {
    if (offset + 50 > buffer.byteLength) break

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

  console.log(`Parsed ${vertices.length / 9} triangles, ${vertices.length / 3} vertices`)
  return { vertices, triangleCount: vertices.length / 9 }
}

// Generate camera positions
function generateCameraPositions() {
  return [
    { x: 5, y: 0, z: 0, name: "right", description: "Right Side View" },
    { x: -5, y: 0, z: 0, name: "left", description: "Left Side View" },
    { x: 0, y: 5, z: 0, name: "top", description: "Top View" },
    { x: 0, y: -5, z: 0, name: "bottom", description: "Bottom View" },
    { x: 0, y: 0, z: 5, name: "front", description: "Front View" },
    { x: 0, y: 0, z: -5, name: "back", description: "Back View" },
    { x: 3, y: 3, z: 3, name: "iso_1", description: "Isometric View 1" },
    { x: -3, y: 3, z: 3, name: "iso_2", description: "Isometric View 2" },
    { x: 3, y: 3, z: -3, name: "iso_3", description: "Isometric View 3" },
    { x: -3, y: 3, z: -3, name: "iso_4", description: "Isometric View 4" },
    { x: 3, y: -3, z: 3, name: "corner_1", description: "Bottom Corner 1" },
    { x: -3, y: -3, z: 3, name: "corner_2", description: "Bottom Corner 2" },
    { x: 3, y: -3, z: -3, name: "corner_3", description: "Bottom Corner 3" },
    { x: -3, y: -3, z: -3, name: "corner_4", description: "Bottom Corner 4" },
    { x: 4, y: 1, z: 0, name: "angle_1", description: "Angled Right View" },
    { x: 0, y: 1, z: 4, name: "angle_2", description: "Angled Front View" },
  ]
}

// Create BMP image
function createBMP(imageData: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const fileHeaderSize = 14
  const infoHeaderSize = 40
  const pixelDataOffset = fileHeaderSize + infoHeaderSize
  const pixelDataSize = width * height * 3
  const fileSize = pixelDataOffset + pixelDataSize

  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // File header
  view.setUint16(0, 0x4d42, true) // "BM"
  view.setUint32(2, fileSize, true)
  view.setUint32(6, 0, true)
  view.setUint32(10, pixelDataOffset, true)

  // Info header
  view.setUint32(14, infoHeaderSize, true)
  view.setInt32(18, width, true)
  view.setInt32(22, -height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(30, 0, true)
  view.setUint32(34, pixelDataSize, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)
  view.setUint32(46, 0, true)
  view.setUint32(50, 0, true)

  // Pixel data
  let pixelIndex = pixelDataOffset
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 4
      bytes[pixelIndex++] = imageData[srcIndex + 2] // B
      bytes[pixelIndex++] = imageData[srcIndex + 1] // G
      bytes[pixelIndex++] = imageData[srcIndex] // R
    }
    while (pixelIndex % 4 !== 0) {
      bytes[pixelIndex++] = 0
    }
  }

  return bytes
}

// Draw line
function drawLine(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  let x = Math.round(x0)
  let y = Math.round(y0)

  while (true) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4
      imageData[idx] = 0 // Black
      imageData[idx + 1] = 0
      imageData[idx + 2] = 0
      imageData[idx + 3] = 255
    }

    if (x === Math.round(x1) && y === Math.round(y1)) break

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

// Render model
function renderModel(
  vertices: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  index: number,
): { dataUrl: string; name: string; description: string } {
  const width = 512
  const height = 512

  // Create white background
  const imageData = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < imageData.length; i += 4) {
    imageData[i] = 255 // R
    imageData[i + 1] = 255 // G
    imageData[i + 2] = 255 // B
    imageData[i + 3] = 255 // A
  }

  if (vertices.length === 0) {
    const bmpData = createBMP(imageData, width, height)
    const base64 = Buffer.from(bmpData).toString("base64")
    return {
      dataUrl: `data:image/bmp;base64,${base64}`,
      name: cameraPos.name,
      description: cameraPos.description,
    }
  }

  // Calculate bounds
  let minX = vertices[0],
    maxX = vertices[0]
  let minY = vertices[1],
    maxY = vertices[1]
  let minZ = vertices[2],
    maxZ = vertices[2]

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
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  const scale = size > 0 ? (Math.min(width, height) * 0.7) / size : 1

  // Draw wireframe
  for (let i = 0; i < vertices.length; i += 9) {
    const points = []

    // Get triangle vertices
    for (let j = 0; j < 3; j++) {
      const x = vertices[i + j * 3] - centerX
      const y = vertices[i + j * 3 + 1] - centerY
      const z = vertices[i + j * 3 + 2] - centerZ

      // Simple orthographic projection
      let screenX, screenY
      if (cameraPos.name === "front" || cameraPos.name === "back") {
        screenX = x
        screenY = y
      } else if (cameraPos.name === "right" || cameraPos.name === "left") {
        screenX = z
        screenY = y
      } else if (cameraPos.name === "top" || cameraPos.name === "bottom") {
        screenX = x
        screenY = z
      } else {
        // Isometric
        screenX = x + z * 0.5
        screenY = y + z * 0.3
      }

      points.push([width / 2 + screenX * scale, height / 2 - screenY * scale])
    }

    // Draw triangle edges
    if (points.length === 3) {
      drawLine(imageData, width, height, points[0][0], points[0][1], points[1][0], points[1][1])
      drawLine(imageData, width, height, points[1][0], points[1][1], points[2][0], points[2][1])
      drawLine(imageData, width, height, points[2][0], points[2][1], points[0][0], points[0][1])
    }
  }

  const bmpData = createBMP(imageData, width, height)
  const base64 = Buffer.from(bmpData).toString("base64")

  return {
    dataUrl: `data:image/bmp;base64,${base64}`,
    name: cameraPos.name,
    description: cameraPos.description,
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
      return NextResponse.json(
        { error: "No STL file provided" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        },
      )
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`)

    // Parse STL file
    const arrayBuffer = await file.arrayBuffer()
    const result = parseSTL(arrayBuffer)
    const { vertices, triangleCount } = result

    console.log(`Parsed STL: ${triangleCount} triangles`)

    // Generate screenshots
    const cameraPositions = generateCameraPositions()
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    for (let i = 0; i < cameraPositions.length; i++) {
      console.log(`Rendering view ${i + 1}/${cameraPositions.length}: ${cameraPositions[i].name}`)

      const result = renderModel(vertices, cameraPositions[i], i)
      screenshots.push(result.dataUrl)
      viewNames.push(result.name)
      viewDescriptions.push(result.description)
    }

    console.log("All screenshots generated:", screenshots.length)

    return NextResponse.json(
      {
        success: true,
        screenshots: screenshots,
        viewNames: viewNames,
        viewDescriptions: viewDescriptions,
        count: screenshots.length,
        filename: file.name,
        triangles: triangleCount,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    )
  } catch (error) {
    console.error("Error processing STL file:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process STL file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "STL Screenshot API is running",
      endpoint: "/api/screenshot-stl",
      method: "POST",
      status: "operational",
      timestamp: new Date().toISOString(),
      version: "9.0.0",
      format: "BMP images",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  )
}
