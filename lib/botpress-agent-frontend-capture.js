/**
 * Botpress agent that uses the working frontend to capture real screenshots
 */
async function processStlFile(file_link) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"
  const apiKey = "Tla21317462!"

  try {
    // Validate the URL
    if (!file_link || typeof file_link !== "string") {
      throw new Error("Invalid STL file URL")
    }

    // Fix the URL format if needed
    if (file_link.startsWith("https//")) {
      file_link = file_link.replace("https//", "https://")
    }

    console.log("Processing STL file using frontend capture:", file_link)

    // Use the API that calls the working frontend
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

    console.log(`Successfully generated ${result.screenshots.length} REAL screenshots using frontend`)

    // Get the first screenshot - this will be a REAL PNG from the working frontend
    const firstScreenshot = result.firstScreenshot || result.screenshots[0]

    console.log("First screenshot URL:", firstScreenshot.image)
    console.log("First screenshot title:", firstScreenshot.label)

    // Verify it's a real URL (not base64)
    if (firstScreenshot.image.startsWith("http")) {
      console.log("✅ Got REAL PNG URL from working frontend!")
    } else {
      console.log("⚠️ Got base64 image (fallback)")
    }

    return {
      success: true,
      message: "Successfully processed STL file using working frontend",
      jobId: result.jobId,
      screenshots: result.screenshots,
      firstScreenshot: firstScreenshot,
      // These are the key values for Botpress - REAL PNG URLs from working frontend
      imageUrl: firstScreenshot.image,
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
    console.log("✅ Processing successful using working frontend!")
    console.log("📸 Generated REAL screenshots:", result.screenshots.length)
    console.log("🖼️ First REAL PNG URL:", result.imageUrl)
    console.log("📝 First screenshot title:", result.imageTitle)
  } else {
    console.log("❌ Processing failed:", result.message)
  }
}

// Run the processing
main()
