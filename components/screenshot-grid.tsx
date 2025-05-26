"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

// Update the ScreenshotGridProps interface
interface ScreenshotGridProps {
  screenshots: Array<{ image: string; label: string }>
}

export default function ScreenshotGrid({ screenshots }: ScreenshotGridProps) {
  // Update the selectedScreenshot state
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null)

  // Update the downloadScreenshot function
  const downloadScreenshot = (screenshot: { image: string; label: string }, index: number) => {
    const link = document.createElement("a")
    link.href = screenshot.image
    link.download = `${screenshot.label.replace(/\s+/g, "-").toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Update the downloadAllScreenshots function
  const downloadAllScreenshots = () => {
    screenshots.forEach((screenshot, index) => {
      setTimeout(() => {
        downloadScreenshot(screenshot, index)
      }, index * 100) // Stagger downloads to avoid browser issues
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Captured Screenshots</h2>
        <Button onClick={downloadAllScreenshots} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download All
        </Button>
      </div>

      {/* Update the grid rendering */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {screenshots.map((screenshot, index) => (
          <Card
            key={index}
            className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => setSelectedScreenshot(screenshot.image)}
          >
            <div className="relative aspect-square">
              <img
                src={screenshot.image || "/placeholder.svg"}
                alt={`Screenshot ${index + 1} - ${screenshot.label}`}
                className="object-cover w-full h-full"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                {screenshot.label}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadScreenshot(screenshot, index)
                }}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Update the modal rendering */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedScreenshot || "/placeholder.svg"}
              alt="Screenshot preview"
              className="max-w-full max-h-[80vh] object-contain"
            />
            <Button className="absolute top-2 right-2" variant="outline" onClick={() => setSelectedScreenshot(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
