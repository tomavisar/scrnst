/**
 * Botpress agent that uses direct frontend capture
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

    console.log("Processing STL file with direct frontend capture:", file_link)

    // Generate a job ID
    const jobId = `job_${Date.now()}`

    // Create the capture URL that will auto-capture screenshots
    const captureUrl = `${appBaseUrl}/capture?url=${encodeURIComponent(file_link)}&capture=true&jobId=${jobId}`

    console.log("Capture URL:", captureUrl)
    console.log("Opening frontend to capture screenshots...")

    // Open the capture page (this would be done by the user or automated system)
    // For now, we'll simulate waiting for the capture to complete
    console.log("⏳ Waiting for frontend to capture screenshots...")
    console.log("📱 Open this URL to capture: " + captureUrl)

    // In a real implementation, you would:
    // 1. Open the capture URL in a browser/iframe
    // 2. Wait for the capture to complete
    // 3. Get the results from the API

    // For testing, let's try to call the API directly
    // (This won't work without the frontend capture, but shows the flow)

    return {
      success: true,
      message: "Frontend capture initiated",
      captureUrl: captureUrl,
      jobId: jobId,
      instructions: [
        "1. Open the capture URL in a browser",
        "2. Wait for the STL model to load",
        "3. Screenshots will be captured automatically",
        "4. Real PNG URLs will be generated",
      ],
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
    console.log("✅ Frontend capture initiated!")
    console.log("📱 Capture URL:", result.captureUrl)
    console.log("📋 Instructions:")
    result.instructions.forEach((instruction) => console.log("   " + instruction))
  } else {
    console.log("❌ Processing failed:", result.message)
  }
}

main()
