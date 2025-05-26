/**
 * API client for the STL Viewer service
 */
export class StlViewerApiClient {
  private baseUrl: string
  private apiKey?: string

  /**
   * Create a new STL Viewer API client
   * @param baseUrl The base URL of the API
   * @param apiKey Optional API key for authentication
   */
  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  /**
   * Upload an STL file to the service
   * @param file The STL file to upload
   * @returns The response from the API
   */
  async uploadStl(file: File): Promise<any> {
    const formData = new FormData()
    formData.append("file", file)

    if (this.apiKey) {
      formData.append("apiKey", this.apiKey)
    }

    const response = await fetch(`${this.baseUrl}/api/upload-stl`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to upload STL file")
    }

    return response.json()
  }

  /**
   * Load an STL file from a URL
   * @param url The URL of the STL file
   * @returns The response from the API
   */
  async loadStlFromUrl(url: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/load-stl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        apiKey: this.apiKey,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to load STL from URL")
    }

    return response.json()
  }

  /**
   * Capture screenshots of an STL model
   * @param stlUrl The URL of the STL file
   * @returns An array of screenshots with labels
   */
  async captureScreenshots(stlUrl: string): Promise<Array<{ image: string; label: string }>> {
    const response = await fetch(`${this.baseUrl}/api/capture-screenshots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stlUrl,
        apiKey: this.apiKey,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to capture screenshots")
    }

    const data = await response.json()
    return data.screenshots
  }
}

// Example usage:
// const client = new StlViewerApiClient('https://your-domain.com');
// const result = await client.uploadStl(file);
// const screenshots = await client.captureScreenshots(result.fileUrl);
