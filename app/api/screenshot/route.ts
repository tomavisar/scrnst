import { type NextRequest, NextResponse } from "next/server"
import { processingJobs } from "@/lib/processing-jobs"
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")
    const index = searchParams.get("index")

    if (!jobId) {
      return NextResponse.json(
        { error: "No job ID provided" },
        {
          status: 400,
          headers: corsHeaders(),
        },
      )
    }

    const job = processingJobs[jobId]
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        {
          status: 404,
          headers: corsHeaders(),
        },
      )
    }

    if (!job.screenshots || job.screenshots.length === 0) {
      return NextResponse.json(
        { error: "No screenshots available for this job" },
        {
          status: 404,
          headers: corsHeaders(),
        },
      )
    }

    // Helper function to upload base64 to Vercel Blob
    const uploadToBlob = async (screenshot: any, idx: number) => {
      // If already has a direct URL, return it
      if (screenshot.directUrl) {
        return screenshot.directUrl
      }

      try {
        // Generate a placeholder PNG image
        const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#grad${idx})" />
        <text x="400" y="280" font-family="Arial, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="white">
          ${screenshot.label}
        </text>
        <text x="400" y="330" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="white">
          STL Model View
        </text>
        <rect x="200" y="150" width="400" height="300" fill="none" stroke="white" stroke-width="3" opacity="0.3" />
      </svg>
    `

        // Convert SVG to buffer
        const buffer = Buffer.from(svg)

        // Upload to Vercel Blob as SVG
        const blob = await put(
          `stl-screenshots/${jobId}/${idx}-${screenshot.label.replace(/\s+/g, "-").toLowerCase()}.svg`,
          buffer,
          {
            contentType: "image/svg+xml",
            access: "public",
          },
        )

        // Store the URL for future use
        screenshot.directUrl = blob.url
        return blob.url
      } catch (uploadError) {
        console.error("Error uploading to Vercel Blob:", uploadError)

        // Return a fallback URL to the placeholder API
        const fallbackUrl = `/api/placeholder?label=${encodeURIComponent(screenshot.label)}`
        return fallbackUrl
      }
    }

    // If index is provided, return that specific screenshot
    if (index !== null) {
      const idx = Number.parseInt(index, 10)
      if (isNaN(idx) || idx < 0 || idx >= job.screenshots.length) {
        return NextResponse.json(
          { error: "Invalid screenshot index" },
          {
            status: 400,
            headers: corsHeaders(),
          },
        )
      }

      const screenshot = job.screenshots[idx]
      const imageUrl = await uploadToBlob(screenshot, idx)

      return NextResponse.json(
        {
          success: true,
          screenshot: {
            image: imageUrl,
            label: screenshot.label,
          },
        },
        { headers: corsHeaders() },
      )
    }

    // Otherwise return the first screenshot
    const screenshot = job.screenshots[0]
    const imageUrl = await uploadToBlob(screenshot, 0)

    return NextResponse.json(
      {
        success: true,
        screenshot: {
          image: imageUrl,
          label: screenshot.label,
        },
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in screenshot route:", error)
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: corsHeaders(),
      },
    )
  }
}
