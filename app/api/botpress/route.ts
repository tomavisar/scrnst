import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
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
    processingJobs[jobId].message = "Validating STL file"

    // Validate that the STL file exists and is accessible
    const response = await fetch(stlUrl, { method: "HEAD" })

    if (!response.ok) {
      throw new Error(`Failed to access STL file: ${response.statusText}`)
    }

    processingJobs[jobId].progress = 50
    processingJobs[jobId].message = "Generating preview images"

    // Generate simple preview images
    const screenshots = await generatePreviewImages(jobId, stlUrl)

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

// Generate simple preview images using canvas (browser-compatible)
async function generatePreviewImages(jobId: string, stlUrl: string) {
  const screenshots = []

  // Create different view labels
  const views = ["Front View", "Top View", "Right View", "Isometric View"]

  for (let i = 0; i < views.length; i++) {
    const label = views[i]

    try {
      // Create a simple canvas-based preview
      const canvas = document.createElement("canvas")
      canvas.width = 400
      canvas.height = 300
      const ctx = canvas.getContext("2d")!

      // Draw a simple representation
      ctx.fillStyle = "#f8f9fa"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw border
      ctx.strokeStyle = "#dee2e6"
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

      // Draw a simple 3D-looking shape based on view
      ctx.fillStyle = "#6c757d"
      ctx.strokeStyle = "#495057"
      ctx.lineWidth = 1

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const size = 80

      if (label === "Front View") {
        // Draw a rectangle for front view
        ctx.fillRect(centerX - size, centerY - size / 2, size * 2, size)
        ctx.strokeRect(centerX - size, centerY - size / 2, size * 2, size)
      } else if (label === "Top View") {
        // Draw a circle for top view
        ctx.beginPath()
        ctx.arc(centerX, centerY, size, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
      } else if (label === "Right View") {
        // Draw a triangle for side view
        ctx.beginPath()
        ctx.moveTo(centerX - size, centerY + size / 2)
        ctx.lineTo(centerX + size, centerY + size / 2)
        ctx.lineTo(centerX, centerY - size / 2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      } else {
        // Draw an isometric cube
        ctx.beginPath()
        // Front face
        ctx.moveTo(centerX - size / 2, centerY - size / 4)
        ctx.lineTo(centerX + size / 2, centerY - size / 4)
        ctx.lineTo(centerX + size / 2, centerY + size / 4)
        ctx.lineTo(centerX - size / 2, centerY + size / 4)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Top face
        ctx.beginPath()
        ctx.moveTo(centerX - size / 2, centerY - size / 4)
        ctx.lineTo(centerX, centerY - size / 2)
        ctx.lineTo(centerX + size, centerY - size / 2)
        ctx.lineTo(centerX + size / 2, centerY - size / 4)
        ctx.closePath()
        ctx.fillStyle = "#adb5bd"
        ctx.fill()
        ctx.stroke()

        // Right face
        ctx.beginPath()
        ctx.moveTo(centerX + size / 2, centerY - size / 4)
        ctx.lineTo(centerX + size, centerY - size / 2)
        ctx.lineTo(centerX + size, centerY)
        ctx.lineTo(centerX + size / 2, centerY + size / 4)
        ctx.closePath()
        ctx.fillStyle = "#868e96"
        ctx.fill()
        ctx.stroke()
      }

      // Add label
      ctx.fillStyle = "#212529"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText(label, centerX, canvas.height - 20)

      // Add STL filename
      const filename = stlUrl.split("/").pop() || "model.stl"
      ctx.font = "12px Arial"
      ctx.fillText(filename, centerX, 25)

      // Convert to blob and upload
      const imageData = canvas.toDataURL("image/png")
      const base64Data = imageData.split(",")[1]
      const buffer = Buffer.from(base64Data, "base64")

      // Upload to Vercel Blob
      const blob = await put(`stl-screenshots/${jobId}/${i}-${label.replace(/\s+/g, "-").toLowerCase()}.png`, buffer, {
        contentType: "image/png",
        access: "public",
      })

      screenshots.push({
        image: blob.url,
        directUrl: blob.url,
        label: label,
      })
    } catch (error) {
      console.error(`Error generating preview ${i}:`, error)
      // Fallback to a simple data URL
      screenshots.push({
        image: `data:image/svg+xml;base64,${Buffer.from(`
          <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
            <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#6c757d">
              ${label}
            </text>
            <text x="200" y="280" text-anchor="middle" font-family="Arial" font-size="12" fill="#6c757d">
              STL Preview
            </text>
          </svg>
        `).toString("base64")}`,
        directUrl: `data:image/svg+xml;base64,${Buffer.from(`
          <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
            <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#6c757d">
              ${label}
            </text>
            <text x="200" y="280" text-anchor="middle" font-family="Arial" font-size="12" fill="#6c757d">
              STL Preview
            </text>
          </svg>
        `).toString("base64")}`,
        label: label,
      })
    }
  }

  return screenshots
}
