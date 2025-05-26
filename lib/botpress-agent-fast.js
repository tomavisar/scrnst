/**
 * Ultra-fast Botpress agent for immediate screenshot generation
 */
async function processStlFileFast(file_link) {
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"

  try {
    if (!file_link || typeof file_link !== "string") {
      throw new Error("Invalid STL file URL")
    }

    // Use the ultra-fast endpoint
    const response = await fetch(`${appBaseUrl}/api/fast-screenshots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stlUrl: file_link,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`API error: ${errorData.error}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(`Processing failed: ${result.error}`)
    }

    console.log(`✅ Generated ${result.screenshots.length} screenshots in ${result.processingTimeMs}ms`)

    return {
      success: true,
      message: `Screenshots generated in ${result.processingTimeMs}ms`,
      screenshots: result.screenshots,
      firstScreenshot: result.firstScreenshot,
      imageUrl: result.firstScreenshot.image,
      imageTitle: result.firstScreenshot.label,
      processingTimeMs: result.processingTimeMs,
    }
  } catch (error) {
    console.error("Fast processing error:", error)

    return {
      success: false,
      message: `Failed: ${error.message}`,
      originalUrl: file_link,
    }
  }
}

// Example usage
async function testFastProcessing() {
  const fileUrl = "https://files.bpcontent.cloud/2025/05/26/06/20250526063229-TGFXQGR7.stl"

  console.time("Fast Processing")
  const result = await processStlFileFast(fileUrl)
  console.timeEnd("Fast Processing")

  if (result.success) {
    console.log("✅ Ultra-fast processing successful!")
    console.log(`⚡ Processing time: ${result.processingTimeMs}ms`)
    console.log(`📸 Screenshots: ${result.screenshots.length}`)
  } else {
    console.log("❌ Processing failed:", result.message)
  }
}

// Run the test
testFastProcessing()
