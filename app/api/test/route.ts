import { type NextRequest, NextResponse } from "next/server"

// Add CORS headers to all responses
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

export async function GET(request: NextRequest) {
  try {
    console.log("Test endpoint called")

    return NextResponse.json(
      {
        success: true,
        message: "API is working",
        timestamp: new Date().toISOString(),
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          hasApiKey: !!process.env.API_KEY,
          hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
        },
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Test endpoint error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("Test POST endpoint called with body:", body)

    return NextResponse.json(
      {
        success: true,
        message: "POST test successful",
        receivedBody: body,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Test POST endpoint error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}
