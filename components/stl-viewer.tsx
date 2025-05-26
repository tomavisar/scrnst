"use client"

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader"
import * as THREE from "three"

interface StlModelProps {
  stlUrl: string
}

const StlModel = ({ stlUrl }: StlModelProps) => {
  const geometry = useLoader(STLLoader, stlUrl)

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color="#808080" roughness={0.5} metalness={0.5} />
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
  const captureScreenshot = () => {
    return new Promise<string>((resolve) => {
      // Render scene using the renderer directly from useThree
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
    const maxDim = Math.max(size.x, size.y, size.z) * 2

    // Create an array to hold all camera positions with labels
    const positions: Array<{ position: THREE.Vector3; label: string }> = []

    // 8 corners of the bounding cube
    positions.push({
      position: new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Front Right",
    })
    positions.push({
      position: new THREE.Vector3(1, 1, -1).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Front Left",
    })
    positions.push({
      position: new THREE.Vector3(1, -1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Bottom Front Right",
    })
    positions.push({
      position: new THREE.Vector3(1, -1, -1).normalize().multiplyScalar(maxDim).add(center),
      label: "Bottom Front Left",
    })
    positions.push({
      position: new THREE.Vector3(-1, 1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Back Right",
    })
    positions.push({
      position: new THREE.Vector3(-1, 1, -1).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Back Left",
    })
    positions.push({
      position: new THREE.Vector3(-1, -1, 1).normalize().multiplyScalar(maxDim).add(center),
      label: "Bottom Back Right",
    })
    positions.push({
      position: new THREE.Vector3(-1, -1, -1).normalize().multiplyScalar(maxDim).add(center),
      label: "Bottom Back Left",
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

    // 2 additional diagonal views
    positions.push({
      position: new THREE.Vector3(0.7, 0.7, 0).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Diagonal 1",
    })
    positions.push({
      position: new THREE.Vector3(0, 0.7, 0.7).normalize().multiplyScalar(maxDim).add(center),
      label: "Top Diagonal 2",
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
        // Add a small delay to ensure the camera has updated
        await new Promise((resolve) => setTimeout(resolve, 100))
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
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <OrbitControls ref={controlsRef} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
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
    <Canvas shadows gl={{ preserveDrawingBuffer: true }} className="w-full h-full">
      <SceneCapture ref={ref} stlUrl={stlUrl} />
    </Canvas>
  )
})

// Expose the capture method globally for Puppeteer access

StlViewer.displayName = "StlViewer"

export default StlViewer
