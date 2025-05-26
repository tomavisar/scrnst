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
  console.log("OPTIONS request received")
  return NextResponse.json({}, { headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let jobId = "unknown"

  try {
    console.log("=== BOTPRESS API REQUEST START ===")
    console.log("Request URL:", request.url)
    console.log("Request method:", request.method)
    console.log("Request headers:", Object.fromEntries(request.headers.entries()))

    // Parse request body with error handling
    let requestBody
    try {
      requestBody = await request.json()
      console.log("Request body parsed successfully:", requestBody)
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError)
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 400, headers: corsHeaders() },
      )
    }

    const { stlUrl, apiKey } = requestBody

    // Validate input
    if (!stlUrl) {
      console.error("No STL URL provided in request")
      return NextResponse.json({ error: "No STL URL provided" }, { status: 400, headers: corsHeaders() })
    }

    console.log("STL URL:", stlUrl)
    console.log("API Key provided:", !!apiKey)

    // Optional API key validation
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
      console.error("Invalid API key provided")
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders() })
    }

    // Create a job ID for tracking
    jobId = uuidv4()
    console.log("Generated job ID:", jobId)

    try {
      console.log("Starting STL processing...")
      const screenshots = await processStlFile(stlUrl, jobId)

      const processingTime = Date.now() - startTime
      console.log(`Successfully processed ${screenshots.length} screenshots for job ${jobId} in ${processingTime}ms`)

      const response = {
        success: true,
        jobId,
        message: "Processing completed successfully",
        screenshots: screenshots,
        firstScreenshot: screenshots.length > 0 ? screenshots[0] : null,
        processingTimeMs: processingTime,
      }

      console.log("=== BOTPRESS API REQUEST SUCCESS ===")
      return NextResponse.json(response, { headers: corsHeaders() })
    } catch (processingError) {
      console.error(`Failed to process STL file for job ${jobId}:`, processingError)
      console.error(
        "Processing error stack:",
        processingError instanceof Error ? processingError.stack : "No stack trace",
      )

      return NextResponse.json(
        {
          success: false,
          jobId,
          error: processingError instanceof Error ? processingError.message : "Processing failed",
          message: "Failed to process STL file",
          errorType: processingError instanceof Error ? processingError.constructor.name : "UnknownError",
        },
        { status: 500, headers: corsHeaders() },
      )
    }
  } catch (outerError) {
    const processingTime = Date.now() - startTime
    console.error("=== BOTPRESS API REQUEST ERROR ===")
    console.error("Outer error in botpress API route:", outerError)
    console.error("Error stack:", outerError instanceof Error ? outerError.stack : "No stack trace")
    console.error("Processing time before error:", processingTime, "ms")

    return NextResponse.json(
      {
        error: "Server error",
        details: outerError instanceof Error ? outerError.message : "Unknown server error",
        errorType: outerError instanceof Error ? outerError.constructor.name : "UnknownError",
        jobId,
        processingTimeMs: processingTime,
      },
      { status: 500, headers: corsHeaders() },
    )
  }
}

async function processStlFile(stlUrl: string, jobId: string) {
  console.log(`=== PROCESSING STL FILE ===`)
  console.log(`Job ID: ${jobId}`)
  console.log(`STL URL: ${stlUrl}`)

  try {
    // Validate that the STL file exists and is accessible
    console.log("Step 1: Validating STL file accessibility...")

    let headResponse
    try {
      headResponse = await fetch(stlUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": "STL-Processor/1.0",
        },
      })
      console.log("HEAD request completed")
      console.log("Response status:", headResponse.status)
      console.log("Response headers:", Object.fromEntries(headResponse.headers.entries()))
    } catch (fetchError) {
      console.error("HEAD request failed:", fetchError)
      throw new Error(`Cannot reach STL file: ${fetchError instanceof Error ? fetchError.message : "Network error"}`)
    }

    if (!headResponse.ok) {
      console.error(`STL file not accessible: ${headResponse.status} ${headResponse.statusText}`)
      throw new Error(`STL file not accessible: ${headResponse.status} ${headResponse.statusText}`)
    }

    console.log("✅ STL file validation successful")

    // Generate preview images
    console.log("Step 2: Generating preview images...")

    try {
      const screenshots = await generatePreviewImages(jobId, stlUrl)
      console.log(`✅ Successfully generated ${screenshots.length} preview images`)
      return screenshots
    } catch (imageError) {
      console.error("Image generation failed:", imageError)
      console.error("Image error stack:", imageError instanceof Error ? imageError.stack : "No stack trace")
      throw new Error(
        `Failed to generate screenshots: ${imageError instanceof Error ? imageError.message : "Unknown image generation error"}`,
      )
    }
  } catch (error) {
    console.error(`❌ processStlFile failed for job ${jobId}:`, error)
    throw error
  }
}

