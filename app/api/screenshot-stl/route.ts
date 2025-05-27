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

// Simple BMP image creation (works without external libraries)
function createBMP(imageData: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const fileHeaderSize = 14
  const infoHeaderSize = 40
  const pixelDataOffset = fileHeaderSize + infoHeaderSize
  const pixelDataSize = width * height * 3 // 24-bit RGB
  const fileSize = pixelDataOffset + pixelDataSize

  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // File header
  view.setUint16(0, 0x4d42, true) // "BM"
  view.setUint32(2, fileSize, true) // File size
  view.setUint32(6, 0, true) // Reserved
  view.setUint32(10, pixelDataOffset, true) // Pixel data offset

  // Info header
  view.setUint32(14, infoHeaderSize, true) // Info header size
  view.setInt32(18, width, true) // Width
  view.setInt32(22, -height, true) // Height (negative for top-down)
  view.setUint16(26, 1, true) // Planes
  view.setUint16(28, 24, true) // Bits per pixel
  view.setUint32(30, 0, true) // Compression
  view.setUint32(34, pixelDataSize, true) // Image size
  view.setInt32(38, 2835, true) // X pixels per meter
  view.setInt32(42, 2835, true) // Y pixels per meter
  view.setUint32(46, 0, true) // Colors used
  view.setUint32(50, 0, true) // Important colors

  // Pixel data (convert RGBA to RGB)
  let pixelIndex = pixelDataOffset
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 4
      bytes[pixelIndex++] = imageData[srcIndex + 2] // B
      bytes[pixelIndex++] = imageData[srcIndex + 1] // G
      bytes[pixelIndex++] = imageData[srcIndex] // R
    }
    // BMP rows must be padded to 4-byte boundary
    while (pixelIndex % 4 !== 0) {
      bytes[pixelIndex++] = 0
    }
  }

  return bytes
}

