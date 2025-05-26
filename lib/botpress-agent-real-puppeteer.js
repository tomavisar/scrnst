/**
 * Botpress agent that gets REAL screenshots using Puppeteer
 */
async function processStlFile(file_link) {
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"
  const apiKey = "Tla21317462!"

  try {
    if (!file_link || typeof file_link !== "string") {
      throw new Error("Invalid STL file URL")
    }

    if (file_link.startsWith("https//")) {
      file_link = file_link.replace("https//", "https://")
    }

    console.log("Processing STL file with REAL Puppeteer screenshots:", file_link)

    // This will use Puppeteer to take REAL screenshots of your working 3D viewer
    const response = await fetch(`${appBaseUrl}/api/botpress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stlUrl: file_link,
        apiKey: apiKey,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Failed to process STL: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()
    console.log("Processing result:", result)

    if (!result.success) {
      throw new Error(`Processing failed: ${result.error || result.message}`)
    }

    if (!result.screenshots || result.screenshots.length === 0) {
      throw new Error("No screenshots were generated")
    }

    console.log(`✅ Successfully captured ${result.screenshots.length} REAL screenshots with Puppeteer`)

    const firstScreenshot = result.firstScreenshot || result.screenshots[0]

    console.log("First REAL screenshot URL:", firstScreenshot.image)
    console.log("First screenshot title:", firstScreenshot.label)

    // These will be REAL PNG URLs of your actual 3D model
    return {
      success: true,
      message: "Successfully captured REAL screenshots with Puppeteer",
      jobId: result.jobId,
      screenshots: result.screenshots,
      firstScreenshot: firstScreenshot,
      imageUrl: firstScreenshot.image, // REAL PNG URL
      imageTitle: firstScreenshot.label,
      processingTimeMs: result.processingTimeMs,
    }
  } catch (error) {
    console.error("Error processing STL file:", error)

    return {
      success: false,
      message: `Failed to process STL file: ${error.message}`,
      originalUrl: file_link,
    }
  }
}

// Example usage
async function main() {
  const fileUrl = "https://files.bpcontent.cloud/2025/05/26/06/20250526063229-TGFXQGR7.stl"

  const result = await processStlFile(fileUrl)

  if (result.success) {
    console.log("✅ REAL screenshots captured with Puppeteer!")
    console.log("📸 Generated screenshots:", result.screenshots.length)
    console.log("🖼️ First REAL PNG URL:", result.imageUrl)
    console.log("📝 Screenshot title:", result.imageTitle)
  } else {
    console.log("❌ Processing failed:", result.message)
  }
}

main()
