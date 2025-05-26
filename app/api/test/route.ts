import { type NextRequest, NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    message: "STL Screenshot API is running",
    endpoint: "/api/screenshot-stl",
    method: "POST",
    expectedInput: 'multipart/form-data with "stl" file field',
    output: "JSON with array of 16 base64 PNG images",
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    return NextResponse.json({
      message: "Test endpoint received POST request",
      receivedData: body,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      message: "Test endpoint - invalid JSON",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
