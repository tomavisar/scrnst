/**
 * Simplified Botpress agent code that just sends the image directly
 */
const bp = require("botpress") // Declare the bp variable

async function sendModelScreenshot(jobId) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"

  try {
    // Get the screenshot
    const screenshotResponse = await fetch(`${appBaseUrl}/api/screenshot?jobId=${jobId}`)

    if (!screenshotResponse.ok) {
      throw new Error(`Failed to get screenshot: ${screenshotResponse.statusText}`)
    }

    const screenshotResult = await screenshotResponse.json()

    if (!screenshotResult.success || !screenshotResult.screenshot) {
      throw new Error("No screenshot available")
    }

    console.log("Screenshot URL:", screenshotResult.screenshot.image)

    // Send the image directly
    await bp.messaging.sendMessage({
      conversationId: "exampleConversationId", // Replace with actual event.conversationId
      userId: "exampleBotId", // Replace with actual event.botId
      message: {
        type: "image",
        image: screenshotResult.screenshot.image,
        title: screenshotResult.screenshot.label,
      },
    })

    return {
      success: true,
      imageUrl: screenshotResult.screenshot.image,
    }
  } catch (error) {
    console.error("Error sending screenshot:", error)

    await bp.messaging.sendMessage({
      conversationId: "exampleConversationId", // Replace with actual event.conversationId
      userId: "exampleBotId", // Replace with actual event.botId
      message: {
        type: "text",
        text: `Sorry, I couldn't display the screenshot: ${error.message}`,
      },
    })

    return {
      success: false,
      error: error.message,
    }
  }
}

// Example usage
async function main() {
  // Use the job ID from the logs
  const jobId = "08436d90-3553-4785-ac17-03e43cea8186"

  await sendModelScreenshot(jobId)
}

main()
