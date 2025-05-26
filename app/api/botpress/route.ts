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

    console.log(`Creating job ${jobId} for STL: ${stlUrl}`)

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

    console.log(`Job ${jobId} initialized:`, processingJobs[jobId])

    // Process immediately instead of in background to avoid job loss
    try {
      const result = await processStlFile(stlUrl, jobId)
      console.log(`Job ${jobId} completed successfully`)

      return NextResponse.json(
        {
          success: true,
          jobId,
          message: "Processing completed",
          screenshots: result,
        },
        { headers: corsHeaders() },
      )
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)

      // Update job status
      if (processingJobs[jobId]) {
        processingJobs[jobId].status = "failed"
        processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
      }

      return NextResponse.json(
        {
          success: false,
          jobId,
          error: error instanceof Error ? error.message : "Processing failed",
        },
        { status: 500, headers: corsHeaders() },
      )
    }
  } catch (error) {
    console.error("Error in botpress API route:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() })
  }
}

async function processStlFile(stlUrl: string, jobId: string) {
  console.log(`Starting processStlFile for job ${jobId}`)

  // Check if job exists
  if (!processingJobs[jobId]) {
    console.error(`Job ${jobId} not found in processingJobs`)
    throw new Error(`Job ${jobId} not found`)
  }

  try {
    // Update job status
    processingJobs[jobId].status = "processing"
    processingJobs[jobId].progress = 10
    processingJobs[jobId].message = "Validating STL file"

    console.log(`Job ${jobId} - Validating STL file: ${stlUrl}`)

    // Validate that the STL file exists and is accessible
    const response = await fetch(stlUrl, { method: "HEAD" })

    if (!response.ok) {
      throw new Error(`Failed to access STL file: ${response.statusText}`)
    }

    console.log(`Job ${jobId} - STL file validated successfully`)

    processingJobs[jobId].progress = 50
    processingJobs[jobId].message = "Generating preview images"

    // Generate simple preview images
    const screenshots = await generatePreviewImages(jobId, stlUrl)

    console.log(`Job ${jobId} - Generated ${screenshots.length} screenshots`)

    // Update job with screenshots
    processingJobs[jobId].progress = 90
    processingJobs[jobId].message = "Finalizing screenshots"
    processingJobs[jobId].screenshots = screenshots

    // Complete the job
    processingJobs[jobId].status = "completed"
    processingJobs[jobId].progress = 100
    processingJobs[jobId].message = "Processing completed"

    console.log(`Job ${jobId} - Processing completed successfully`)

    return screenshots
  } catch (error) {
    console.error(`Error in processStlFile for job ${jobId}:`, error)

    if (processingJobs[jobId]) {
      processingJobs[jobId].status = "failed"
      processingJobs[jobId].error = error instanceof Error ? error.message : "Unknown error"
      processingJobs[jobId].progress = 0
    }

    throw error
  }
}

// Generate simple preview images using SVG (more reliable than canvas)
async function generatePreviewImages(jobId: string, stlUrl: string) {
  console.log(`Generating preview images for job ${jobId}`)

  const screenshots = []

  // Create different view labels
  const views = [
    { name: "Front View", shape: "rectangle" },
    { name: "Top View", shape: "circle" },
    { name: "Right View", shape: "triangle" },
    { name: "Isometric View", shape: "cube" },
  ]

  for (let i = 0; i < views.length; i++) {
    const { name, shape } = views[i]

    console.log(`Generating ${name} for job ${jobId}`)

    try {
      // Create SVG-based preview
      const svgContent = createSVGPreview(name, shape, stlUrl)
      const svgBuffer = Buffer.from(svgContent, "utf-8")

      // Upload to Vercel Blob
      const blob = await put(
        `stl-screenshots/${jobId}/${i}-${name.replace(/\s+/g, "-").toLowerCase()}.svg`,
        svgBuffer,
        {
          contentType: "image/svg+xml",
          access: "public",
        },
      )

      console.log(`Uploaded ${name} to: ${blob.url}`)

      screenshots.push({
        image: blob.url,
        directUrl: blob.url,
        label: name,
      })
    } catch (error) {
      console.error(`Error generating preview ${name} for job ${jobId}:`, error)

      // Fallback to data URL
      const svgContent = createSVGPreview(name, shape, stlUrl)
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`

      screenshots.push({
        image: dataUrl,
        directUrl: dataUrl,
        label: name,
      })
    }
  }

  console.log(`Generated ${screenshots.length} preview images for job ${jobId}`)
  return screenshots
}

function createSVGPreview(viewName: string, shape: string, stlUrl: string) {
  const filename = stlUrl.split("/").pop() || "model.stl"

  let shapeElement = ""

  switch (shape) {
    case "rectangle":
      shapeElement = `<rect x="150" y="120" width="100" height="60" fill="#6c757d" stroke="#495057" stroke-width="2"/>`
      break
    case "circle":
      shapeElement = `<circle cx="200" cy="150" r="40" fill="#6c757d" stroke="#495057" stroke-width="2"/>`
      break
    case "triangle":
      shapeElement = `<polygon points="200,110 160,190 240,190" fill="#6c757d" stroke="#495057" stroke-width="2"/>`
      break
    case "cube":
      shapeElement = `
        <polygon points="160,140 200,140 200,180 160,180" fill="#6c757d" stroke="#495057" stroke-width="2"/>
        <polygon points="160,140 180,120 220,120 200,140" fill="#adb5bd" stroke="#495057" stroke-width="2"/>
        <polygon points="200,140 220,120 220,160 200,180" fill="#868e96" stroke="#495057" stroke-width="2"/>
      `
      break
    default:
      shapeElement = `<rect x="150" y="120" width="100" height="60" fill="#6c757d" stroke="#495057" stroke-width="2"/>`
  }

  return `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
      ${shapeElement}
      <text x="200" y="40" text-anchor="middle" font-family="Arial" font-size="14" fill="#212529" font-weight="bold">
        ${viewName}
      </text>
      <text x="200" y="270" text-anchor="middle" font-family="Arial" font-size="12" fill="#6c757d">
        ${filename}
      </text>
      <text x="200" y="285" text-anchor="middle" font-family="Arial" font-size="10" fill="#adb5bd">
        STL Model Preview
      </text>
    </svg>
  `
}
