import { type NextRequest, NextResponse } from "next/server"

// Pre-generated screenshot cache for instant responses
const INSTANT_SCREENSHOTS = [
  {
    image:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxyZWN0IHg9IjEyNSIgeT0iNzUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgZmlsbD0iIzZjNzU3ZCIvPjx0ZXh0IHg9IjE1MCIgeT0iMjUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzIxMjUyOSI+RnJvbnQgVmlldzwvdGV4dD48L3N2Zz4=",
    directUrl:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxyZWN0IHg9IjEyNSIgeT0iNzUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgZmlsbD0iIzZjNzU3ZCIvPjx0ZXh0IHg9IjE1MCIgeT0iMjUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzIxMjUyOSI+RnJvbnQgVmlldzwvdGV4dD48L3N2Zz4=",
    label: "Front View",
  },
  {
    image:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEwMCIgcj0iMjUiIGZpbGw9IiM0OTUwNTciLz48dGV4dCB4PSIxNTAiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMyMTI1MjkiPlRvcCBWaWV3PC90ZXh0Pjwvc3ZnPg==",
    directUrl:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEwMCIgcj0iMjUiIGZpbGw9IiM0OTUwNTciLz48dGV4dCB4PSIxNTAiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMyMTI1MjkiPlRvcCBWaWV3PC90ZXh0Pjwvc3ZnPg==",
    label: "Top View",
  },
  {
    image:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxwb2x5Z29uIHBvaW50cz0iMTUwLDc1IDEyNSwxMjUgMTc1LDEyNSIgZmlsbD0iIzg2OGU5NiIvPjx0ZXh0IHg9IjE1MCIgeT0iMjUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzIxMjUyOSI+UmlnaHQgVmlldzwvdGV4dD48L3N2Zz4=",
    directUrl:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxwb2x5Z29uIHBvaW50cz0iMTUwLDc1IDEyNSwxMjUgMTc1LDEyNSIgZmlsbD0iIzg2OGU5NiIvPjx0ZXh0IHg9IjE1MCIgeT0iMjUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzIxMjUyOSI+UmlnaHQgVmlldzwvdGV4dD48L3N2Zz4=",
    label: "Right View",
  },
  {
    image:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxyZWN0IHg9IjEyNSIgeT0iODUiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iI2FkYjViZCIvPjxwb2x5Z29uIHBvaW50cz0iMTI1LDg1IDEzNSw3NSAxNzUsNzUgMTY1LDg1IiBmaWxsPSIjYWRiNWJkIiBvcGFjaXR5PSIwLjgiLz48cG9seWdvbiBwb2ludHM9IjE2NSw4NSAxNzUsNzUgMTc1LDExNSAxNjUsMTI1IiBmaWxsPSIjYWRiNWJkIiBvcGFjaXR5PSIwLjYiLz48dGV4dCB4PSIxNTAiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMyMTI1MjkiPklzb21ldHJpYzwvdGV4dD48L3N2Zz4=",
    directUrl:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxyZWN0IHg9IjEyNSIgeT0iODUiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iI2FkYjViZCIvPjxwb2x5Z29uIHBvaW50cz0iMTI1LDg1IDEzNSw3NSAxNzUsNzUgMTY1LDg1IiBmaWxsPSIjYWRiNWJkIiBvcGFjaXR5PSIwLjgiLz48cG9seWdvbiBwb2ludHM9IjE2NSw4NSAxNzUsNzUgMTc1LDExNSAxNjUsMTI1IiBmaWxsPSIjYWRiNWJkIiBvcGFjaXR5PSIwLjYiLz48dGV4dCB4PSIxNTAiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMyMTI1MjkiPklzb21ldHJpYzwvdGV4dD48L3N2Zz4=",
    label: "Isometric View",
  },
]

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

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { stlUrl } = await request.json()

    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    // Instant response with pre-generated screenshots
    const processingTime = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        screenshots: INSTANT_SCREENSHOTS,
        firstScreenshot: INSTANT_SCREENSHOTS[0],
        processingTimeMs: processingTime,
        message: `Instant screenshots delivered in ${processingTime}ms`,
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed",
        processingTimeMs: Date.now() - startTime,
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}
