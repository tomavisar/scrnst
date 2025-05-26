import { type NextRequest, NextResponse } from "next/server"
import * as THREE from "three"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import gl from "gl"

// Create a headless WebGL context
function createHeadlessRenderer(width: number, height: number) {
  const context = gl(width, height, { preserveDrawingBuffer: true })

  const renderer = new THREE.WebGLRenderer({
    context: context as any,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })

  renderer.setSize(width, height)
  renderer.setClearColor(0xffffff, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  return renderer
}

// Generate 16 camera positions around a sphere
function generateCameraPositions(radius = 5) {
  const positions: THREE.Vector3[] = []

  // 4 elevation levels
  const elevations = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2]

  elevations.forEach((elevation, elevIndex) => {
    // 4 azimuth angles per elevation
    const azimuthCount = elevIndex === 3 ? 1 : 4 // Top view only needs 1 position

    for (let i = 0; i < azimuthCount; i++) {
      const azimuth = (i / azimuthCount) * Math.PI * 2

      const x = radius * Math.cos(elevation) * Math.cos(azimuth)
      const y = radius * Math.sin(elevation)
      const z = radius * Math.cos(elevation) * Math.sin(azimuth)

      positions.push(new THREE.Vector3(x, y, z))
    }
  })

  // Add bottom view
  positions.push(new THREE.Vector3(0, -radius, 0))

  return positions.slice(0, 16) // Ensure exactly 16 positions
}

// Load and process STL file
async function loadSTLGeometry(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const loader = new STLLoader()
  return new Promise((resolve, reject) => {
    try {
      const geometry = loader.parse(buffer)
      resolve(geometry)
    } catch (error) {
      reject(error)
    }
  })
}

// Render scene from a specific camera position
function renderScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  cameraPosition: THREE.Vector3,
): string {
  // Position camera
  camera.position.copy(cameraPosition)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  // Render
  renderer.render(scene, camera)

  // Get image data
  const canvas = renderer.domElement
  return canvas.toDataURL("image/png")
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("stl") as File

    if (!file) {
      return NextResponse.json({ error: "No STL file provided" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".stl")) {
      return NextResponse.json({ error: "File must be an STL file" }, { status: 400 })
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Load STL geometry
    const geometry = await loadSTLGeometry(arrayBuffer)

    // Center and scale the geometry
    geometry.computeBoundingBox()
    const boundingBox = geometry.boundingBox!
    const center = boundingBox.getCenter(new THREE.Vector3())
    const size = boundingBox.getSize(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z)

    geometry.translate(-center.x, -center.y, -center.z)
    geometry.scale(2 / maxDimension, 2 / maxDimension, 2 / maxDimension)

    // Create scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    // Create material
    const material = new THREE.MeshPhongMaterial({
      color: 0x888888,
      shininess: 100,
      side: THREE.DoubleSide,
    })

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-10, -10, -5)
    scene.add(fillLight)

    // Create renderer
    const width = 512
    const height = 512
    const renderer = createHeadlessRenderer(width, height)

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)

    // Generate camera positions
    const cameraPositions = generateCameraPositions(5)

    // Render screenshots
    const screenshots: string[] = []

    for (let i = 0; i < cameraPositions.length; i++) {
      const dataUrl = renderScene(renderer, scene, camera, cameraPositions[i])
      screenshots.push(dataUrl)
    }

    // Clean up
    renderer.dispose()
    geometry.dispose()
    material.dispose()

    return NextResponse.json({
      success: true,
      screenshots: screenshots,
      count: screenshots.length,
      filename: file.name,
    })
  } catch (error) {
    console.error("Error processing STL file:", error)
    return NextResponse.json(
      { error: "Failed to process STL file", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
