/**
 * Botpress agent code to process an STL file from a URL
 *
 * This function:
 * 1. Takes a URL to an STL file
 * 2. Sends it to the server for processing
 * 3. Waits for processing to complete
 * 4. Gets the screenshots
 * 5. Sends one screenshot to the user
 */
async function processStlFile(file_link) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"

  try {
    // Validate the URL
    if (!file_link || typeof file_link !== "string") {
      throw new Error("Invalid STL file URL")
    }

    // Send a message to the user that we're processing their file
    await sendUserMessage("I'm processing your 3D model. This may take a minute...")

    // Step 1: Send the STL URL to the server for processing
    console.log(`Sending STL file to server for processing: ${file_link}`)

    const processingResponse = await fetch(`${appBaseUrl}/api/botpress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stlUrl: file_link,
        // Add API key if you have one
        // apiKey: "your-api-key"
      }),
    })

    if (!processingResponse.ok) {
      const errorData = await processingResponse.json()
      throw new Error(`Failed to start processing: ${errorData.error || processingResponse.statusText}`)
    }

    const processingResult = await processingResponse.json()
    console.log("Processing started:", processingResult)

    if (!processingResult.jobId) {
      throw new Error("No job ID returned from the server")
    }

    // Step 2: Poll for job status until it's complete
    let jobStatus = null
    let attempts = 0
    const maxAttempts = 30 // Maximum number of polling attempts (60 seconds total)

    while (attempts < maxAttempts) {
      attempts++

      // Wait 2 seconds between polling attempts
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Check job status
      const statusResponse = await fetch(`${appBaseUrl}/api/status?jobId=${processingResult.jobId}`)

      if (!statusResponse.ok) {
        console.warn(`Failed to get job status (attempt ${attempts}): ${statusResponse.statusText}`)
        continue
      }

      jobStatus = await statusResponse.json()
      console.log(`Job status (attempt ${attempts}):`, jobStatus)

      // If the job is complete or failed, stop polling
      if (jobStatus.status === "completed" || jobStatus.status === "failed") {
        break
      }

      // Update the user every few attempts
      if (attempts % 5 === 0) {
        await sendUserMessage(`Still processing your model: ${jobStatus.progress}% complete...`)
      }
    }

    // Check final job status
    if (!jobStatus || jobStatus.status === "failed") {
      throw new Error(`Processing failed: ${jobStatus?.error || "Unknown error"}`)
    }

    if (jobStatus.status !== "completed") {
      throw new Error("Processing timed out")
    }

    // Step 3: Get the first screenshot
    const screenshotResponse = await fetch(`${appBaseUrl}/api/screenshot?jobId=${processingResult.jobId}`)

    if (!screenshotResponse.ok) {
      const errorData = await screenshotResponse.json()
      throw new Error(`Failed to get screenshot: ${errorData.error || screenshotResponse.statusText}`)
    }

    const screenshotResult = await screenshotResponse.json()

    if (!screenshotResult.success || !screenshotResult.screenshot) {
      throw new Error("No screenshot available")
    }

    // Step 4: Send the screenshot to the user
    await sendUserMessage("Here's a view of your 3D model:")
    await sendUserImage(screenshotResult.screenshot.image, screenshotResult.screenshot.label)

    // Step 5: Let the user know processing is complete
    await sendUserMessage("I've processed your 3D model and captured views from multiple angles.")

    // Return the results with the job ID so the agent can access other screenshots if needed
    return {
      success: true,
      message: "Successfully processed STL file",
      jobId: processingResult.jobId,
      screenshot: screenshotResult.screenshot,
      appBaseUrl: appBaseUrl, // Include this so the agent can construct URLs to other screenshots
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

// Helper function to send a text message to the user
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

// Helper function to send an image to the user
async function sendUserImage(imageUrl, altText) {
  // In a real Botpress agent, you would use bp.messaging.sendMessage
  console.log(`[BOT]: Sending image: ${altText}`)

  // Example Botpress code:
  /*
  await bp.messaging.sendMessage({
    conversationId: event.conversationId,
    userId: event.userId,
    message: {
      type: "image",
      payload: {
        url: imageUrl,
        title: altText
      }
    }
  })
  */
}

// Example usage in a Botpress hook or action
async function main() {
  // Example STL file URL
  const file_link = "https://files.bpcontent.cloud/2025/05/20/05/20250520051834-JHFRYTQJ.stl"

  const result = await processStlFile(file_link)
  console.log("Result:", result)

  // The agent now has access to the job ID and can get other screenshots if needed
  if (result.success) {
    console.log(`Job ID: ${result.jobId}`)
    console.log(`Screenshot label: ${result.screenshot.label}`)

    // Example of how to get another screenshot
    const anotherScreenshotUrl = `${result.appBaseUrl}/api/screenshot?jobId=${result.jobId}&index=1`
    console.log(`URL to get another screenshot: ${anotherScreenshotUrl}`)
  }
}

// Run the example
main()
