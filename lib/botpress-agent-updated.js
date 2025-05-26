/**
 * Updated Botpress agent code with direct URL support
 *
 * This function:
 * 1. Takes a URL to an STL file
 * 2. Sends it to the server for processing
 * 3. Waits for processing to complete
 * 4. Gets screenshots with direct URLs
 * 5. Displays them in the chat
 */
async function processStlFile(file_link, bp, event, workflow) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"
  const apiKey = process.env.API_KEY || ""

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

    // Send a message to the user that we're processing their file
    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
      message: {
        type: "text",
        text: "I'm processing your 3D model. This may take a minute...",
      },
    })

    // Step 1: Send the STL URL to the server for processing
    const processingResponse = await fetch(`${appBaseUrl}/api/botpress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stlUrl: file_link,
        apiKey: apiKey,
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
    let lastProgress = 0

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

      // Update the user every few attempts or when progress changes
      if (attempts % 5 === 0 || (jobStatus.progress && jobStatus.progress > lastProgress)) {
        lastProgress = jobStatus.progress || 0
        await bp.messaging.sendMessage({
          conversationId: event.conversationId,
          userId: event.botId,
          message: {
            type: "text",
            text: `Still processing your model: ${jobStatus.progress}% complete...`,
          },
        })
      }
    }

    // Check final job status
    if (!jobStatus || jobStatus.status === "failed") {
      throw new Error(`Processing failed: ${jobStatus?.error || "Unknown error"}`)
    }

    if (jobStatus.status !== "completed") {
      throw new Error("Processing timed out")
    }

    // Step 3: Get the first screenshot with direct URL
    const screenshotResponse = await fetch(`${appBaseUrl}/api/screenshot?jobId=${processingResult.jobId}`)

    if (!screenshotResponse.ok) {
      const errorData = await screenshotResponse.json()
      throw new Error(`Failed to get screenshot: ${errorData.error || screenshotResponse.statusText}`)
    }

    const screenshotResult = await screenshotResponse.json()

    if (!screenshotResult.success || !screenshotResult.screenshot) {
      throw new Error("No screenshot available")
    }

    console.log("Screenshot URL:", screenshotResult.screenshot.image)
    console.log("Screenshot label:", screenshotResult.screenshot.label)

    // Step 4: Send the screenshot to the user
    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
      message: {
        type: "text",
        text: "Here's a view of your 3D model:",
      },
    })

    // Send the image using the card format
    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
      message: {
        type: "card",
        title: screenshotResult.screenshot.label,
        image: screenshotResult.screenshot.image,
      },
    })

    // Step 5: Let the user know processing is complete
    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
      message: {
        type: "text",
        text: "I've processed your 3D model and captured views from multiple angles.",
      },
    })

    // Return the results with direct URLs
    return {
      success: true,
      message: "Successfully processed STL file",
      jobId: processingResult.jobId,
      screenshot: screenshotResult.screenshot,
      appBaseUrl: appBaseUrl,
      // Store these for the workflow
      imageUrl: screenshotResult.screenshot.image,
      imageTitle: screenshotResult.screenshot.label,
    }
  } catch (error) {
    console.error("Error processing STL file:", error)

    await bp.messaging.sendMessage({
      conversationId: event.conversationId,
      userId: event.botId,
      message: {
        type: "text",
        text: `Sorry, I couldn't process your 3D model: ${error.message}`,
      },
    })

    return {
      success: false,
      message: `Failed to process STL file: ${error.message}`,
      originalUrl: file_link,
    }
  }
}

// Example usage in Botpress
async function main(bp, event, workflow) {
  // Get the file URL from the workflow
  const fileUrl = workflow.file || event.payload.text

  const result = await processStlFile(fileUrl, bp, event, workflow)

  if (result.success) {
    // Store in workflow for use in Botpress cards
    workflow.processingComplete = true
    workflow.successMessage = "✅ Your 3D model has been processed successfully!"
    workflow.imageUrl = result.imageUrl
    workflow.imageTitle = result.imageTitle
    workflow.jobId = result.jobId
    workflow.appBaseUrl = result.appBaseUrl
  } else {
    workflow.processingComplete = false
    workflow.error = true
    workflow.errorMessage = `❌ ${result.message}`
  }
}

// Run the processing
main(bp, event, workflow)
