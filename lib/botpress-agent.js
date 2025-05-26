/**
 * Botpress agent code to process an STL file from a URL
 *
 * This function takes a URL to an STL file (stored in file_link variable),
 * sends it to your STL processing application, and returns the screenshots.
 */
async function processStlFile(file_link) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://your-domain.com"

  try {
    // Validate the URL
    if (!file_link || typeof file_link !== "string") {
      throw new Error("Invalid STL file URL")
    }

    console.log(`Processing STL file from URL: ${file_link}`)

    // Send a message to the user that we're processing their file
    await sendUserMessage("I'm processing your 3D model. This may take a minute...")

    // Direct approach - just open the URL with the STL file
    const viewerUrl = `${appBaseUrl}?url=${encodeURIComponent(file_link)}`

    await sendUserMessage(`Your 3D model is ready to view! You can see it here: ${viewerUrl}`)

    return {
      success: true,
      message: "STL file ready to view",
      viewerUrl: viewerUrl,
    }
  } catch (error) {
    console.error("Error processing STL file:", error)

    await sendUserMessage(`Sorry, I couldn't process your 3D model: ${error.message}`)

    return {
      success: false,
      message: `Failed to process STL file: ${error.message}`,
      originalUrl: file_link,
    }
  }
}

// Helper function to send a message to the user (replace with your Botpress messaging code)
async function sendUserMessage(message) {
  // In a real Botpress agent, you would use bp.messaging.sendMessage
  console.log(`[BOT]: ${message}`)
}

// Example usage
async function main() {
  // Example STL file URL
  const file_link = "https://files.bpcontent.cloud/2025/05/20/05/20250520051834-JHFRYTQJ.stl"

  const result = await processStlFile(file_link)
  console.log("Result:", result)
}

// Run the example
main()
