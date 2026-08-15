/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MindMapNode, MindMapEdge, User, NodeShape } from '../types.js';
import { 
  ZoomIn, ZoomOut, Maximize, Plus, Trash2, Edit3, MessageCircle, Heart, Star, 
  Eye, Download, Shapes, Layers, Sparkles, Play, Pause, SkipForward, SkipBack, 
  Wand2, LayoutGrid, Network, GitFork, ChevronDown, Check, Compass, Crosshair, Presentation, RefreshCw,
  UserCheck, EyeOff, UserX, Filter, X
} from 'lucide-react';
import { downloadCanvasAsImage } from '../utils/exportImage.js';

interface InteractiveCanvas2DProps {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  currentUser: User;
  sessionLayout: 'radial' | 'force' | 'tree' | 'timeline';
  sessionMode: 'brainstorm' | 'moderated' | 'voting';
  spotlightNodeId: string | null;
  studentCanEdit: boolean;
  selectedUserIdFilter?: string | null;
  filterMode?: 'dim' | 'hide';
  onSelectUserFilter?: (userId: string | null) => void;
  createNode: (title: string, parentId: string | null, details?: any) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  dragNode: (nodeId: string, x: number, y: number) => void;
  deleteNode: (nodeId: string) => void;
  createEdge: (sourceId: string, targetId: string) => void;
  deleteEdge?: (edgeId: string) => void;
  addReaction: (nodeId: string, userId: string, emoji: string) => void;
  addVote: (nodeId: string, userId: string) => void;
  spotlightNode: (nodeId: string | null) => void;
  onSelectNode: (node: MindMapNode) => void;
  syncMapState: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
}

