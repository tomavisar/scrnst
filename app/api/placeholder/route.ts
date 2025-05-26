import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const label = searchParams.get("label") || "STL View"
    const width = Number.parseInt(searchParams.get("width") || "800")
    const height = Number.parseInt(searchParams.get("height") || "600")

    // Create an SVG with the label
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
          </linearGradient>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" stroke-width="1" opacity="0.1"/>
          </pattern>
        </defs>
        
        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#grad)" />
        
        <!-- Grid pattern -->
        <rect width="${width}" height="${height}" fill="url(#grid)" />
        
        <!-- 3D-like box -->
        <g transform="translate(${width / 2}, ${height / 2})">
          <!-- Back face -->
          <path d="M -100,-100 L 100,-100 L 100,100 L -100,100 Z" 
                fill="none" stroke="white" stroke-width="2" opacity="0.3"
                transform="translate(20, 20)" />
          
          <!-- Front face -->
          <path d="M -100,-100 L 100,-100 L 100,100 L -100,100 Z" 
                fill="none" stroke="white" stroke-width="3" opacity="0.8" />
          
          <!-- Connecting lines -->
          <line x1="-100" y1="-100" x2="-80" y2="-80" stroke="white" stroke-width="2" opacity="0.5" />
          <line x1="100" y1="-100" x2="120" y2="-80" stroke="white" stroke-width="2" opacity="0.5" />
          <line x1="100" y1="100" x2="120" y2="120" stroke="white" stroke-width="2" opacity="0.5" />
          <line x1="-100" y1="100" x2="-80" y2="120" stroke="white" stroke-width="2" opacity="0.5" />
        </g>
        
        <!-- Text -->
        <text x="${width / 2}" y="${height / 2 - 20}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="white">
          ${label}
        </text>
        <text x="${width / 2}" y="${height / 2 + 20}" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="white" opacity="0.8">
          3D Model View
        </text>
        
        <!-- Timestamp -->
        <text x="${width - 10}" y="${height - 10}" font-family="Arial, sans-serif" font-size="12" text-anchor="end" fill="white" opacity="0.5">
          Generated: ${new Date().toISOString()}
        </text>
      </svg>
    `

    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()

    // Return the PNG image
    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Error generating placeholder image:", error)

    // Return a simple error image
    const errorSvg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#ef4444" />
        <text x="400" y="300" font-family="Arial" font-size="24" text-anchor="middle" fill="white">
          Error generating image
        </text>
      </svg>
    `

    return new NextResponse(Buffer.from(errorSvg), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
      },
    })
  }
}
