import { type NextRequest, NextResponse } from "next/server"
import puppeteer from "puppeteer"

// Generate 16 camera positions around a sphere
function generateCameraPositions(radius = 5) {
  const positions: Array<{ x: number; y: number; z: number }> = []

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

      positions.push({ x, y, z })
    }
  })

  // Add bottom view
  positions.push({ x: 0, y: -radius, z: 0 })

  return positions.slice(0, 16) // Ensure exactly 16 positions
}

// Create HTML page for rendering 3D model
function createRenderHTML(stlData: string, cameraPositions: Array<{ x: number; y: number; z: number }>) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { margin: 0; background: white; }
        canvas { display: block; }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js"></script>
</head>
<body>
    <canvas id="canvas" width="512" height="512"></canvas>
    <script>
        const canvas = document.getElementById('canvas');
        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true, 
            preserveDrawingBuffer: true 
        });
        renderer.setSize(512, 512);
        renderer.setClearColor(0xffffff, 1);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, -10, -5);
        scene.add(fillLight);

        // Load STL
        const loader = new THREE.STLLoader();
        const stlData = "${stlData}";
        const binaryString = atob(stlData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const geometry = loader.parse(bytes.buffer);
        
        // Center and scale geometry
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);

        geometry.translate(-center.x, -center.y, -center.z);
        geometry.scale(2 / maxDimension, 2 / maxDimension, 2 / maxDimension);

        const material = new THREE.MeshPhongMaterial({
            color: 0x888888,
            shininess: 100,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const cameraPositions = ${JSON.stringify(cameraPositions)};
        let currentIndex = 0;
        const screenshots = [];

        function captureScreenshot() {
            if (currentIndex >= cameraPositions.length) {
                window.screenshots = screenshots;
                return;
            }

            const pos = cameraPositions[currentIndex];
            camera.position.set(pos.x, pos.y, pos.z);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();

            renderer.render(scene, camera);
            
            const dataUrl = canvas.toDataURL('image/png');
            screenshots.push(dataUrl);
            
            currentIndex++;
            setTimeout(captureScreenshot, 100);
        }

        // Start capturing after a short delay
        setTimeout(captureScreenshot, 500);
    </script>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  let browser

  try {
    const formData = await request.formData()
    const file = formData.get("stl") as File

    if (!file) {
      return NextResponse.json({ error: "No STL file provided" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".stl")) {
      return NextResponse.json({ error: "File must be an STL file" }, { status: 400 })
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString("base64")

    // Generate camera positions
    const cameraPositions = generateCameraPositions(5)

    // Create HTML for rendering
    const html = createRenderHTML(base64Data, cameraPositions)

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 512, height: 512 })

    // Set content and wait for rendering
    await page.setContent(html)

    // Wait for screenshots to be captured
    await page.waitForFunction(() => window.screenshots && window.screenshots.length === 16, {
      timeout: 30000,
    })

    // Get screenshots
    const screenshots = await page.evaluate(() => window.screenshots)

    await browser.close()

    return NextResponse.json({
      success: true,
      screenshots: screenshots,
      count: screenshots.length,
      filename: file.name,
    })
  } catch (error) {
    if (browser) {
      await browser.close()
    }

    console.error("Error processing STL file:", error)
    return NextResponse.json(
      {
        error: "Failed to process STL file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
