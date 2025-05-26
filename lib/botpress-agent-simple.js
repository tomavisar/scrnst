/**
 * Simple Botpress agent code to process an STL file from a URL
 *
 * This function takes a URL to an STL file and creates a direct link
 * to view it in the STL viewer application.
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

    // Create a direct link to the application with the STL URL as a parameter
    const viewerUrl = `${appBaseUrl}?url=${encodeURIComponent(file_link)}`

    // Send a message to the user with the link
    await sendUserMessage("I've prepared your 3D model for viewing!")
    await sendUserMessage(`Click here to view and capture screenshots: ${viewerUrl}`)

    // Provide instructions
    await sendUserMessage("Once the model loads, you can:")
    await sendUserMessage("1. Rotate and zoom to inspect the model")
    await sendUserMessage("2. Click 'Capture Screenshots' to get views from all angles")
    await sendUserMessage("3. Download individual screenshots or all at once")
    await sendUserMessage("4. Check the 'Job History' tab to see all your processed models")

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
    }
  }
}

// Helper function to send a message to the user (replace with your Botpress messaging code)
async function sendUserMessage(message) {
  // In a real Botpress agent, you would use bp.messaging.sendMessage
  console.log(`[BOT]: ${message}`)

  // Example Botpress code:
  /*
  await bp.messaging.sendMessage({
    conversationId: event.conversationId,
    userId: event.userId,
    message: {
      type: "text",
      text: message
    }
  })
  */
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
