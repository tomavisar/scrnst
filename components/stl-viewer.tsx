"use client"

import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei"
import * as THREE from "three"

interface StlModelProps {
  stlUrl: string
}

// Simple STL parser that works in the browser
class STLLoader {
  parse(data: ArrayBuffer): THREE.BufferGeometry {
    const view = new DataView(data)

    // Check if it's binary STL (starts with solid but has binary data)
    const isBinary = data.byteLength > 80 && view.getUint32(80, true) * 50 + 84 === data.byteLength

    if (isBinary) {
      return this.parseBinary(data)
    } else {
      return this.parseASCII(new TextDecoder().decode(data))
    }
  }

  private parseBinary(data: ArrayBuffer): THREE.BufferGeometry {
    const view = new DataView(data)
    const triangles = view.getUint32(80, true)

    const vertices: number[] = []
    const normals: number[] = []

    let offset = 84

    for (let i = 0; i < triangles; i++) {
      // Normal vector
      const nx = view.getFloat32(offset, true)
      const ny = view.getFloat32(offset + 4, true)
      const nz = view.getFloat32(offset + 8, true)
      offset += 12

      // Three vertices
      for (let j = 0; j < 3; j++) {
        const x = view.getFloat32(offset, true)
        const y = view.getFloat32(offset + 4, true)
        const z = view.getFloat32(offset + 8, true)
        offset += 12

        vertices.push(x, y, z)
        normals.push(nx, ny, nz)
      }

      offset += 2 // Skip attribute byte count
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))

    return geometry
  }

  private parseASCII(data: string): THREE.BufferGeometry {
    const vertices: number[] = []
    const normals: number[] = []

    const lines = data.split("\n")
    let currentNormal = [0, 0, 0]

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith("facet normal")) {
        const parts = trimmed.split(/\s+/)
        currentNormal = [Number.parseFloat(parts[2]), Number.parseFloat(parts[3]), Number.parseFloat(parts[4])]
      } else if (trimmed.startsWith("vertex")) {
        const parts = trimmed.split(/\s+/)
        vertices.push(Number.parseFloat(parts[1]), Number.parseFloat(parts[2]), Number.parseFloat(parts[3]))
        normals.push(...currentNormal)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))

    return geometry
  }
}

