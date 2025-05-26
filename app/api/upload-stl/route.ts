import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No STL file provided" }, { status: 400 })
    }

    // Check if it's an STL file
    if (!file.name.toLowerCase().endsWith(".stl")) {
      return NextResponse.json({ error: "File must be an STL file" }, { status: 400 })
    }

    // Generate a unique filename
    const uniqueId = uuidv4()
    const fileName = `${uniqueId}-${file.name}`
    const filePath = `/uploads/${fileName}`

    // Convert the file to a Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // In a real application, you would save this to a storage service
    // For this example, we'll just return the file data as base64
    const base64 = buffer.toString("base64")

    return NextResponse.json({
      success: true,
      fileName,
      filePath,
      fileUrl: `data:application/octet-stream;base64,${base64}`,
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
