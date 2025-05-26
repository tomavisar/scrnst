import { type NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"

export async function GET(request: NextRequest) {
  try {
    // Create a simple test image
    const testSvg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#4a6fa5" />
        <text x="200" y="150" font-family="Arial" font-size="24" text-anchor="middle" fill="white">
          Blob Storage Test
        </text>
        <text x="200" y="180" font-family="Arial" font-size="16" text-anchor="middle" fill="white">
          ${new Date().toISOString()}
        </text>
      </svg>
    `

    // Upload to Vercel Blob
    const blob = await put(`test/blob-test-${Date.now()}.svg`, Buffer.from(testSvg), {
      contentType: "image/svg+xml",
      access: "public",
    })

    // List recent blobs
    const { blobs } = await list({
      prefix: "stl-screenshots/",
      limit: 10,
    })

    return NextResponse.json({
      success: true,
      testBlobUrl: blob.url,
      recentBlobs: blobs.map((b) => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    })
  } catch (error) {
    console.error("Blob storage test error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
