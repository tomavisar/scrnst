import { type NextRequest, NextResponse } from "next/server"

// Simple test endpoint that just returns mock data
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
    console.log("Test STL endpoint called")

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    // Just return mock data for testing
    const mockScreenshots = Array.from({ length: 16 }, (_, i) => {
      // Create a simple colored square as base64 PNG
      const canvas = new OffscreenCanvas(100, 100)
      const ctx = canvas.getContext("2d")!

      const hue = (i * 22.5) % 360
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
      ctx.fillRect(0, 0, 100, 100)

      ctx.fillStyle = "white"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText(`${i + 1}`, 50, 55)

      return canvas.convertToBlob({ type: "image/png" }).then((blob) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      })
    })

    const screenshots = await Promise.all(mockScreenshots)

    const viewNames = [
      "right",
      "left",
      "top",
      "bottom",
      "front",
      "back",
      "iso_1",
      "iso_2",
      "iso_3",
      "iso_4",
      "corner_1",
      "corner_2",
      "corner_3",
      "corner_4",
      "angle_1",
      "angle_2",
    ]

    const viewDescriptions = [
      "Right Side View",
      "Left Side View",
      "Top View",
      "Bottom View",
      "Front View",
      "Back View",
      "Isometric View 1",
      "Isometric View 2",
      "Isometric View 3",
      "Isometric View 4",
      "Bottom Corner 1",
      "Bottom Corner 2",
      "Bottom Corner 3",
      "Bottom Corner 4",
      "Angled Right View",
      "Angled Front View",
    ]

    return NextResponse.json(
      {
        success: true,
        screenshots: screenshots,
        viewNames: viewNames,
        viewDescriptions: viewDescriptions,
        count: 16,
        filename: "test-model.stl",
        triangles: 1000,
        message: "Mock data for testing - replace with real API URL",
      },
      {
        headers: corsHeaders,
      },
    )
  } catch (error) {
    console.error("Test endpoint error:", error)

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    return NextResponse.json(
      {
        success: false,
        error: "Test endpoint error",
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
      message: "STL Test API is running",
      endpoint: "/api/test-stl",
      method: "POST",
      status: "operational",
      note: "This is a test endpoint with mock data",
    },
    {
      headers: corsHeaders,
    },
  )
}
