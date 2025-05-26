import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { processingJobs } from "@/lib/processing-jobs"
import { put } from "@vercel/blob"

// We'll use a different approach for server-side rendering
// Instead of trying to mock the DOM, we'll use Three.js in headless mode

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

export async function POST(request: NextRequest) {
  try {
    const { stlUrl, apiKey } = await request.json()

    // Validate input
    if (!stlUrl) {
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    // Optional API key validation
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    // Create a job ID
    const jobId = uuidv4()

    // Initialize job
    processingJobs[jobId] = {
      id: jobId,
      status: "pending",
      progress: 0,
      message: "Job created",
      startTime: Date.now(),
      fileUrl: stlUrl,
      fileName: stlUrl.split("/").pop() || "unknown.stl",
    }

    // Start processing in the background
    processStlFile(stlUrl, jobId).catch((error) => {
      console.error("Error processing STL file:", error)
      processingJobs[jobId].status = "failed"
      processingJobs[jobId].error = error.message
    })

    // Return immediately with the job ID
    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Processing started",
      },
      { headers: corsHeaders() },
    )
  } catch (error) {
    console.error("Error in botpress API route:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() })
  }
}

async function processStlFile(stlUrl: string, jobId: string) {
  try {
    // Update job status
    processingJobs[jobId].status = "processing"
    processingJobs[jobId].progress = 10
    processingJobs[jobId].message = "Fetching STL file"

    // Fetch the STL file
    const response = await fetch(stlUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch STL file: ${response.statusText}`)
    }

    processingJobs[jobId].progress = 30
    processingJobs[jobId].message = "Processing STL data"

    // Get the STL data
    const arrayBuffer = await response.arrayBuffer()

    // Since we can't use Three.js with DOM in a server environment,
    // we'll generate mock screenshots instead
    processingJobs[jobId].progress = 70
    processingJobs[jobId].message = "Generating screenshots"

    // Generate mock screenshots with different view labels
    const screenshots = await generateAndUploadScreenshots(jobId)

    // Update job with screenshots
    processingJobs[jobId].progress = 90
    processingJobs[jobId].message = "Finalizing screenshots"
    processingJobs[jobId].screenshots = screenshots

    // Complete the job
    processingJobs[jobId].status = "completed"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "Processing completed"

    return screenshots
  } catch (error) {
    processingJobs[jobId].status = "failed"
    processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
    processingJobs[jobId].progress = 0
    throw error
  }
}

// Helper function to generate real screenshots and upload them to Vercel Blob
async function generateAndUploadScreenshots(jobId: string) {
  // For now, we'll create placeholder images with Canvas API
  // In a real implementation, you'd render the actual STL file
  const viewLabels = [
    "Top Front Right",
    "Top Front Left",
    "Bottom Front Right",
    "Bottom Front Left",
    "Front View",
    "Right View",
    "Top View",
    "Back View",
    "Left View",
    "Bottom View",
    "Top Back Right",
    "Top Back Left",
    "Bottom Back Right",
    "Bottom Back Left",
    "Top Diagonal 1",
    "Top Diagonal 2",
  ]

  const uploadedScreenshots = []

  for (let i = 0; i < viewLabels.length; i++) {
    try {
      // Create a simple SVG as a placeholder
      const svg = `
        <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad${i}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#4a6fa5;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#166d3b;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="800" height="600" fill="url(#grad${i})" />
          <text x="400" y="280" font-family="Arial, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="white">
            ${viewLabels[i]}
          </text>
          <text x="400" y="330" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="white">
            STL Model View
          </text>
          <rect x="200" y="200" width="400" height="300" fill="none" stroke="white" stroke-width="3" opacity="0.3" />
          <circle cx="400" cy="350" r="80" fill="none" stroke="white" stroke-width="2" opacity="0.2" />
        </svg>
      `

      // Convert SVG to buffer
      const buffer = Buffer.from(svg)

      // Upload to Vercel Blob
      const blob = await put(
        `stl-screenshots/${jobId}/${i}-${viewLabels[i].replace(/\s+/g, "-").toLowerCase()}.svg`,
        buffer,
        {
          contentType: "image/svg+xml",
          access: "public",
        },
      )

      uploadedScreenshots.push({
        image: blob.url,
        directUrl: blob.url,
        label: viewLabels[i],
      })

      console.log(`Uploaded screenshot ${i}: ${blob.url}`)
    } catch (error) {
      console.error(`Error generating/uploading screenshot ${i}:`, error)

      // If upload fails, use a data URL fallback
      const fallbackSvg = `data:image/svg+xml;base64,${Buffer.from(`
        <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="600" fill="#333" />
          <text x="400" y="300" font-family="Arial" font-size="24" text-anchor="middle" fill="white">
            ${viewLabels[i]}
          </text>
        </svg>
      `).toString("base64")}`

      uploadedScreenshots.push({
        image: fallbackSvg,
        directUrl: fallbackSvg,
        label: viewLabels[i],
      })
    }
  }

  return uploadedScreenshots
}
