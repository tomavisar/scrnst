/**
 * Debug version of Botpress agent with comprehensive error logging
 */
async function processStlFile(file_link) {
  // Your deployed STL processing application URL
  const appBaseUrl = "https://v0-3d-model-screenshots.vercel.app"
  const apiKey = "Tla21317462!"

  console.log("=== BOTPRESS AGENT DEBUG START ===")
  console.log("App Base URL:", appBaseUrl)
  console.log("File Link:", file_link)
  console.log("API Key provided:", !!apiKey)

  try {
    // First, test the basic API connectivity
    console.log("Step 1: Testing API connectivity...")

    try {
      const testResponse = await fetch(`${appBaseUrl}/api/test`, {
        method: "GET",
      })

      console.log("Test response status:", testResponse.status)
      console.log("Test response headers:", Object.fromEntries(testResponse.headers.entries()))

      if (testResponse.ok) {
        const testData = await testResponse.json()
        console.log("✅ API connectivity test successful:", testData)
      } else {
        console.warn("⚠️ API connectivity test failed:", testResponse.statusText)
      }
    } catch (testError) {
      console.error("❌ API connectivity test error:", testError)
    }

    // Validate the URL
    if (!file_link || typeof file_link !== "string") {
      throw new Error("Invalid STL file URL")
    }

    // Fix the URL format if needed
    if (file_link.startsWith("https//")) {
      file_link = file_link.replace("https//", "https://")
      console.log("Fixed URL format:", file_link)
    }

    console.log("Step 2: Processing STL file...")

    // Prepare the request
    const requestBody = {
      stlUrl: file_link,
      apiKey: apiKey,
    }

    console.log("Request body:", requestBody)

    // Send the STL URL to the server for immediate processing
    const response = await fetch(`${appBaseUrl}/api/botpress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    console.log("Response status:", response.status)
    console.log("Response statusText:", response.statusText)
    console.log("Response headers:", Object.fromEntries(response.headers.entries()))

    // Try to get response text first
    let responseText
    try {
      responseText = await response.text()
      console.log("Raw response text:", responseText)
    } catch (textError) {
      console.error("Failed to get response text:", textError)
      throw new Error("Failed to read response from server")
    }

    // Try to parse as JSON
    let result
    try {
      result = JSON.parse(responseText)
      console.log("Parsed response:", result)
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError)
      console.error("Response was:", responseText)
      throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 200)}...`)
    }

    if (!response.ok) {
      console.error("❌ Server returned error status:", response.status)
      throw new Error(`Server error: ${result.error || result.message || response.statusText}`)
    }

    if (!result.success) {
      console.error("❌ Processing failed:", result)
      throw new Error(`Processing failed: ${result.error || result.message || "Unknown error"}`)
    }

    if (!result.screenshots || result.screenshots.length === 0) {
      console.error("❌ No screenshots generated:", result)
      throw new Error("No screenshots were generated")
    }

    console.log(`✅ Successfully generated ${result.screenshots.length} screenshots`)

    // Return the results
    const firstScreenshot = result.firstScreenshot || result.screenshots[0]

    return {
      success: true,
      message: "Successfully processed STL file",
      jobId: result.jobId,
      screenshots: result.screenshots,
      firstScreenshot: firstScreenshot,
      imageUrl: firstScreenshot.image,
      imageTitle: firstScreenshot.label,
      processingTimeMs: result.processingTimeMs,
    }
  } catch (error) {
    console.error("=== BOTPRESS AGENT ERROR ===")
    console.error("Error type:", error.constructor.name)
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)

    return {
      success: false,
      message: `Failed to process STL file: ${error.message}`,
      originalUrl: file_link,
      errorType: error.constructor.name,
    }
  }
}

// Example usage
async function main() {
  const fileUrl = "https://files.bpcontent.cloud/2025/05/26/06/20250526063229-TGFXQGR7.stl"

  console.log("Starting STL processing test...")
  const result = await processStlFile(fileUrl)

  if (result.success) {
    console.log("✅ Test successful!")
    console.log("Screenshots:", result.screenshots.length)
    console.log("First image URL:", result.imageUrl)
  } else {
    console.log("❌ Test failed:", result.message)
  }
}

// Run the test
main()
