/**
 * Botpress agent that gets REAL screenshots of the STL model
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

    console.log("Processing STL file from URL:", file_link)

    // Send the STL URL to the server for REAL screenshot processing
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

    console.log(`Successfully generated ${result.screenshots.length} REAL screenshots`)

    // Get the first screenshot - this will be a REAL screenshot of your STL model
    const firstScreenshot = result.firstScreenshot || result.screenshots[0]

    console.log("First screenshot URL:", firstScreenshot.image)
    console.log("First screenshot title:", firstScreenshot.label)

    // Verify it's a real URL (not base64)
    if (firstScreenshot.image.startsWith("http")) {
      console.log("✅ Got REAL screenshot URL for Botpress!")
    } else {
      console.log("⚠️ Got base64 image (fallback)")
    }

    return {
      success: true,
      message: "Successfully processed STL file with REAL screenshots",
      jobId: result.jobId,
      screenshots: result.screenshots,
      firstScreenshot: firstScreenshot,
      // These are the key values for Botpress - REAL screenshot URLs
      imageUrl: firstScreenshot.image, // This will be a real PNG URL of your STL model
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

// Example usage in Botpress
async function main() {
  // Get the file URL from the workflow
  const fileUrl = "https://files.bpcontent.cloud/2025/05/26/06/20250526063229-TGFXQGR7.stl"

  const result = await processStlFile(fileUrl)

  if (result.success) {
    console.log("✅ Processing successful!")
    console.log("📸 Generated REAL screenshots:", result.screenshots.length)
    console.log("🖼️ First REAL screenshot URL:", result.imageUrl)
    console.log("📝 First screenshot title:", result.imageTitle)

    // This is what you'd use in Botpress - REAL screenshot of your STL model:
    console.log("\n=== FOR BOTPRESS ===")
    console.log("Image URL:", result.imageUrl)
    console.log("Image Title:", result.imageTitle)
  } else {
    console.log("❌ Processing failed:", result.message)
  }
}

// Run the processing
main()
