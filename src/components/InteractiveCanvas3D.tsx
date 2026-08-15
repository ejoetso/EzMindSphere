/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MindMapNode, MindMapEdge } from '../types.js';

interface InteractiveCanvas3DProps {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  spotlightNodeId: string | null;
  onSelectNode: (node: MindMapNode) => void;
}

export const InteractiveCanvas3D: React.FC<InteractiveCanvas3DProps> = ({
  nodes,
  edges,
  spotlightNodeId,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<MindMapNode[]>(nodes);
  const spotlightRef = useRef<string | null>(spotlightNodeId);

  // Keep references updated for the animation loop
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    spotlightRef.current = spotlightNodeId;
  }, [spotlightNodeId]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712'); // Deep cosmic dark background

    // Atmospheric Fog
    scene.fog = new THREE.FogExp2('#030712', 0.0006);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(0, 300, 600);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight('#4f46e5', 1.5);
    dirLight1.position.set(200, 400, 300);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('#10b981', 1.0);
    dirLight2.position.set(-200, -400, -300);
    scene.add(dirLight2);

    // 3. Ambient Starfield Background
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 600;
    const starsPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i++) {
      starsPositions[i] = (Math.random() - 0.5) * 2000;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: '#94a3b8',
      size: 1.5,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(2000, 100, '#334155', '#1e293b');
    gridHelper.position.y = -350;
    scene.add(gridHelper);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 1500;
    controls.minDistance = 50;

    // 5. Maps to hold Three.js Mesh objects associated with Node IDs
    const nodeMeshes = new Map<string, THREE.Group>();
    const edgeLines = new Map<string, THREE.Line>();
    const labelSprites = new Map<string, THREE.Sprite>();

    // Helper to draw textured rounded billboards for node labels
    const createTextLabelSprite = (text: string, category: string, colorHex: string, isSpotlighted: boolean) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Sprite();

      // Clear with rounded bounding card
      ctx.fillStyle = '#0f172a'; // Deep indigo slate card
      ctx.strokeStyle = isSpotlighted ? '#3b82f6' : colorHex;
      ctx.lineWidth = 6;

      // Draw Rounded Rect Card Box
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      roundRect(8, 8, 496, 112, 24);

      // Category Tag Header
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(category.toUpperCase(), 32, 42);

      // Title Text
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(text, 32, 86);

      // Create Sprite
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      // Billboard scale relative to sphere node
      sprite.scale.set(160, 40, 1);
      return sprite;
    };

    // 6. Interactivity (Raycasting)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Raycast against all node meshes
      const targetMeshes: THREE.Object3D[] = [];
      nodeMeshes.forEach((group) => {
        const sphereMesh = group.getObjectByName('sphere');
        if (sphereMesh) targetMeshes.push(sphereMesh);
      });

      const intersects = raycaster.intersectObjects(targetMeshes);
      if (intersects.length > 0) {
        const sphereMesh = intersects[0].object;
        // Find owner node ID from the parent group
        const group = sphereMesh.parent;
        if (group) {
          const nodeId = group.name;
          const matchedNode = nodesRef.current.find(n => n.id === nodeId);
          if (matchedNode) {
            onSelectNode(matchedNode);

            // Smooth camera transition focus target
            const targetPos = group.position;
            const duration = 800;
            const startCameraPos = camera.position.clone();
            const startTarget = controls.target.clone();
            const targetCameraPos = targetPos.clone().add(new THREE.Vector3(0, 150, 300));
            
            const startTime = performance.now();
            const animateCamera = (time: number) => {
              const elapsed = time - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Smooth easing
              const ease = 1 - Math.pow(1 - progress, 3);

              camera.position.lerpVectors(startCameraPos, targetCameraPos, ease);
              controls.target.lerpVectors(startTarget, targetPos, ease);

              if (progress < 1) {
                requestAnimationFrame(animateCamera);
              }
            };
            requestAnimationFrame(animateCamera);
          }
        }
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 7. Dynamic Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const currentNodes = nodesRef.current;
      const currentSpotlight = spotlightRef.current;

      // Ensure nodes have active meshes and interpolate towards their synced x, y, z positions
      currentNodes.forEach((node) => {
        let group = nodeMeshes.get(node.id);

        if (!group) {
          // Create visual 3D sphere representation
          group = new THREE.Group();
          group.name = node.id;

          // Sphere Geometry
          const size = node.parentId === null ? 18 : 12; // Root node is larger
          const geometry = new THREE.SphereGeometry(size, 32, 32);
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(node.color),
            roughness: 0.2,
            metalness: 0.1,
            emissive: new THREE.Color(node.color),
            emissiveIntensity: 0.15,
          });

          const sphere = new THREE.Mesh(geometry, material);
          sphere.name = 'sphere';
          group.add(sphere);

          // Add glowing neon ring around active node
          const ringGeo = new THREE.RingGeometry(size * 1.3, size * 1.5, 30);
          const ringMat = new THREE.MeshBasicMaterial({
            color: node.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.name = 'ring';
          ring.rotation.x = Math.PI / 2;
          group.add(ring);

          scene.add(group);
          nodeMeshes.set(node.id, group);

          // Setup billboard labels
          const isSpotlighted = node.id === currentSpotlight;
          const labelSprite = createTextLabelSprite(node.title, node.category || 'Concept', node.color, isSpotlighted);
          labelSprite.position.set(0, size + 25, 0);
          group.add(labelSprite);
          labelSprites.set(node.id, labelSprite);
        }

        // Smoothly slide coordinates (lerp)
        const targetX = node.x;
        const targetY = node.y;
        const targetZ = node.z;

        // Slow float orbital weave to add beautiful learning cosmic atmospheric vibe
        const floatY = Math.sin(elapsedTime * 2 + (targetX * 0.01)) * 6;

        group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 0.08);
        group.position.y = THREE.MathUtils.lerp(group.position.y, targetY + floatY, 0.08);
        group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, 0.08);

        // Spin outer ring beautifully
        const ring = group.getObjectByName('ring');
        if (ring) {
          ring.rotation.z = elapsedTime * 0.5;
          // Glow intensity oscillation
          const ringMat = (ring as THREE.Mesh).material as THREE.MeshBasicMaterial;
          ringMat.opacity = 0.4 + Math.sin(elapsedTime * 4 + targetX) * 0.25;
        }

        // Spotlight Glow expansion
        if (node.id === currentSpotlight) {
          group.scale.set(1.2, 1.2, 1.2);
        } else {
          group.scale.set(1, 1, 1);
        }
      });

      // Cleanup meshes of deleted nodes
      nodeMeshes.forEach((mesh, id) => {
        if (!currentNodes.some(n => n.id === id)) {
          scene.remove(mesh);
          nodeMeshes.delete(id);
          labelSprites.delete(id);
        }
      });

      // Connect links (edges) drawing
      edges.forEach((edge) => {
        const sourceMesh = nodeMeshes.get(edge.source);
        const targetMesh = nodeMeshes.get(edge.target);

        if (!sourceMesh || !targetMesh) return;

        let line = edgeLines.get(edge.id);
        if (!line) {
          const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(edge.color || '#4f46e5'),
            linewidth: 2, // lines don't natively support thickness, so we keep standard
          });

          const geometry = new THREE.BufferGeometry();
          line = new THREE.Line(geometry, material);
          scene.add(line);
          edgeLines.set(edge.id, line);
        }

        const start = sourceMesh.position;
        const end = targetMesh.position;

        const positions = new Float32Array([
          start.x, start.y, start.z,
          end.x, end.y, end.z
        ]);

        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        line.geometry.computeBoundingSphere();
      });

      // Cleanup deleted edges
      edgeLines.forEach((line, id) => {
        if (!edges.some(e => e.id === id)) {
          scene.remove(line);
          edgeLines.delete(id);
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 8. Handle Resizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    });
    
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [edges, onSelectNode]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-[65vh] md:h-[72vh] rounded-2xl overflow-hidden border border-slate-900 shadow-2xl bg-slate-950"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* Mini 3D Guide overlay */}
      <div className="absolute top-5 left-5 bg-slate-900/80 border border-slate-800 p-3 rounded-xl pointer-events-none text-[10px] font-mono text-slate-400 max-w-[200px]">
        <div className="text-white font-semibold mb-1 font-display">3D Orbit Mechanics</div>
        <div>• Left-Click + Drag: Rotate scene</div>
        <div>• Right-Click + Drag: Pan grid</div>
        <div>• Scroll: Zoom in/out</div>
        <div>• Click Node: Zoom & Focus</div>
      </div>
    </div>
  );
};