// Enhanced renderer with wireframe fallback
async function renderModelAsPNG(
  vertices: number[],
  cameraPos: { x: number; y: number; z: number; name: string; description: string },
  width = 512,
  height = 512,
  index = 0,
): Promise<{ dataUrl: string; name: string; description: string }> {
  try {
    console.log(`Rendering ${cameraPos.name} as image`)

    if (vertices.length === 0) {
      throw new Error("No vertices to render")
    }

    // Create image data
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

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2
    const sizeX = maxX - minX
    const sizeY = maxY - minY
    const sizeZ = maxZ - minZ
    const maxDimension = Math.max(sizeX, sizeY, sizeZ)

    console.log(`Model bounds: ${sizeX.toFixed(2)} x ${sizeY.toFixed(2)} x ${sizeZ.toFixed(2)}`)
    console.log(`Model center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`)

    if (maxDimension === 0) {
      throw new Error("Model has zero dimensions")
    }

    // Use aggressive scaling to ensure visibility
    const scale = (Math.min(width, height) * 0.9) / maxDimension
    console.log(`Using scale: ${scale.toFixed(2)}`)

    // Simple orthographic projection - no rotation for debugging
    const projectedPoints: [number, number][] = []

    // Project all vertices to screen space
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] - centerX
      const y = vertices[i + 1] - centerY
      const z = vertices[i + 2] - centerZ

      // Simple projection based on camera position
      let screenX, screenY

      if (cameraPos.name === "front" || cameraPos.name === "back") {
        screenX = x * scale
        screenY = y * scale
      } else if (cameraPos.name === "right" || cameraPos.name === "left") {
        screenX = z * scale
        screenY = y * scale
      } else if (cameraPos.name === "top" || cameraPos.name === "bottom") {
        screenX = x * scale
        screenY = z * scale
      } else {
        // Isometric views - simple 2D projection
        screenX = (x + z * 0.5) * scale
        screenY = (y + z * 0.3) * scale
      }

      projectedPoints.push([width / 2 + screenX, height / 2 - screenY])
    }

    // Draw wireframe of all triangles
    let trianglesDrawn = 0
    for (let i = 0; i < projectedPoints.length; i += 3) {
      if (i + 2 < projectedPoints.length) {
        const p1 = projectedPoints[i]
        const p2 = projectedPoints[i + 1]
        const p3 = projectedPoints[i + 2]

        // Draw triangle wireframe in black
        drawLine(imageData, width, height, p1, p2, [0, 0, 0])
        drawLine(imageData, width, height, p2, p3, [0, 0, 0])
        drawLine(imageData, width, height, p3, p1, [0, 0, 0])

        trianglesDrawn++
      }
    }

    // Also try filled triangles with better visibility
    for (let i = 0; i < projectedPoints.length; i += 3) {
      if (i + 2 < projectedPoints.length) {
        const p1 = projectedPoints[i]
        const p2 = projectedPoints[i + 1]
        const p3 = projectedPoints[i + 2]

        // Fill with light gray
        fillTriangleWithColor(imageData, width, height, [p1, p2, p3], [200, 200, 200])
      }
    }

    // Draw bounding box for debugging
    const boxPoints = [
      [width / 2 + (minX - centerX) * scale, height / 2 - (minY - centerY) * scale],
      [width / 2 + (maxX - centerX) * scale, height / 2 - (minY - centerY) * scale],
      [width / 2 + (maxX - centerX) * scale, height / 2 - (maxY - centerY) * scale],
      [width / 2 + (minX - centerX) * scale, height / 2 - (maxY - centerY) * scale],
    ]

    // Draw bounding box in red
    for (let i = 0; i < boxPoints.length; i++) {
      const start = boxPoints[i] as [number, number]
      const end = boxPoints[(i + 1) % boxPoints.length] as [number, number]
      drawLine(imageData, width, height, start, end, [255, 0, 0])
    }

    // Add comprehensive debug info
    addTextToImage(imageData, width, height, `${index + 1}. ${cameraPos.name.toUpperCase()}`, 10, 15)
    addTextToImage(imageData, width, height, `Triangles: ${trianglesDrawn}`, 10, 30)
    addTextToImage(imageData, width, height, `Scale: ${scale.toFixed(1)}`, 10, 45)
    addTextToImage(imageData, width, height, `Size: ${maxDimension.toFixed(1)}`, 10, 60)
    addTextToImage(imageData, width, height, `Vertices: ${vertices.length / 3}`, 10, 75)

    console.log(`Rendered ${cameraPos.name}: ${trianglesDrawn} triangles, scale ${scale.toFixed(2)}`)

    // Create BMP and convert to base64
    const bmpData = createBMP(imageData, width, height)
    const base64 = Buffer.from(bmpData).toString("base64")
    const dataUrl = `data:image/bmp;base64,${base64}`

    return {
      dataUrl,
      name: cameraPos.name,
      description: cameraPos.description,
    }
  } catch (error) {
    console.error(`Error rendering ${cameraPos.name}:`, error)

    // Create error image with more info
    const imageData = new Uint8ClampedArray(width * height * 4)

    // Fill with light red
    for (let i = 0; i < imageData.length; i += 4) {
      imageData[i] = 255
      imageData[i + 1] = 200
      imageData[i + 2] = 200
      imageData[i + 3] = 255
    }

    addTextToImage(imageData, width, height, "RENDER ERROR", 10, height / 2 - 40)
    addTextToImage(imageData, width, height, cameraPos.name, 10, height / 2 - 20)
    addTextToImage(imageData, width, height, "Check logs", 10, height / 2)
    addTextToImage(imageData, width, height, `Vertices: ${vertices.length}`, 10, height / 2 + 20)

    const bmpData = createBMP(imageData, width, height)
    const base64 = Buffer.from(bmpData).toString("base64")

    return {
      dataUrl: `data:image/bmp;base64,${base64}`,
      name: cameraPos.name,
      description: `Error: ${cameraPos.description}`,
    }
  }
}

// Enhanced triangle filling with color
function fillTriangleWithColor(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  points: [number, number][],
  color: [number, number, number],
) {
  const [p1, p2, p3] = points

  const minX = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])))
  const minY = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle([x, y], p1, p2, p3)) {
        const idx = (y * width + x) * 4
        imageData[idx] = color[0]
        imageData[idx + 1] = color[1]
        imageData[idx + 2] = color[2]
        imageData[idx + 3] = 255
      }
    }
  }
}

