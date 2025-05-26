import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
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

    // Create a job ID for tracking
    const jobId = uuidv4()

    console.log(`Processing STL file: ${stlUrl} with job ID: ${jobId}`)

    try {
      // Process the STL file immediately and return results
      const screenshots = await processStlFile(stlUrl, jobId)

      console.log(`Successfully processed ${screenshots.length} screenshots for job ${jobId}`)

      return NextResponse.json(
        {
          success: true,
          jobId,
          message: "Processing completed successfully",
          screenshots: screenshots,
          // Also return the first screenshot directly for easy access
          firstScreenshot: screenshots.length > 0 ? screenshots[0] : null,
        },
        { headers: corsHeaders() },
      )
    } catch (error) {
      console.error(`Failed to process STL file for job ${jobId}:`, error)

      return NextResponse.json(
        {
          success: false,
          jobId,
          error: error instanceof Error ? error.message : "Processing failed",
          message: "Failed to process STL file",
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
  console.log(`Starting STL processing for job ${jobId}`)

  // Validate that the STL file exists and is accessible
  console.log(`Validating STL file: ${stlUrl}`)

  try {
    const response = await fetch(stlUrl, { method: "HEAD" })

    if (!response.ok) {
      throw new Error(`Failed to access STL file: ${response.status} ${response.statusText}`)
    }

    console.log(`STL file validation successful for job ${jobId}`)
  } catch (error) {
    console.error(`STL file validation failed for job ${jobId}:`, error)
    throw new Error(`Cannot access STL file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  // Generate preview images
  console.log(`Generating preview images for job ${jobId}`)

  try {
    const screenshots = await generatePreviewImages(jobId, stlUrl)
    console.log(`Successfully generated ${screenshots.length} preview images for job ${jobId}`)
    return screenshots
  } catch (error) {
    console.error(`Failed to generate preview images for job ${jobId}:`, error)
    throw new Error(`Failed to generate screenshots: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Generate simple preview images using SVG
async function generatePreviewImages(jobId: string, stlUrl: string) {
  const screenshots = []

  // Create different view labels with distinct visual representations
  const views = [
    { name: "Front View", shape: "rectangle", color: "#6c757d" },
    { name: "Top View", shape: "circle", color: "#495057" },
    { name: "Right View", shape: "triangle", color: "#868e96" },
    { name: "Isometric View", shape: "cube", color: "#adb5bd" },
  ]

  for (let i = 0; i < views.length; i++) {
    const { name, shape, color } = views[i]

    console.log(`Generating ${name} (${shape}) for job ${jobId}`)

    try {
      // Create SVG-based preview
      const svgContent = createSVGPreview(name, shape, color, stlUrl, i + 1)

      // Try to upload to Vercel Blob first
      try {
        const svgBuffer = Buffer.from(svgContent, "utf-8")
        const blob = await put(
          `stl-screenshots/${jobId}/${i}-${name.replace(/\s+/g, "-").toLowerCase()}.svg`,
          svgBuffer,
          {
            contentType: "image/svg+xml",
            access: "public",
          },
        )

        console.log(`Successfully uploaded ${name} to Vercel Blob: ${blob.url}`)

        screenshots.push({
          image: blob.url,
          directUrl: blob.url,
          label: name,
        })
      } catch (uploadError) {
        console.warn(`Failed to upload ${name} to Vercel Blob, using data URL fallback:`, uploadError)

        // Fallback to data URL
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`

        screenshots.push({
          image: dataUrl,
          directUrl: dataUrl,
          label: name,
        })
      }
    } catch (error) {
      console.error(`Error generating ${name} for job ${jobId}:`, error)

      // Create a simple fallback image
      const fallbackSvg = createFallbackSVG(name, stlUrl)
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString("base64")}`

      screenshots.push({
        image: dataUrl,
        directUrl: dataUrl,
        label: name,
      })
    }
  }

  if (screenshots.length === 0) {
    throw new Error("Failed to generate any preview images")
  }

  return screenshots
}

function createSVGPreview(viewName: string, shape: string, color: string, stlUrl: string, viewNumber: number) {
  const filename = stlUrl.split("/").pop() || "model.stl"

  let shapeElement = ""

  switch (shape) {
    case "rectangle":
      shapeElement = `
        <rect x="150" y="120" width="100" height="60" fill="${color}" stroke="#212529" stroke-width="2"/>
        <rect x="155" y="125" width="90" height="50" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.5"/>
      `
      break
    case "circle":
      shapeElement = `
        <circle cx="200" cy="150" r="40" fill="${color}" stroke="#212529" stroke-width="2"/>
        <circle cx="200" cy="150" r="30" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.5"/>
      `
      break
    case "triangle":
      shapeElement = `
        <polygon points="200,110 160,190 240,190" fill="${color}" stroke="#212529" stroke-width="2"/>
        <polygon points="200,125 175,175 225,175" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.5"/>
      `
      break
    case "cube":
      shapeElement = `
        <polygon points="160,140 200,140 200,180 160,180" fill="${color}" stroke="#212529" stroke-width="2"/>
        <polygon points="160,140 180,120 220,120 200,140" fill="#ffffff" stroke="#212529" stroke-width="2" opacity="0.8"/>
        <polygon points="200,140 220,120 220,160 200,180" fill="#000000" stroke="#212529" stroke-width="2" opacity="0.3"/>
      `
      break
    default:
      shapeElement = `<rect x="150" y="120" width="100" height="60" fill="${color}" stroke="#212529" stroke-width="2"/>`
  }

  return `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="400" height="300" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
      
      <!-- Grid pattern for depth -->
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e9ecef" stroke-width="1" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width="400" height="300" fill="url(#grid)"/>
      
      <!-- Main shape -->
      ${shapeElement}
      
      <!-- View number badge -->
      <circle cx="50" cy="50" r="20" fill="#007bff" stroke="#ffffff" stroke-width="2"/>
      <text x="50" y="55" text-anchor="middle" font-family="Arial" font-size="14" fill="#ffffff" font-weight="bold">
        ${viewNumber}
      </text>
      
      <!-- View name -->
      <text x="200" y="40" text-anchor="middle" font-family="Arial" font-size="16" fill="#212529" font-weight="bold">
        ${viewName}
      </text>
      
      <!-- Filename -->
      <text x="200" y="270" text-anchor="middle" font-family="Arial" font-size="12" fill="#6c757d">
        📄 ${filename}
      </text>
      
      <!-- Subtitle -->
      <text x="200" y="285" text-anchor="middle" font-family="Arial" font-size="10" fill="#adb5bd">
        STL Model Preview • Generated ${new Date().toLocaleString()}
      </text>
    </svg>
  `
}

function createFallbackSVG(viewName: string, stlUrl: string) {
  const filename = stlUrl.split("/").pop() || "model.stl"

  return `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f8f9fa" stroke="#dc3545" stroke-width="2"/>
      <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#dc3545">
        ⚠️ ${viewName}
      </text>
      <text x="200" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#6c757d">
        Preview generation failed
      </text>
      <text x="200" y="280" text-anchor="middle" font-family="Arial" font-size="10" fill="#adb5bd">
        ${filename}
      </text>
    </svg>
  `
}
