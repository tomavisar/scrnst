import { type NextRequest, NextResponse } from "next/server"

// Simple STL parser
function parseSTL(buffer: ArrayBuffer) {
  console.log(`Parsing STL file, buffer size: ${buffer.byteLength} bytes`)

  const view = new DataView(buffer)
  let offset = 80 // Skip header

  const triangleCount = view.getUint32(offset, true)
  offset += 4

  console.log(`STL has ${triangleCount} triangles`)

  const triangles: number[][] = []

  for (let i = 0; i < triangleCount && offset + 50 <= buffer.byteLength; i++) {
    offset += 12 // Skip normal

    const triangle = []
    for (let j = 0; j < 9; j++) {
      triangle.push(view.getFloat32(offset, true))
      offset += 4
    }

    offset += 2 // Skip attribute
    triangles.push(triangle)
  }

  console.log(`Parsed ${triangles.length} triangles`)
  return triangles
}

// Create a simple SVG and convert to data URL
function createSVGImage(width: number, height: number, triangles: number[][], viewName: string): string {
  console.log(`Creating SVG for view: ${viewName}`)

  // Find bounds
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

  console.log(`Model bounds: X(${minX.toFixed(2)} to ${maxX.toFixed(2)}), Y(${minY.toFixed(2)} to ${maxY.toFixed(2)})`)
  console.log(`Scale: ${maxSize.toFixed(2)}`)

  // Scale to fit 80% of image
  const scale = maxSize > 0 ? (Math.min(width, height) * 0.8) / maxSize : 1

  // Create SVG paths for each triangle
  let svgPaths = ""
  let trianglesDrawn = 0

  // Simple camera positions based on view name
  let cameraX = 0,
    cameraY = 0,
    cameraZ = 1 // Default: front view

  if (viewName.includes("back")) {
    cameraZ = -1
  } else if (viewName.includes("left")) {
    cameraX = -1
    cameraZ = 0
  } else if (viewName.includes("right")) {
    cameraX = 1
    cameraZ = 0
  } else if (viewName.includes("top")) {
    cameraY = 1
    cameraZ = 0
  } else if (viewName.includes("bottom")) {
    cameraY = -1
    cameraZ = 0
  } else if (viewName.includes("iso")) {
    // Isometric view
    cameraX = 0.7
    cameraY = 0.7
    cameraZ = 0.7

    if (viewName.includes("2")) {
      cameraX = -0.7
    } else if (viewName.includes("3")) {
      cameraZ = -0.7
    } else if (viewName.includes("4")) {
      cameraX = -0.7
      cameraZ = -0.7
    }
  }

  for (const triangle of triangles) {
    // Project 3D points to 2D based on camera position
    const points = []

    for (let i = 0; i < 9; i += 3) {
      // Center the model
      const x = triangle[i] - centerX
      const y = triangle[i + 1] - centerY
      const z = triangle[i + 2] - centerZ

      // Simple orthographic projection
      let screenX, screenY

      if (Math.abs(cameraX) > Math.abs(cameraY) && Math.abs(cameraX) > Math.abs(cameraZ)) {
        // Side view (X dominant)
        screenX = cameraX > 0 ? z : -z
        screenY = y
      } else if (Math.abs(cameraY) > Math.abs(cameraX) && Math.abs(cameraY) > Math.abs(cameraZ)) {
        // Top/bottom view (Y dominant)
        screenX = x
        screenY = cameraY > 0 ? z : -z
      } else {
        // Front/back view (Z dominant)
        screenX = x
        screenY = y
      }

      // For isometric views, use a simple combination
      if (Math.abs(cameraX) > 0.1 && Math.abs(cameraY) > 0.1 && Math.abs(cameraZ) > 0.1) {
        screenX = x * cameraX + z * cameraZ
        screenY = y * cameraY + (x * cameraX - z * cameraZ) * 0.3
      }

      // Convert to screen coordinates
      const pixelX = width / 2 + screenX * scale
      const pixelY = height / 2 - screenY * scale

      points.push([pixelX, pixelY])
    }

    // Create SVG path for this triangle
    svgPaths += `<polygon points="${points.map((p) => `${p[0]},${p[1]}`).join(" ")}" fill="#666" stroke="#999" stroke-width="0.5" />\n`
    trianglesDrawn++
  }

  console.log(`Drew ${trianglesDrawn} triangles`)

  // Create complete SVG
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <rect x="0" y="0" width="20" height="20" fill="red"/>
    ${svgPaths}
  </svg>`

  // Convert to base64
  const base64 = Buffer.from(svg).toString("base64")
  return `data:image/svg+xml;base64,${base64}`
}

// Generate 16 different views
function generateViews() {
  return [
    { name: "front", description: "Front View" },
    { name: "back", description: "Back View" },
    { name: "left", description: "Left Side View" },
    { name: "right", description: "Right Side View" },
    { name: "top", description: "Top View" },
    { name: "bottom", description: "Bottom View" },
    { name: "iso_1", description: "Isometric View 1" },
    { name: "iso_2", description: "Isometric View 2" },
    { name: "iso_3", description: "Isometric View 3" },
    { name: "iso_4", description: "Isometric View 4" },
    { name: "corner_1", description: "Bottom Corner 1" },
    { name: "corner_2", description: "Bottom Corner 2" },
    { name: "corner_3", description: "Bottom Corner 3" },
    { name: "corner_4", description: "Bottom Corner 4" },
    { name: "angle_1", description: "Angled View 1" },
    { name: "angle_2", description: "Angled View 2" },
  ]
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
    console.log("=== SVG-BASED STL RENDERER ===")

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

    // Generate screenshots for all views
    const views = generateViews()
    const screenshots: string[] = []
    const viewNames: string[] = []
    const viewDescriptions: string[] = []

    // For now, just generate one view for testing
    const testView = views[0]
    const screenshot = createSVGImage(512, 512, triangles, testView.name)
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
      message: "SVG-based STL Screenshot API",
      status: "operational",
    },
    { headers: corsHeaders },
  )
}