const StlModel = ({ stlUrl }: StlModelProps) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSTL = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log("Loading STL from:", stlUrl)

        const loader = new STLLoader()
        const response = await fetch(stlUrl)

        if (!response.ok) {
          throw new Error(`Failed to fetch STL: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        console.log("STL data loaded, size:", arrayBuffer.byteLength, "bytes")

        const loadedGeometry = loader.parse(arrayBuffer)

        // Center and scale the geometry
        loadedGeometry.computeBoundingBox()
        const box = loadedGeometry.boundingBox!
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        // Center the geometry
        loadedGeometry.translate(-center.x, -center.y, -center.z)

        // Scale to fit in a 2x2x2 box
        if (maxDim > 0) {
          const scale = 2 / maxDim
          loadedGeometry.scale(scale, scale, scale)
        }

        console.log("STL geometry processed successfully")
        setGeometry(loadedGeometry)
      } catch (error) {
        console.error("Error loading STL:", error)
        setError(error instanceof Error ? error.message : "Failed to load STL")
      } finally {
        setLoading(false)
      }
    }

    if (stlUrl) {
      loadSTL()
    }
  }, [stlUrl])

  if (loading) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#e9ecef" />
        <meshBasicMaterial attach="material" color="#6c757d" wireframe />
      </mesh>
    )
  }

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#dc3545" />
      </mesh>
    )
  }

  if (!geometry) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6c757d" />
      </mesh>
    )
  }

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color="#6c757d" roughness={0.3} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

const SceneCapture = forwardRef(({ stlUrl }: StlModelProps, ref) => {
  const { scene, camera, gl } = useThree()
  const controlsRef = useRef(null)

  // Calculate bounding box to position camera correctly
  const calculateBoundingBox = () => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    return { size, center }
  }

  // Position camera at a specific point looking at the center
  const positionCamera = (positionData: { position: THREE.Vector3; label: string }) => {
    if (!controlsRef.current) return

    const { center } = calculateBoundingBox()

    camera.position.copy(positionData.position)
    camera.lookAt(center)

    // Update controls target
    const controls = controlsRef.current as any
    controls.target.copy(center)
    controls.update()
  }

  // Capture screenshot
  const captureScreenshot = (): Promise<string> => {
    return new Promise((resolve) => {
      // Force a render
      gl.render(scene, camera)

      // Get canvas and create screenshot
      const canvas = gl.domElement
      const screenshot = canvas.toDataURL("image/png")
      resolve(screenshot)
    })
  }

  // Generate camera positions for all corners and sides
  const generateCameraPositions = () => {
    const { size, center } = calculateBoundingBox()
    const maxDim = Math.max(size.x, size.y, size.z) * 3 // Move camera further back

    // Create an array to hold all camera positions with labels
    const positions: Array<{ position: THREE.Vector3; label: string }> = []

    // 8 corners of the bounding cube
    positions.push({
      position: new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Front Right",
    })
    positions.push({
      position: new THREE.Vector3(-1, 1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Front Left",
    })
    positions.push({
      position: new THREE.Vector3(1, -1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Bottom Front Right",
    })
    positions.push({
      position: new THREE.Vector3(-1, -1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Bottom Front Left",
    })

    // 6 faces of the bounding cube
    positions.push({
      position: new THREE.Vector3(maxDim, 0, 0).add(center),
      label: "Right Side",
    })
    positions.push({
      position: new THREE.Vector3(-maxDim, 0, 0).add(center),
      label: "Left Side",
    })
    positions.push({
      position: new THREE.Vector3(0, maxDim, 0).add(center),
      label: "Top View",
    })
    positions.push({
      position: new THREE.Vector3(0, -maxDim, 0).add(center),
      label: "Bottom View",
    })
    positions.push({
      position: new THREE.Vector3(0, 0, maxDim).add(center),
      label: "Front View",
    })
    positions.push({
      position: new THREE.Vector3(0, 0, -maxDim).add(center),
      label: "Back View",
    })

    return positions
  }

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    async captureScreenshots() {
      const result: Array<{ image: string; label: string }> = []
      const cameraPositions = generateCameraPositions()

      for (const positionData of cameraPositions) {
        positionCamera(positionData)
        // Add a delay to ensure the camera has updated and scene is rendered
        await new Promise((resolve) => setTimeout(resolve, 200))
        const screenshot = await captureScreenshot()
        result.push({
          image: screenshot,
          label: positionData.label,
        })
      }

      return result
    },
  }))

  return (
    <>
      <PerspectiveCamera makeDefault position={[3, 3, 3]} />
      <OrbitControls ref={controlsRef} enablePan={true} enableZoom={true} enableRotate={true} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} />
      <directionalLight position={[-10, -10, -10]} intensity={0.3} />
      <Environment preset="studio" />
      <StlModel stlUrl={stlUrl} />
    </>
  )
})

SceneCapture.displayName = "SceneCapture"

interface StlViewerProps {
  stlUrl: string
}

const StlViewer = forwardRef<unknown, StlViewerProps>(({ stlUrl }, ref) => {
  useEffect(() => {
    if (ref && typeof ref === "object" && "current" in ref) {
      ;(window as any).stlViewerRef = ref.current
    }

    return () => {
      if ((window as any).stlViewerRef) {
        delete (window as any).stlViewerRef
      }
    }
  }, [ref])

  return (
    <div className="w-full h-full bg-gray-100">
      <Canvas
        shadows
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: false,
        }}
        className="w-full h-full"
        camera={{ position: [3, 3, 3], fov: 50 }}
      >
        <SceneCapture ref={ref} stlUrl={stlUrl} />
      </Canvas>
    </div>
  )
})

StlViewer.displayName = "StlViewer"

export default StlViewer