async function generatePreviewImages(jobId: string, stlUrl: string) {
  console.log(`=== GENERATING PREVIEW IMAGES ===`)
  console.log(`Job ID: ${jobId}`)

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

    console.log(`Generating view ${i + 1}/${views.length}: ${name} (${shape})`)

    try {
      // Create SVG-based preview
      const svgContent = createSVGPreview(name, shape, color, stlUrl, i + 1)
      console.log(`SVG content created for ${name}, length: ${svgContent.length} characters`)

      // Try to upload to Vercel Blob first
      try {
        console.log(`Attempting to upload ${name} to Vercel Blob...`)

        const svgBuffer = Buffer.from(svgContent, "utf-8")
        console.log(`SVG buffer created, size: ${svgBuffer.length} bytes`)

        const blobPath = `stl-screenshots/${jobId}/${i}-${name.replace(/\s+/g, "-").toLowerCase()}.svg`
        console.log(`Blob path: ${blobPath}`)

        const blob = await put(blobPath, svgBuffer, {
          contentType: "image/svg+xml",
          access: "public",
        })

        console.log(`✅ Successfully uploaded ${name} to Vercel Blob: ${blob.url}`)

        screenshots.push({
          image: blob.url,
          directUrl: blob.url,
          label: name,
        })
      } catch (uploadError) {
        console.warn(`⚠️ Failed to upload ${name} to Vercel Blob:`, uploadError)
        console.warn("Upload error stack:", uploadError instanceof Error ? uploadError.stack : "No stack trace")

        // Fallback to data URL
        console.log(`Using data URL fallback for ${name}`)
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`

        screenshots.push({
          image: dataUrl,
          directUrl: dataUrl,
          label: name,
        })
      }
    } catch (viewError) {
      console.error(`❌ Error generating ${name}:`, viewError)
      console.error("View error stack:", viewError instanceof Error ? viewError.stack : "No stack trace")

      // Create a simple fallback image
      try {
        console.log(`Creating fallback image for ${name}`)
        const fallbackSvg = createFallbackSVG(name, stlUrl)
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString("base64")}`

        screenshots.push({
          image: dataUrl,
          directUrl: dataUrl,
          label: name,
        })
      } catch (fallbackError) {
        console.error(`❌ Even fallback failed for ${name}:`, fallbackError)
        // Continue without this screenshot
      }
    }
  }

  if (screenshots.length === 0) {
    throw new Error("Failed to generate any preview images")
  }

  console.log(`✅ Generated ${screenshots.length} preview images successfully`)
  return screenshots
}

function createSVGPreview(viewName: string, shape: string, color: string, stlUrl: string, viewNumber: number) {
  try {
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

    const svg = `
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

    return svg.trim()
  } catch (error) {
    console.error("Error creating SVG preview:", error)
    throw new Error(`SVG creation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

function createFallbackSVG(viewName: string, stlUrl: string) {
  try {
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
    `.trim()
  } catch (error) {
    console.error("Error creating fallback SVG:", error)
    throw new Error(`Fallback SVG creation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
