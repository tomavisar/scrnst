/**
 * Updated Botpress agent code for immediate screenshot processing
 */
async function processStlFile(file_link) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"
  const apiKey = "Tla21317462!"

  // Declare the workflow variable
  const workflow = {}

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

    // Send the STL URL to the server for immediate processing
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

    console.log(`Successfully generated ${result.screenshots.length} screenshots`)

    // Store all screenshots in workflow for agent use
    workflow.allScreenshots = result.screenshots
    workflow.processingComplete = true
    workflow.successMessage = "✅ Your 3D model has been processed successfully!"
    workflow.jobId = result.jobId

    // Send the first screenshot to the user
    const firstScreenshot = result.firstScreenshot || result.screenshots[0]
    workflow.imageUrl = firstScreenshot.image
    workflow.imageTitle = firstScreenshot.label

    console.log("First screenshot URL:", workflow.imageUrl)
    console.log("First screenshot title:", workflow.imageTitle)

    return {
      success: true,
      message: "Successfully processed STL file",
      jobId: result.jobId,
      screenshots: result.screenshots,
      firstScreenshot: firstScreenshot,
      // Store these for the workflow
      imageUrl: firstScreenshot.image,
      imageTitle: firstScreenshot.label,
    }
  } catch (error) {
    console.error("Error processing STL file:", error)

    // Store error in workflow
    workflow.processingComplete = false
    workflow.error = true
    workflow.errorMessage = `❌ ${error.message}`

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
    console.log("📸 Generated screenshots:", result.screenshots.length)
    console.log("🖼️ First screenshot:", result.imageUrl)
  } else {
    console.log("❌ Processing failed:", result.message)
  }
}

// Run the processing
main()