// Simple line drawing
function drawLine(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  start: [number, number],
  end: [number, number],
  color: [number, number, number],
) {
  const [x0, y0] = start
  const [x1, y1] = end

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
      imageData[idx] = color[0]
      imageData[idx + 1] = color[1]
      imageData[idx + 2] = color[2]
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
  // Simple 5x7 bitmap font
  const font: { [key: string]: number[] } = {
    A: [0x70, 0x88, 0x88, 0xf8, 0x88, 0x88, 0x88],
    B: [0xf0, 0x88, 0x88, 0xf0, 0x88, 0x88, 0xf0],
    C: [0x70, 0x88, 0x80, 0x80, 0x80, 0x88, 0x70],
    D: [0xf0, 0x88, 0x88, 0x88, 0x88, 0x88, 0xf0],
    E: [0xf8, 0x80, 0x80, 0xf0, 0x80, 0x80, 0xf8],
    F: [0xf8, 0x80, 0x80, 0xf0, 0x80, 0x80, 0x80],
    G: [0x70, 0x88, 0x80, 0x98, 0x88, 0x88, 0x70],
    H: [0x88, 0x88, 0x88, 0xf8, 0x88, 0x88, 0x88],
    I: [0x70, 0x20, 0x20, 0x20, 0x20, 0x20, 0x70],
    J: [0x38, 0x10, 0x10, 0x10, 0x90, 0x90, 0x60],
    K: [0x88, 0x90, 0xa0, 0xc0, 0xa0, 0x90, 0x88],
    L: [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0xf8],
    M: [0x88, 0xd8, 0xa8, 0xa8, 0x88, 0x88, 0x88],
    N: [0x88, 0xc8, 0xa8, 0x98, 0x88, 0x88, 0x88],
    O: [0x70, 0x88, 0x88, 0x88, 0x88, 0x88, 0x70],
    P: [0xf0, 0x88, 0x88, 0xf0, 0x80, 0x80, 0x80],
    Q: [0x70, 0x88, 0x88, 0x88, 0xa8, 0x90, 0x68],
    R: [0xf0, 0x88, 0x88, 0xf0, 0xa0, 0x90, 0x88],
    S: [0x70, 0x88, 0x80, 0x70, 0x08, 0x88, 0x70],
    T: [0xf8, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20],
    U: [0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x70],
    V: [0x88, 0x88, 0x88, 0x88, 0x50, 0x50, 0x20],
    W: [0x88, 0x88, 0x88, 0xa8, 0xa8, 0xd8, 0x88],
    X: [0x88, 0x50, 0x20, 0x20, 0x50, 0x88, 0x88],
    Y: [0x88, 0x88, 0x50, 0x20, 0x20, 0x20, 0x20],
    Z: [0xf8, 0x08, 0x10, 0x20, 0x40, 0x80, 0xf8],
    "0": [0x70, 0x88, 0x98, 0xa8, 0xc8, 0x88, 0x70],
    "1": [0x20, 0x60, 0x20, 0x20, 0x20, 0x20, 0x70],
    "2": [0x70, 0x88, 0x08, 0x70, 0x80, 0x80, 0xf8],
    "3": [0x70, 0x88, 0x08, 0x30, 0x08, 0x88, 0x70],
    "4": [0x10, 0x30, 0x50, 0x90, 0xf8, 0x10, 0x10],
    "5": [0xf8, 0x80, 0xf0, 0x08, 0x08, 0x88, 0x70],
    "6": [0x70, 0x80, 0x80, 0xf0, 0x88, 0x88, 0x70],
    "7": [0xf8, 0x08, 0x10, 0x20, 0x40, 0x40, 0x40],
    "8": [0x70, 0x88, 0x88, 0x70, 0x88, 0x88, 0x70],
    "9": [0x70, 0x88, 0x88, 0x78, 0x08, 0x08, 0x70],
    " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x60, 0x60],
    ":": [0x00, 0x60, 0x60, 0x00, 0x60, 0x60, 0x00],
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase()
    const pattern = font[char] || font[" "]

    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 8; col++) {
        if (pattern[row] & (1 << (7 - col))) {
          const px = x + i * 6 + col
          const py = y + row
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4
            imageData[idx] = 0 // Black text
            imageData[idx + 1] = 0
            imageData[idx + 2] = 0
            imageData[idx + 3] = 255
          }
        }
      }
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

    // Render screenshots as BMP (which works like PNG for AI analysis)
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

        // Create simple error image
        const imageData = new Uint8ClampedArray(512 * 512 * 4)
        for (let j = 0; j < imageData.length; j += 4) {
          imageData[j] = 200
          imageData[j + 1] = 200
          imageData[j + 2] = 200
          imageData[j + 3] = 255
        }

        const bmpData = createBMP(imageData, 512, 512)
        const base64 = Buffer.from(bmpData).toString("base64")
        screenshots.push(`data:image/bmp;base64,${base64}`)
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
      version: "7.0.0",
      format: "BMP images with wireframe and debug info",
    },
    {
      headers: corsHeaders,
    },
  )
}