export const InteractiveCanvas2D: React.FC<InteractiveCanvas2DProps> = ({
  nodes,
  edges,
  currentUser,
  sessionLayout,
  sessionMode,
  spotlightNodeId,
  studentCanEdit,
  selectedUserIdFilter = null,
  filterMode = 'dim',
  onSelectUserFilter,
  createNode,
  updateNode,
  dragNode,
  deleteNode,
  createEdge,
  deleteEdge,
  addReaction,
  addVote,
  spotlightNode,
  onSelectNode,
  syncMapState,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Pan and Zoom States
  const [pan, setPan] = useState({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 200 });

  // User Filter Local States
  const [internalUserFilter, setInternalUserFilter] = useState<string | null>(null);
  const [localFilterMode, setLocalFilterMode] = useState<'dim' | 'hide'>(filterMode);

  const activeUserFilter = selectedUserIdFilter !== null ? selectedUserIdFilter : internalUserFilter;
  const activeFilterMode = localFilterMode;

  const handleUserFilterSelect = (userId: string | null) => {
    setInternalUserFilter(userId);
    if (onSelectUserFilter) {
      onSelectUserFilter(userId);
    }
  };

  const clearUserFilter = () => {
    handleUserFilterSelect(null);
  };
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Prezi Camera Animation Refs
  const cameraAnimRef = useRef<number | null>(null);
  const layoutAnimRef = useRef<number | null>(null);
  const tourTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto Organize & Layout States
  const [selectedLayoutStyle, setSelectedLayoutStyle] = useState<'tree' | 'radial' | 'bento' | 'timeline' | 'force'>('tree');
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);

  // Prezi Presentation Mode States
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(-1);
  const [isPlayingTour, setIsPlayingTour] = useState(false);

  // Dragging Node State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting Edge State
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  // New Node Inline Popover State
  const [showAddModal, setShowAddModal] = useState<{ parentId: string | null; x: number; y: number; forceTopLevel?: boolean } | null>(null);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeCategory, setNewNodeCategory] = useState('Concept');
  const [newNodeShape, setNewNodeShape] = useState<NodeShape>('rectangle');
  const [placementMode, setPlacementMode] = useState<'child' | 'parent' | 'root'>('child');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Edit Node Modal States
  const [showEditModal, setShowEditModal] = useState<MindMapNode | null>(null);
  const [editNodeTitle, setEditNodeTitle] = useState('');
  const [editNodeCategory, setEditNodeCategory] = useState('');
  const [editNodeShape, setEditNodeShape] = useState<NodeShape>('rectangle');
  const [editNodeColor, setEditNodeColor] = useState('');
  const [editNodeDescription, setEditNodeDescription] = useState('');
  const [editNodeParentId, setEditNodeParentId] = useState<string | null>(null);

  // Cleanup animation frames and intervals on unmount
  useEffect(() => {
    return () => {
      if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);
      if (layoutAnimRef.current) cancelAnimationFrame(layoutAnimRef.current);
      if (tourTimerRef.current) clearInterval(tourTimerRef.current);
    };
  }, []);

  const handleOpenEditModal = (node: MindMapNode) => {
    setShowEditModal(node);
    setEditNodeTitle(node.title);
    setEditNodeCategory(node.category || 'Concept');
    setEditNodeShape(node.shape || 'rectangle');
    setEditNodeColor(node.color || '#10b981');
    setEditNodeDescription(node.description || '');
    setEditNodeParentId(node.parentId || null);
  };

  const handleSaveEditedNode = () => {
    if (!showEditModal || !editNodeTitle.trim()) return;
    const oldParentId = showEditModal.parentId;

    updateNode(showEditModal.id, {
      title: editNodeTitle.trim(),
      category: editNodeCategory,
      shape: editNodeShape,
      color: editNodeColor,
      description: editNodeDescription.trim(),
      parentId: editNodeParentId
    });

    if (editNodeParentId !== oldParentId) {
      // Clear old edges pointing to this node
      const oldEdges = edges.filter(e => e.target === showEditModal.id);
      oldEdges.forEach(e => deleteEdge && deleteEdge(e.id));

      // Create new edge if a new parent was selected
      if (editNodeParentId) {
        createEdge(editNodeParentId, showEditModal.id);
      }
    }

    setShowEditModal(null);
  };

  const handleAddNewNodeAtCenter = (asTopLevel = false) => {
    const width = canvasRef.current?.clientWidth || window.innerWidth;
    const height = canvasRef.current?.clientHeight || window.innerHeight;
    const canvasX = (width / 2 - pan.x) / zoom;
    const canvasY = (height / 2 - pan.y) / zoom;
    
    // Default to link with the root/central node unless explicitly requested top-level
    const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
    const initialParentId = asTopLevel ? null : (rootNode ? rootNode.id : null);

    setPlacementMode(asTopLevel ? 'root' : (initialParentId ? 'child' : 'root'));
    setSelectedParentId(initialParentId);
    setShowAddModal({
      parentId: initialParentId,
      x: Math.round(canvasX + (Math.random() - 0.5) * 60),
      y: Math.round(canvasY + (Math.random() - 0.5) * 60),
      forceTopLevel: asTopLevel
    });
    setNewNodeTitle('');
  };

  // Prezi Smooth Cinematic Camera Controller
  const flyTo = useCallback((targetPanX: number, targetPanY: number, targetZoom: number, duration = 600) => {
    if (cameraAnimRef.current) {
      cancelAnimationFrame(cameraAnimRef.current);
    }

    const startPanX = pan.x;
    const startPanY = pan.y;
    const startZoom = zoom;
    const startTime = performance.now();

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic easing: 1 - Math.pow(1 - progress, 3)
      const ease = 1 - Math.pow(1 - progress, 3);

      const currentPanX = startPanX + (targetPanX - startPanX) * ease;
      const currentPanY = startPanY + (targetPanY - startPanY) * ease;
      const currentZoom = startZoom + (targetZoom - startZoom) * ease;

      setPan({ x: currentPanX, y: currentPanY });
      setZoom(currentZoom);

      if (progress < 1) {
        cameraAnimRef.current = requestAnimationFrame(animateStep);
      } else {
        cameraAnimRef.current = null;
      }
    };

    cameraAnimRef.current = requestAnimationFrame(animateStep);
  }, [pan.x, pan.y, zoom]);

  // Smoothly Fly & Focus onto specific MindMap Node (Prezi Style)
  const flyToNode = useCallback((node: MindMapNode, targetZoom = 1.35) => {
    const width = canvasRef.current?.clientWidth || window.innerWidth;
    const height = canvasRef.current?.clientHeight || window.innerHeight;
    const targetPanX = width / 2 - node.x * targetZoom;
    const targetPanY = height / 2 - node.y * targetZoom;
    flyTo(targetPanX, targetPanY, targetZoom, 650);
  }, [flyTo]);

  // Prezi Fit View (Framing Bounding Box)
  const fitView = useCallback(() => {
    if (nodes.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const width = canvasRef.current?.clientWidth || window.innerWidth;
    const height = canvasRef.current?.clientHeight || window.innerHeight;

    const boundingWidth = Math.max(maxX - minX + 280, 400);
    const boundingHeight = Math.max(maxY - minY + 280, 400);

    const scaleX = (width - 120) / boundingWidth;
    const scaleY = (height - 120) / boundingHeight;
    const targetZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const targetPanX = width / 2 - centerX * targetZoom;
    const targetPanY = height / 2 - centerY * targetZoom;

    flyTo(targetPanX, targetPanY, targetZoom, 650);
  }, [nodes, flyTo]);

  // Handle Spotlight Focus from Educator
  useEffect(() => {
    if (spotlightNodeId) {
      const spotlightNodeObj = nodes.find(n => n.id === spotlightNodeId);
      if (spotlightNodeObj) {
        flyToNode(spotlightNodeObj, 1.3);
      }
    }
  }, [spotlightNodeId, nodes, flyToNode]);

  // Generate Ordered Sequence of Nodes for Prezi Walkthrough (Breadth-First Tree Walk)
  const getPresentationSequence = useCallback(() => {
    if (nodes.length === 0) return [];
    const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
    const result: MindMapNode[] = [];
    const visited = new Set<string>();

    const childrenMap = new Map<string, MindMapNode[]>();
    nodes.forEach(n => {
      if (n.parentId) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId)!.push(n);
      }
    });

    const queue: MindMapNode[] = [rootNode];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current.id)) {
        visited.add(current.id);
        result.push(current);
        const children = childrenMap.get(current.id) || [];
        children.forEach(c => queue.push(c));
      }
    }

    nodes.forEach(n => {
      if (!visited.has(n.id)) result.push(n);
    });

    return result;
  }, [nodes]);

  // Navigation handlers for Prezi presentation mode
  const handleStartPresentation = () => {
    const seq = getPresentationSequence();
    if (seq.length === 0) return;
    setIsPresentationMode(true);
    setPresentationIndex(0);
    flyToNode(seq[0], 1.4);
  };

  const handleNextSlide = useCallback(() => {
    const seq = getPresentationSequence();
    if (seq.length === 0) return;
    const nextIdx = (presentationIndex + 1) % seq.length;
    setPresentationIndex(nextIdx);
    flyToNode(seq[nextIdx], 1.4);
  }, [getPresentationSequence, presentationIndex, flyToNode]);

  const handlePrevSlide = useCallback(() => {
    const seq = getPresentationSequence();
    if (seq.length === 0) return;
    const prevIdx = presentationIndex <= 0 ? seq.length - 1 : presentationIndex - 1;
    setPresentationIndex(prevIdx);
    flyToNode(seq[prevIdx], 1.4);
  }, [getPresentationSequence, presentationIndex, flyToNode]);

  const handleExitPresentation = () => {
    setIsPresentationMode(false);
    setIsPlayingTour(false);
    if (tourTimerRef.current) clearInterval(tourTimerRef.current);
    fitView();
  };

  // Prezi Auto-Tour Interval
  useEffect(() => {
    if (isPlayingTour && isPresentationMode) {
      tourTimerRef.current = setInterval(() => {
        handleNextSlide();
      }, 4500);
    } else {
      if (tourTimerRef.current) clearInterval(tourTimerRef.current);
    }
    return () => {
      if (tourTimerRef.current) clearInterval(tourTimerRef.current);
    };
  }, [isPlayingTour, isPresentationMode, handleNextSlide]);

  // Compute Smart Non-Overlapping Coordinates for Auto-Organize
  const computeSmartLayout = useCallback((layoutStyle: 'tree' | 'radial' | 'bento' | 'timeline' | 'force') => {
    if (nodes.length === 0) return new Map();

    const targetPositions = new Map<string, { x: number; y: number; z?: number }>();
    const rootNode = nodes.find(n => n.parentId === null) || nodes[0];

    const childrenMap = new Map<string, string[]>();
    nodes.forEach(n => {
      if (n.parentId) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId)!.push(n.id);
      }
    });

    if (layoutStyle === 'tree') {
      // Top-Down Hierarchical Tree with balanced subtree leaf math
      const getLeafCount = (nodeId: string): number => {
        const kids = childrenMap.get(nodeId) || [];
        if (kids.length === 0) return 1;
        return kids.reduce((sum, kidId) => sum + getLeafCount(kidId), 0);
      };

      const positionSubtree = (nodeId: string, depth: number, startX: number, availableWidth: number) => {
        const kids = childrenMap.get(nodeId) || [];
        const nodeX = startX + availableWidth / 2;
        const nodeY = depth * 170;

        targetPositions.set(nodeId, { x: Math.round(nodeX), y: Math.round(nodeY), z: depth * 20 });

        if (kids.length === 0) return;

        const totalSubtreeLeaves = kids.reduce((sum, kidId) => sum + getLeafCount(kidId), 0);
        let currentX = startX;

        kids.forEach(kidId => {
          const kidLeaves = getLeafCount(kidId);
          const kidWidth = (kidLeaves / totalSubtreeLeaves) * availableWidth;
          positionSubtree(kidId, depth + 1, currentX, kidWidth);
          currentX += kidWidth;
        });
      };

      const totalLeaves = getLeafCount(rootNode.id);
      const totalWidth = Math.max(totalLeaves * 240, 800);
      positionSubtree(rootNode.id, 0, -totalWidth / 2, totalWidth);

    } else if (layoutStyle === 'radial') {
      // Prezi Orbit Radial Layout
      targetPositions.set(rootNode.id, { x: 0, y: 0, z: 0 });

      const positionRadial = (nodeId: string, depth: number, startAngle: number, endAngle: number) => {
        const kids = childrenMap.get(nodeId) || [];
        if (kids.length === 0) return;

        const angleStep = (endAngle - startAngle) / kids.length;
        const radius = depth * 220;

        kids.forEach((kidId, idx) => {
          const angle = startAngle + angleStep * idx + angleStep / 2;
          const xPos = radius * Math.cos(angle);
          const yPos = radius * Math.sin(angle);

          targetPositions.set(kidId, {
            x: Math.round(xPos),
            y: Math.round(yPos),
            z: depth * 25
          });

          const childSector = angleStep * 0.85;
          positionRadial(kidId, depth + 1, angle - childSector / 2, angle + childSector / 2);
        });
      };

      positionRadial(rootNode.id, 1, 0, Math.PI * 2);

    } else if (layoutStyle === 'bento') {
      // Categorized Modular Bento Grid Layout
      const categoryGroups = new Map<string, MindMapNode[]>();
      nodes.forEach(n => {
        const cat = n.category || 'Concept';
        if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
        categoryGroups.get(cat)!.push(n);
      });

      const categories = Array.from(categoryGroups.keys());
      const cols = Math.ceil(Math.sqrt(categories.length));
      const blockWidth = 500;
      const blockHeight = 350;

      categories.forEach((cat, cIdx) => {
        const groupNodes = categoryGroups.get(cat)!;
        const blockRow = Math.floor(cIdx / cols);
        const blockCol = cIdx % cols;

        const groupOriginX = blockCol * blockWidth - ((cols - 1) * blockWidth) / 2;
        const groupOriginY = blockRow * blockHeight - 180;

        const nodeCols = 2;
        groupNodes.forEach((n, nIdx) => {
          const nx = groupOriginX + (nIdx % nodeCols) * 230;
          const ny = groupOriginY + Math.floor(nIdx / nodeCols) * 145;
          targetPositions.set(n.id, { x: Math.round(nx), y: Math.round(ny), z: 0 });
        });
      });

    } else if (layoutStyle === 'timeline') {
      // Sequential Timeline Flow
      const sequence = getPresentationSequence();
      sequence.forEach((n, idx) => {
        const xPos = (idx - Math.floor(sequence.length / 2)) * 260;
        const yPos = (idx % 2 === 0 ? -1 : 1) * 120 + (n.parentId ? 50 : 0);
        targetPositions.set(n.id, { x: Math.round(xPos), y: Math.round(yPos), z: 0 });
      });

    } else {
      // Physics Collision Resolver (Force-directed repulsion)
      nodes.forEach(n => {
        targetPositions.set(n.id, { x: n.x, y: n.y, z: n.z || 0 });
      });

      for (let iter = 0; iter < 30; iter++) {
        nodes.forEach(n1 => {
          const p1 = targetPositions.get(n1.id)!;
          nodes.forEach(n2 => {
            if (n1.id === n2.id) return;
            const p2 = targetPositions.get(n2.id)!;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = 210;

            if (dist < minDist) {
              const overlap = (minDist - dist) / 2;
              const nx = (dx / dist) * overlap;
              const ny = (dy / dist) * overlap;

              if (n1.id !== rootNode.id) {
                p1.x -= nx * 0.5;
                p1.y -= ny * 0.5;
              }
              if (n2.id !== rootNode.id) {
                p2.x += nx * 0.5;
                p2.y += ny * 0.5;
              }
            }
          });
        });
      }

      nodes.forEach(n => {
        const pos = targetPositions.get(n.id)!;
        targetPositions.set(n.id, { x: Math.round(pos.x), y: Math.round(pos.y), z: pos.z });
      });
    }

    return targetPositions;
  }, [nodes, getPresentationSequence]);

  // Smooth Gliding Animation for Auto-Organize
  const animateNodesToTargetPositions = useCallback((targetPositions: Map<string, { x: number; y: number; z?: number }>) => {
    if (layoutAnimRef.current) cancelAnimationFrame(layoutAnimRef.current);
    setIsOrganizing(true);

    const initialPositions = new Map<string, { x: number; y: number; z?: number }>();
    nodes.forEach(n => {
      initialPositions.set(n.id, { x: n.x, y: n.y, z: n.z || 0 });
    });

    const startTime = performance.now();
    const duration = 650; // ms

    const stepAnim = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Quartic ease out for butter-smooth gliding transition
      const ease = 1 - Math.pow(1 - progress, 4);

      const updatedNodes = nodes.map(n => {
        const init = initialPositions.get(n.id) || { x: n.x, y: n.y, z: n.z || 0 };
        const target = targetPositions.get(n.id) || { x: n.x, y: n.y, z: n.z || 0 };

        return {
          ...n,
          x: Math.round(init.x + (target.x - init.x) * ease),
          y: Math.round(init.y + (target.y - init.y) * ease),
          z: Math.round((init.z || 0) + ((target.z || 0) - (init.z || 0)) * ease)
        };
      });

      syncMapState(updatedNodes, edges);

      if (progress < 1) {
        layoutAnimRef.current = requestAnimationFrame(stepAnim);
      } else {
        layoutAnimRef.current = null;
        setIsOrganizing(false);
        // Automatically frame the tidy map smoothly
        setTimeout(() => fitView(), 50);
      }
    };

    layoutAnimRef.current = requestAnimationFrame(stepAnim);
  }, [nodes, edges, syncMapState, fitView]);

  // Trigger Smart Auto Organize
  const handleOrganizeMap = (layoutStyle = selectedLayoutStyle) => {
    setSelectedLayoutStyle(layoutStyle);
    setShowLayoutMenu(false);
    const targetMap = computeSmartLayout(layoutStyle);
    animateNodesToTargetPositions(targetMap);
  };

  // Prezi Cursor Focal Point Mouse Wheel Zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.15), 3.5);

    if (newZoom === zoom) return;

    // Calculate canvas focal coordinates
    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;

    const newPanX = mouseX - canvasX * newZoom;
    const newPanY = mouseY - canvasY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Handle Board Dragging / Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'grid-background') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggingNodeId) {
      const canvasX = (e.clientX - pan.x) / zoom;
      const canvasY = (e.clientY - pan.y) / zoom;
      
      const targetX = Math.round(canvasX - dragOffset.x);
      const targetY = Math.round(canvasY - dragOffset.y);
      
      dragNode(draggingNodeId, targetX, targetY);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Drag Trigger
  const handleNodeDragStart = (e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();
    if (currentUser.role === 'student' && !studentCanEdit) return;
    if (currentUser.role === 'student' && node.createdById !== currentUser.id) return;

    setDraggingNodeId(node.id);
    
    // Calculate mouse position relative to node center in canvas coordinates
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;
    
    setDragOffset({
      x: canvasX - node.x,
      y: canvasY - node.y
    });
  };

  // Canvas Double Click (Add New Floating Node)
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (currentUser.role === 'student' && !studentCanEdit) return;
    
    // Prevent double clicking on control buttons/panels from adding a node
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;

    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;

    // Find the closest node to automatically link it
    let closestNode: MindMapNode | null = null;
    let minDistance = Infinity;
    nodes.forEach(n => {
      const dist = Math.sqrt((n.x - canvasX) ** 2 + (n.y - canvasY) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestNode = n;
      }
    });

    const initialParentId = closestNode ? (closestNode as MindMapNode).id : null;
    setSelectedParentId(initialParentId);
    setPlacementMode(initialParentId ? 'child' : 'root');
    setShowAddModal({
      parentId: initialParentId,
      x: Math.round(canvasX),
      y: Math.round(canvasY)
    });
    setNewNodeTitle('');
  };

  const handleSaveNode = () => {
    if (!newNodeTitle.trim() || !showAddModal) return;

    const colorPresets = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#06b6d4'];
    const randomColor = colorPresets[Math.floor(Math.random() * colorPresets.length)];

    const targetNode = selectedParentId ? nodes.find(n => n.id === selectedParentId) : null;

    if (placementMode === 'parent' && targetNode) {
      // Insertion of an Upper Shape ABOVE targetNode:
      // Moves targetNode and its entire sub-boundary/children under this new upper shape
      const oldParentIdOfTarget = targetNode.parentId;
      const newUpperNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // Position new upper node above targetNode
      const upperX = showAddModal.x;
      const upperY = showAddModal.y;

      // 1. Create New Upper Node with parent set to targetNode's old parent (if any)
      createNode(newNodeTitle, oldParentIdOfTarget, {
        id: newUpperNodeId,
        category: newNodeCategory,
        color: randomColor,
        x: upperX,
        y: upperY,
        z: 0,
        description: `Upper level grouping created by ${currentUser.name}.`,
        shape: newNodeShape
      });

      // 2. Reparent targetNode under newUpperNodeId
      updateNode(targetNode.id, { parentId: newUpperNodeId });

      // 3. Remove old edge pointing from oldParent -> targetNode (if it existed)
      if (oldParentIdOfTarget) {
        const oldEdge = edges.find(e => e.source === oldParentIdOfTarget && e.target === targetNode.id);
        if (oldEdge && deleteEdge) {
          deleteEdge(oldEdge.id);
        }
      }

      // 4. Create new edge newUpperNodeId -> targetNode
      createEdge(newUpperNodeId, targetNode.id);

    } else if (placementMode === 'child' && targetNode) {
      // Sub-branch under targetNode
      createNode(newNodeTitle, targetNode.id, {
        category: newNodeCategory,
        color: randomColor,
        x: showAddModal.x,
        y: showAddModal.y,
        z: 0,
        description: `Discovered by ${currentUser.name} during the session.`,
        shape: newNodeShape
      });
    } else {
      // Standalone Root
      createNode(newNodeTitle, null, {
        category: newNodeCategory,
        color: randomColor,
        x: showAddModal.x,
        y: showAddModal.y,
        z: 0,
        description: `Created by ${currentUser.name} as a top-level root concept.`,
        shape: newNodeShape
      });
    }

    setShowAddModal(null);
    setNewNodeShape('rectangle');
    setPlacementMode('child');
    setSelectedParentId(null);
  };

  return (
    <div 
      id="canvas-view-container"
      ref={canvasRef}
      className="relative w-full h-[75vh] md:h-[82vh] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 select-none cursor-grab active:cursor-grabbing shadow-sm"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleCanvasDoubleClick}
    >
      {/* Absolute Canvas Background Grid */}
      <div 
        id="grid-background"
        className="absolute inset-0 graph-canvas-grid-light dark:graph-canvas-grid-dark transition-all duration-100"
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`
        }}
      />

      {/* Connection Links Layer (SVG Lines) */}
      <svg 
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {edges.map((edge) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            if (!sourceNode || !targetNode) return null;

            // Check author filter match for edge connection
            const isSrcMatch = !activeUserFilter || (sourceNode.createdById === activeUserFilter || sourceNode.createdByName === activeUserFilter);
            const isTgtMatch = !activeUserFilter || (targetNode.createdById === activeUserFilter || targetNode.createdByName === activeUserFilter);
            const isEdgeMatch = isSrcMatch || isTgtMatch;

            if (activeUserFilter && !isEdgeMatch && activeFilterMode === 'hide') {
              return null; // Invisible: hide non-matching edges
            }

            // Draw clean curved cubic bezier connections
            const startX = sourceNode.x;
            const startY = sourceNode.y;
            const endX = targetNode.x;
            const endY = targetNode.y;

            const midX = (startX + endX) / 2;
            const controlPointX = midX;
            const controlPointY = startY;

            const pathData = edge.style === 'curved' 
              ? `M ${startX} ${startY} Q ${controlPointX} ${controlPointY}, ${endX} ${endY}`
              : `M ${startX} ${startY} L ${endX} ${endY}`;

            return (
              <g key={edge.id} className="transition-opacity duration-300" style={{ opacity: activeUserFilter ? (isEdgeMatch ? 1 : 0.06) : 1 }}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={edge.color || '#cbd5e1'}
                  strokeWidth={edge.thickness || 2}
                  strokeDasharray={edge.style === 'dashed' ? '5,5' : 'none'}
                  className="transition-all duration-300"
                />
                {/* Dynamic relationship labels */}
                {edge.label && (
                  <text
                    x={midX}
                    y={(startY + endY) / 2 - 4}
                    fill="#94a3b8"
                    fontSize="9px"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="bg-white dark:bg-slate-900"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* User Active Cursor Indicators (Live Synced Presence) */}
          {connectingSourceId && (() => {
            const srcNode = nodes.find(n => n.id === connectingSourceId);
            if (!srcNode) return null;
            return (
              <line
                x1={srcNode.x}
                y1={srcNode.y}
                x2={0} // dynamically update is handled locally
                y2={0}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
            );
          })()}
        </g>
      </svg>

      {/* Nodes Render Layer (Absolute Coordinate DOM Divs) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {nodes.map((node) => {
          const isPending = node.status === 'pending';
          const isSpotlighted = node.id === spotlightNodeId;
          const userHasVoted = node.votes?.includes(currentUser.id);
          const totalVotes = node.votes?.length || 0;

          // Check author filter match
          const isAuthorMatch = !activeUserFilter || node.createdById === activeUserFilter || node.createdByName === activeUserFilter;

          if (activeUserFilter && !isAuthorMatch && activeFilterMode === 'hide') {
            return null; // Invisible: Hide work created by other users!
          }

          const shape = node.shape || 'rectangle';
          let shapeClasses = 'rounded-2xl min-w-[150px] max-w-[230px] p-3.5';
          let isVertical = false;

          if (shape === 'circle') {
            shapeClasses = 'rounded-full w-[148px] h-[148px] p-3 flex flex-col justify-between items-center text-center';
            isVertical = true;
          } else if (shape === 'ellipse') {
            shapeClasses = 'rounded-[50%/50%] w-[168px] h-[118px] p-3 flex flex-col justify-between items-center text-center';
            isVertical = true;
          } else if (shape === 'diamond') {
            shapeClasses = 'w-[130px] h-[130px] rotate-45 p-2 flex flex-col justify-center items-center text-center';
            isVertical = true;
          } else if (shape === 'cloud') {
            shapeClasses = 'rounded-[2.2rem_2.2rem_1.2rem_1.2rem] border-dashed min-w-[150px] max-w-[220px] p-3.5';
          } else if (shape === 'hexagon') {
            shapeClasses = 'rounded-3xl border-2 min-w-[160px] max-w-[230px] p-3.5 shadow-md';
          } else if (shape === 'capsule') {
            shapeClasses = 'rounded-full px-5 py-3 min-w-[160px] max-w-[240px]';
          } else if (shape === 'star') {
            shapeClasses = 'rounded-2xl border-2 border-amber-400 min-w-[160px] max-w-[230px] p-3.5 bg-amber-500/5';
          }

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${node.x}px`,
                top: `${node.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`transition-all duration-300 relative ${
                activeUserFilter && !isAuthorMatch
                  ? 'opacity-15 grayscale pointer-events-none scale-95 z-0'
                  : activeUserFilter && isAuthorMatch
                  ? 'pointer-events-auto opacity-100 scale-105 z-20'
                  : 'pointer-events-auto text-slate-800 dark:text-slate-100 z-10'
              }`}
            >
              {/* Filtered User Badge Tag */}
              {activeUserFilter && isAuthorMatch && (
                <div className="absolute -top-3 left-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-bold font-mono px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-30 pointer-events-none animate-in fade-in">
                  <UserCheck className="w-2.5 h-2.5 text-indigo-200" />
                  <span>{node.createdByName}</span>
                </div>
              )}

              {/* Highlight Halo for Spotlight / Selected Mode */}
              {isSpotlighted && (
                <div className={`absolute bg-blue-500/20 dark:bg-blue-400/20 glow-active pointer-events-none ${
                  shape === 'circle' ? 'rounded-full -inset-2' : shape === 'ellipse' ? 'rounded-[50%/50%] -inset-2' : 'rounded-2xl -inset-4'
                }`} />
              )}

              {/* Node Card Container */}
              <div
                onClick={() => {
                  onSelectNode(node);
                  flyToNode(node, 1.25);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (currentUser.role === 'educator' || (studentCanEdit && node.createdById === currentUser.id)) {
                    handleOpenEditModal(node);
                  }
                }}
                onMouseDown={(e) => handleNodeDragStart(e, node)}
                className={`flex flex-col bg-white dark:bg-slate-900 border shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing hover:scale-[1.03] select-none ${shapeClasses} ${
                  activeUserFilter && isAuthorMatch
                    ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30 shadow-xl shadow-indigo-500/10'
                    : isPending 
                    ? 'border-dashed border-amber-400 dark:border-amber-500/70 opacity-85' 
                    : isSpotlighted 
                    ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/15 shadow-md shadow-blue-500/5' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                {/* Inner Content Wrapper */}
                <div className={shape === 'diamond' ? '-rotate-45 w-full h-full flex flex-col justify-between items-center' : 'w-full h-full flex flex-col justify-between'}>
                  {isVertical ? (
                    <>
                      {/* Category tag */}
                      <div className="text-[8px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 truncate max-w-[90px]">
                        {node.category || 'Concept'}
                        {isPending && <span className="text-amber-500 ml-1">pending</span>}
                      </div>

                      {/* Icon & Title */}
                      <div className="flex flex-col items-center gap-0.5 my-auto">
                        <span 
                          style={{ backgroundColor: `${node.color}15`, color: node.color }}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0"
                        >
                          {node.icon || '💡'}
                        </span>
                        <h4 className="text-[10px] font-bold text-slate-800 dark:text-slate-100 font-display tracking-tight leading-tight max-w-[95px] text-center line-clamp-2">
                          {node.title}
                        </h4>
                      </div>

                      {/* Compact Footer Controls */}
                      <div className="flex items-center gap-1 justify-center shrink-0">
                        {/* Voting/Upvote button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addVote(node.id, currentUser.id);
                          }}
                          className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] transition-all font-mono ${
                            userHasVoted 
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' 
                              : 'bg-slate-50 text-slate-400 dark:bg-slate-800/60'
                          }`}
                        >
                          <Star className={`w-2.5 h-2.5 ${userHasVoted ? 'fill-emerald-500' : ''}`} />
                          <span>{totalVotes}</span>
                        </button>

                        {/* Spotlight Trigger for Educator */}
                        {currentUser.role === 'educator' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              spotlightNode(isSpotlighted ? null : node.id);
                            }}
                            className={`p-0.5 rounded transition-colors ${
                              isSpotlighted 
                                ? 'bg-blue-50 text-blue-600' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="Spotlight to Class"
                          >
                            <Eye className="w-2.5 h-2.5" />
                          </button>
                        )}

                        {/* Add Child Node Button */}
                        {(currentUser.role === 'educator' || studentCanEdit) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParentId(node.id);
                              setPlacementMode('child');
                              setShowAddModal({
                                parentId: node.id,
                                x: node.x + 160,
                                y: node.y + Math.round((Math.random() - 0.5) * 80)
                              });
                              setNewNodeTitle('');
                            }}
                            className="p-0.5 text-slate-400 hover:text-emerald-500 transition-colors"
                            title="Add Sub-Branch (Child)"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        )}

                        {/* Insert Upper Shape Above Sub-Boundary Button */}
                        {(currentUser.role === 'educator' || studentCanEdit) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParentId(node.id);
                              setPlacementMode('parent');
                              setShowAddModal({
                                parentId: node.id,
                                x: node.x - 40,
                                y: node.y - 80
                              });
                              setNewNodeTitle('');
                            }}
                            className="p-0.5 text-slate-400 hover:text-amber-500 transition-colors"
                            title="Insert Upper Shape Above (Wrap Sub-Boundary)"
                          >
                            <Layers className="w-2.5 h-2.5" />
                          </button>
                        )}

                        {/* Edit for educator or node creator */}
                        {(currentUser.role === 'educator' || node.createdById === currentUser.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(node);
                            }}
                            className="p-0.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            title="Edit Concept"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                          </button>
                        )}

                        {/* Educators can delete any node; students only their own. */}
                        {(currentUser.role === 'educator' || node.createdById === currentUser.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNode(node.id);
                            }}
                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete Concept Node"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Header Category Tag */}
                      <div className="flex items-center justify-between mb-1 text-[10px] font-mono tracking-wider font-medium uppercase text-slate-400 dark:text-slate-500">
                        <span>{node.category || 'Concept'}</span>
                        {isPending && (
                          <span className="text-amber-500 dark:text-amber-400 lowercase font-mono">pending</span>
                        )}
                      </div>

                      {/* Main Node Body */}
                      <div className="flex items-start gap-2">
                        <span 
                          style={{ backgroundColor: `${node.color}20`, color: node.color }} 
                          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-sm"
                        >
                          {node.icon || '💡'}
                        </span>
                        <div className="flex-grow min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-display break-words">
                            {node.title}
                          </h4>
                          {node.description && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[150px]">
                              {node.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Controls (Upvotes and Quick Reaction counters) */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserFilterSelect(node.createdById || node.createdByName);
                          }}
                          className="text-[9px] font-mono text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                          title={`Click to filter map to show ONLY work by ${node.createdByName}`}
                        >
                          by {node.createdByName.split(' ')[0]}
                        </button>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Voting/Upvote button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addVote(node.id, currentUser.id);
                            }}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all font-mono ${
                              userHasVoted 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900' 
                                : 'bg-slate-50 text-slate-400 hover:text-slate-600 dark:bg-slate-800/60 dark:hover:text-slate-200'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${userHasVoted ? 'fill-emerald-500' : ''}`} />
                            <span>{totalVotes}</span>
                          </button>

                          {/* Spotlight Trigger for Educator */}
                          {currentUser.role === 'educator' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                spotlightNode(isSpotlighted ? null : node.id);
                              }}
                              className={`p-1 rounded transition-colors ${
                                isSpotlighted 
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' 
                                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                              }`}
                              title="Spotlight to Class"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}

                          {/* Add Child Concept Button */}
                          {(currentUser.role === 'educator' || studentCanEdit) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAddModal({
                                  parentId: node.id,
                                  x: node.x + 180,
                                  y: node.y + Math.round((Math.random() - 0.5) * 80)
                                });
                                setNewNodeTitle('');
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"
                              title="Add Child Concept"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}

                          {/* Edit for educator or node creator */}
                          {(currentUser.role === 'educator' || node.createdById === currentUser.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(node);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                              title="Edit Concept"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          {/* Educators can delete any node; students only their own. */}
                          {(currentUser.role === 'educator' || node.createdById === currentUser.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNode(node.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete Concept Node"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Small Reactions List */}
                {node.reactions && Object.keys(node.reactions).length > 0 && (
                  <div className={`flex flex-wrap gap-0.5 mt-1.5 ${isVertical ? 'justify-center absolute bottom-[-15px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 px-1 py-0.5 rounded-full shadow-sm max-w-[120px] overflow-hidden z-20' : ''}`}>
                    {Object.entries(node.reactions).map(([uid, emoji]) => (
                      <span 
                        key={uid} 
                        className="text-[10px] bg-slate-100 dark:bg-slate-800 rounded px-1"
                        title="Student Reaction"
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Contribution Filter Floating HUD Banner (Top Center) */}
      {activeUserFilter && (() => {
        const filteredNodeUser = nodes.find(n => n.createdById === activeUserFilter || n.createdByName === activeUserFilter);
        const filteredUserName = filteredNodeUser?.createdByName || activeUserFilter;
        const userNodes = nodes.filter(n => n.createdById === activeUserFilter || n.createdByName === activeUserFilter);
        const userNodeCount = userNodes.length;

        return (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-900/95 dark:bg-slate-950/95 text-white border border-indigo-500/60 shadow-2xl rounded-2xl px-4 py-2 backdrop-blur-md text-xs font-bold pointer-events-auto animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Displaying work by: <strong className="text-indigo-200 font-display">{filteredUserName}</strong> ({userNodeCount} concept{userNodeCount === 1 ? '' : 's'})</span>
            </div>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            {/* Mode toggle */}
            <button
              onClick={() => setLocalFilterMode(prev => prev === 'dim' ? 'hide' : 'dim')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition shadow-sm"
              title={activeFilterMode === 'dim' ? 'Click to HIDE other users completely' : 'Click to DIM other users'}
            >
              {activeFilterMode === 'dim' ? <Eye className="w-3.5 h-3.5 text-indigo-300" /> : <EyeOff className="w-3.5 h-3.5 text-amber-300" />}
              <span>{activeFilterMode === 'dim' ? 'Dimming Others' : 'Hiding Others'}</span>
            </button>

            {/* Locate button */}
            <button
              onClick={() => {
                if (userNodes.length > 0) {
                  flyToNode(userNodes[0], 1.25);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 transition"
              title="Jump to user's first concept"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Locate</span>
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            {/* Clear filter button */}
            <button
              onClick={clearUserFilter}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              title="Clear filter & show all users' work"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })()}

      {/* Pan & Zoom Canvas Control Panel */}
      <div className="absolute bottom-5 left-5 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-xl p-1.5 pointer-events-auto">
        <button
          onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.2))}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 px-1 min-w-[36px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(prev => Math.min(prev + 0.1, 3))}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
        <button
          onClick={fitView}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Fit Board to Screen"
        >
          <Maximize className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
        
        {/* Insert Top-Level Shape button */}
        <button
          onClick={() => handleAddNewNodeAtCenter(true)}
          disabled={currentUser.role === 'student' && !studentCanEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
          title="Insert New Top-Level Shape on Mind Map"
        >
          <Shapes className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Top-Level Shape</span>
        </button>

        {/* Regular Add Node button */}
        <button
          onClick={() => handleAddNewNodeAtCenter(false)}
          disabled={currentUser.role === 'student' && !studentCanEdit}
          className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40 rounded-lg transition-colors disabled:opacity-50"
          title="Add New Concept Branch"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5" />

        {/* Download Board Image Button */}
        <button
          onClick={() => downloadCanvasAsImage(nodes, edges, { title: 'EzMindSphere Interactive Board', subject: 'Interactive Session', educatorName: 'Ejoe Tso' })}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          title="Download Interactive Board Image (PNG)"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Download Board Image</span>
        </button>
      </div>

      {/* Auto re-layout & Prezi presentation panel (Top Right) */}
      <div className="absolute top-5 right-5 flex items-center gap-2 pointer-events-auto z-30">
        {/* Organize & Tidy Map Button Group */}
        <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-xl p-1">
          <button
            onClick={() => handleOrganizeMap(selectedLayoutStyle)}
            disabled={isOrganizing || nodes.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm font-display disabled:opacity-50 ${
              isOrganizing ? 'animate-pulse' : ''
            }`}
            title="Automatically clean up, resolve overlaps, and well organize all nodes"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isOrganizing ? 'animate-spin' : ''}`} />
            <span>{isOrganizing ? 'Organizing...' : 'Well Organize ✨'}</span>
          </button>

          {/* Layout Selector Dropdown Trigger */}
          <button
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg transition-colors ml-0.5"
            title="Change Auto Organize Layout"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Layout Options Menu */}
          {showLayoutMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 z-50">
              <div className="text-[10px] font-mono uppercase text-slate-400 px-2 py-1 font-semibold">
                Select Smart Layout
              </div>

              {[
                { id: 'tree', label: 'Hierarchical Tree', desc: 'Top-down structured flow', icon: GitFork },
                { id: 'radial', label: 'Prezi Radial Orbit', desc: 'Concentric concept rings', icon: Compass },
                { id: 'bento', label: 'Bento Grid Clusters', desc: 'Categorized modular blocks', icon: LayoutGrid },
                { id: 'timeline', label: 'Timeline Sequence', desc: 'Linear step-by-step', icon: Network },
                { id: 'force', label: 'Physics Collision', desc: 'Auto repel overlaps', icon: RefreshCw },
              ].map(item => {
                const IconComp = item.icon;
                const isSelected = selectedLayoutStyle === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleOrganizeMap(item.id as any)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <div>
                        <div className="leading-none">{item.label}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Prezi Presentation Mode Button */}
        <button
          onClick={handleStartPresentation}
          disabled={nodes.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs transition-all shadow-md font-display disabled:opacity-50"
          title="Launch Prezi Cinematic Zoom Walkthrough"
        >
          <Presentation className="w-4 h-4 text-purple-200" />
          <span>Prezi Mode 🎬</span>
        </button>
      </div>

      {/* Prezi Presentation Floating HUD Bar */}
      {isPresentationMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700/80 shadow-2xl rounded-2xl p-2 px-4 flex items-center gap-3 backdrop-blur-md z-40 pointer-events-auto text-white">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Presentation className="w-4 h-4 text-indigo-400" />
            <span className="font-mono text-[11px] text-slate-300">
              Slide {presentationIndex + 1} of {getPresentationSequence().length}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Active Node Title */}
          {getPresentationSequence()[presentationIndex] && (
            <div className="flex items-center gap-2 max-w-[200px] truncate">
              <span className="text-xs font-bold font-display text-indigo-200 truncate">
                {getPresentationSequence()[presentationIndex].title}
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Presentation Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevSlide}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Previous Concept Slide"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlayingTour(!isPlayingTour)}
              className={`p-1.5 rounded-lg text-white font-bold transition flex items-center gap-1 px-2.5 text-xs ${
                isPlayingTour ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
              title={isPlayingTour ? 'Pause Auto Tour' : 'Play Auto Prezi Tour (4.5s step)'}
            >
              {isPlayingTour ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlayingTour ? 'Pause' : 'Play Tour'}</span>
            </button>

            <button
              onClick={handleNextSlide}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Next Concept Slide"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={fitView}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Overview Frame"
            >
              <Maximize className="w-4 h-4" />
            </button>

            <button
              onClick={handleExitPresentation}
              className="p-1 px-2 text-xs font-bold text-slate-400 hover:text-red-400 transition ml-1"
            >
              Exit ✕
            </button>
          </div>
        </div>
      )}

      {/* Inline Node creation popover modal */}
      {showAddModal && (
        <div className="absolute inset-0 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-5 pointer-events-auto">
            <h3 className="text-sm font-semibold font-display text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              Add Concept to Mind Map
            </h3>

            <div className="space-y-3">
              {/* Level Placement Radio Toggle */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Hierarchy Placement & Connection Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPlacementMode('child');
                      if (!selectedParentId && nodes.length > 0) {
                        const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
                        setSelectedParentId(rootNode.id);
                      }
                    }}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                      placementMode === 'child'
                        ? 'bg-blue-500 text-white border-blue-600 font-bold shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    Sub-Branch
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlacementMode('parent');
                      if (!selectedParentId && nodes.length > 0) {
                        const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
                        setSelectedParentId(rootNode.id);
                      }
                    }}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                      placementMode === 'parent'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    Upper Shape
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlacementMode('root');
                      setSelectedParentId(null);
                    }}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                      placementMode === 'root'
                        ? 'bg-purple-600 text-white border-purple-700 font-bold shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent'
                    }`}
                  >
                    <Shapes className="w-3 h-3" />
                    Standalone
                  </button>
                </div>

                {/* Target Node Selection Dropdown when not root */}
                {placementMode !== 'root' && (
                  <select
                    value={selectedParentId || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setSelectedParentId(val);
                      if (!val) setPlacementMode('root');
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  >
                    <option value="">(Select Target Node)</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.parentId === null ? '🌟 [Main Root] ' : '🌿 '}{n.title} ({n.category || 'Concept'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Concept Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. List Comprehensions"
                  value={newNodeTitle}
                  onChange={(e) => setNewNodeTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNode();
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Category Group
                </label>
                <select
                  value={newNodeCategory}
                  onChange={(e) => setNewNodeCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="Concept">Concept / Theory</option>
                  <option value="Application">Application / Example</option>
                  <option value="Syntax">Syntax / Structure</option>
                  <option value="Reference">Reference / Library</option>
                  <option value="Challenge">Classroom Challenge</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Shape Style
                </label>
                <select
                  value={newNodeShape}
                  onChange={(e) => setNewNodeShape(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="rectangle"> Rounded Rectangle</option>
                  <option value="circle">⭕ Perfect Circle</option>
                  <option value="ellipse">💊 Pill Ellipse</option>
                  <option value="diamond">🔷 Rhombus Diamond</option>
                  <option value="cloud">☁️ Bubbly Cloud</option>
                  <option value="hexagon">⬡ Hexagon</option>
                  <option value="capsule">💊 Capsule</option>
                  <option value="star">★ Golden Star</option>
                </select>
              </div>

              {placementMode === 'parent' && selectedParentId ? (
                <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Inserts upper shape <strong>ABOVE</strong> <span className="font-bold underline">{nodes.find(n => n.id === selectedParentId)?.title || 'Target'}</span>. Moves it & its sub-boundary under this new shape!
                  </span>
                </div>
              ) : placementMode === 'child' && selectedParentId ? (
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Connects as sub-branch <strong>UNDER</strong> <span className="font-bold underline">{nodes.find(n => n.id === selectedParentId)?.title || 'Target'}</span>
                  </span>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200 dark:border-purple-900/50">
                  <Shapes className="w-3.5 h-3.5 shrink-0" />
                  <span>Inserts standalone top-level root concept (no parent link)</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddModal(null)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNode}
                  disabled={!newNodeTitle.trim()}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/15"
                >
                  Add Shape
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="absolute inset-0 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-5 pointer-events-auto">
            <h3 className="text-sm font-semibold font-display text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-500" />
              Edit Concept Node
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Concept Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. List Comprehensions"
                  value={editNodeTitle}
                  onChange={(e) => setEditNodeTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEditedNode();
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Category Group
                </label>
                <select
                  value={editNodeCategory}
                  onChange={(e) => setEditNodeCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="Concept">Concept / Theory</option>
                  <option value="Application">Application / Example</option>
                  <option value="Syntax">Syntax / Structure</option>
                  <option value="Reference">Reference / Library</option>
                  <option value="Challenge">Classroom Challenge</option>
                  <option value="Extension">Extension</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Upper-Level / Parent Link
                </label>
                <select
                  value={editNodeParentId || ''}
                  onChange={(e) => setEditNodeParentId(e.target.value || null)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors font-medium"
                >
                  <option value="">(None - Standalone Top-Level Root)</option>
                  {nodes
                    .filter(n => n.id !== showEditModal.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.parentId === null ? '🌟 [Main Root] ' : '🌿 '}{n.title} ({n.category || 'Concept'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Provide details or notes about this concept..."
                  value={editNodeDescription}
                  onChange={(e) => setEditNodeDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Shape Style
                </label>
                <select
                  value={editNodeShape}
                  onChange={(e) => setEditNodeShape(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="rectangle"> Rounded Rectangle</option>
                  <option value="circle">⭕ Perfect Circle</option>
                  <option value="ellipse">💊 Pill Ellipse</option>
                  <option value="diamond">🔷 Rhombus Diamond</option>
                  <option value="cloud">☁️ Bubbly Cloud</option>
                  <option value="hexagon">⬡ Hexagon</option>
                  <option value="capsule">💊 Capsule</option>
                  <option value="star">★ Golden Star</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1">
                  Color Theme
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditNodeColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        editNodeColor === color 
                          ? 'border-slate-900 scale-110 dark:border-white' 
                          : 'border-transparent hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {(currentUser.role === 'educator' || studentCanEdit || showEditModal.createdById === currentUser.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${showEditModal.title}"?`)) {
                        deleteNode(showEditModal.id);
                        setShowEditModal(null);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-200 dark:border-rose-900/50"
                    title="Delete this concept node"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Node</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEditModal(null)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedNode}
                    disabled={!editNodeTitle.trim()}
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-blue-500/15"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
