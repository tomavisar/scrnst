/**
 * Botpress agent code that uses a URL card to display the image
 */
const bp = require("botpress") // Declare the bp variable

async function sendModelScreenshotAsUrlCard(jobId) {
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

    // Send a URL card
    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
      message: {
        type: "url",
        url: screenshotResult.screenshot.image,
        title: "View 3D Model Screenshot",
        description: screenshotResult.screenshot.label,
      },
    })

    return {
      success: true,
      imageUrl: screenshotResult.screenshot.image,
    }
  } catch (error) {
    console.error("Error sending screenshot:", error)

    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
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

  await sendModelScreenshotAsUrlCard(jobId)
}

main()
