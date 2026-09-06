import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as d3Force3D from 'd3-force-3d';
import { getTransactionStatus, STATUS_COLORS } from '../utils/statusHelper.js';

export class ThreeForensicGraph {
  constructor(containerEl, onNodeSelectedCallback, onTraceUpdatedCallback) {
    this.container = containerEl;
    this.onNodeSelected = onNodeSelectedCallback;
    this.onTraceUpdated = onTraceUpdatedCallback;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationFrameId = null;
    this.isPaused = false;

    // Reusable math objects to prevent garbage collection allocations in animation loop
    this.projectVector = new THREE.Vector3();
    this.tempVec = new THREE.Vector3();

    // Shared Geometries & Materials (Zero allocation in render loop)
    this.sharedNodeGeometry = null;
    this.sharedGemGeometry = null;
    this.sharedMaterials = {};
    this.dimmedMaterials = {};
    this.lastHoverCheck = 0;

    // Data & Mesh Maps
    this.rawNodes = [];
    this.rawLinks = [];
    this.nodeMeshMap = new Map();     // id -> THREE.Mesh
    this.nodeDataMap = new Map();     // id -> nodeData
    this.nodePositionMap = new Map(); // id -> { x, y, z }
    this.baseEdgesLineMesh = null;    // All standard readable transaction edges
    this.focusEdgesLineMesh = null;   // Threat transaction edges
    this.activeFocusLineMesh = null;  // Highlighted path lines for selected node / trace
    this.sliceCoordCache = new Map(); // timestep -> Map(id -> {x, y, z})

    // Dedicated Transmission Animation Layer
    this.clock = new THREE.Clock();
    this.transmissionLayer = null;
    this.transmissionPackets = [];
    this.flowParticlePoints = null;
    this.flowParticleGeo = null;
    this.flowParticleMat = null;
    this.flowParticles = [];
    this.maxFlowParticles = 180;

    // Adjacency Map for 1-hop & 2-hop neighborhood queries
    this.adjacencyMap = new Map();    // id -> Set of neighbor IDs
    this.edgeObjectMap = new Map();   // "id1-id2" -> link

    // Tracing State
    this.isTracing = false;
    this.traceTargetNode = null;
    this.traceDepth = 1;
    this.tracedDistanceMap = new Map();

    // Raycaster & Selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredNode = null;
    this.selectedNode = null;
    this.selectionRing = null;
    this.targetCameraPos = null;
    this.targetLookAt = null;

    // Filter Options
    this.filters = {
      classification: 'all', // 'all', 'illicit', 'licit', 'unknown'
      highRiskOnly: false,
    };
    this.particlesEnabled = true;
    this.autoRotate = false;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || (window.innerHeight - 110);

    // 1. Scene with Deep Navy-Slate Atmosphere & Atmospheric Fog for Depth
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090e18);
    this.scene.fog = new THREE.FogExp2(0x090e18, 0.00030);

    // 2. Perspective Camera with Generous Depth Field
    this.camera = new THREE.PerspectiveCamera(48, width / height, 1, 8000);
    // Initial 3D isometric perspective angle (elevation and azimuth)
    this.camera.position.set(280, 210, 340);

    // 3. WebGL Renderer with ACESFilmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.30;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 3D Perspective Screen-Projected Labels
    this.labelsOverlay = document.createElement('div');
    this.labelsOverlay.className = 'graph-3d-labels-overlay';
    this.container.appendChild(this.labelsOverlay);

    this.targetLabel = document.createElement('div');
    this.targetLabel.className = 'graph-node-3d-label target-label hidden';
    this.labelsOverlay.appendChild(this.targetLabel);

    this.anchorLabel = document.createElement('div');
    this.anchorLabel.className = 'graph-node-3d-label anchor-label hidden';
    this.labelsOverlay.appendChild(this.anchorLabel);
    this.primaryIllicitAnchor = null;

    // 4. OrbitControls with Silky Smooth Damping
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 2600;
    this.controls.minDistance = 25;
    this.controls.target.set(0, 0, 0);

    // Cancel programmatic glide as soon as user touches controls
    this.controls.addEventListener('start', () => {
      this.targetCameraPos = null;
      this.targetLookAt = null;
    });

    // 5. Shared Geometries and Materials
    this.setupSharedAssets();

    // 6. Multi-Directional Studio Lighting for 3D Volume
    this.setupLighting();

    // 7. 3D Spatial Grid Reference Floor (Anchor of depth perspective)
    this.setupSpatialGrid();

    // 8. Cyan Selection Indicator Ring
    this.setupSelectionRing();

    // 10. Event Listeners
    this.setupEvents();

    // 11. Animation Loop
    this.animate = this.animate.bind(this);
    this.animate();

    console.log('[ThreeForensicGraph] 3D Bitcoin Transaction Network Engine Initialized.');
  }

  setupLighting() {
    // Soft omnidirectional ambient fill
    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    this.scene.add(ambient);

    // Hemisphere light: light sky blue down, dark slate up
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 1.4);
    hemiLight.position.set(0, 350, 0);
    this.scene.add(hemiLight);

    // Warm Key Light creating clear specular highlights on 3D gems
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.6);
    keyLight.position.set(300, 380, 240);
    this.scene.add(keyLight);

    // Cool Fill Light from opposite side for dimensional contrast
    const fillLight = new THREE.DirectionalLight(0x1e3a8a, 0.9);
    fillLight.position.set(-260, -120, -200);
    this.scene.add(fillLight);

    // Cyan Rim Light from behind for depth separation against dark fog
    const rimLight = new THREE.PointLight(0x38bdf8, 1.2, 1400);
    rimLight.position.set(0, 200, -300);
    this.scene.add(rimLight);
  }

  setupSpatialGrid() {
    // 3D Spatial floor grid providing clear horizon and depth perspective
    const gridHelper = new THREE.GridHelper(1600, 32, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -240;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.20;
    this.scene.add(gridHelper);
  }

  setupSharedAssets() {
    // Low-poly faceted geometries for high-performance 60 FPS rendering of all 1,200 nodes
    this.sharedGemGeometry = new THREE.IcosahedronGeometry(1, 1);   // Faceted crystalline gem for threat anchors/illicit
    this.sharedNodeGeometry = new THREE.SphereGeometry(1, 12, 8);   // Faceted sphere for standard transactions

    // Authentic status materials with restrained emissive glow
    // RED = illicit, GREEN = licit, GRAY = unknown, ORANGE = high-risk, AMBER = review
    this.sharedMaterials = {
      illicit: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.illicit.hex,     // Red (#ef4444)
        emissive: 0x991b1b,
        emissiveIntensity: 0.70,
        roughness: 0.20,
        metalness: 0.45,
      }),
      high: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.high.hex,        // Orange (#f97316)
        emissive: 0x9a3412,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.35,
      }),
      review: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.review.hex,      // Amber (#f59e0b)
        emissive: 0x92400e,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.30,
      }),
      licit: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.licit.hex,       // Green (#10b981)
        emissive: 0x065f46,
        emissiveIntensity: 0.50,
        roughness: 0.22,
        metalness: 0.40,
      }),
      unknown: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.unknown.hex,     // Slate Gray (#64748b)
        emissive: 0x1e293b,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.25,
      }),
    };

    // Context Materials used for background nodes when an entity is focused (keeps all nodes visible!)
    this.dimmedMaterials = {
      illicit: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.illicit.hex,
        emissive: 0x450a0a,
        emissiveIntensity: 0.25,
        roughness: 0.40,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
      high: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.high.hex,
        emissive: 0x431407,
        emissiveIntensity: 0.25,
        roughness: 0.40,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
      review: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.review.hex,
        emissive: 0x451a03,
        emissiveIntensity: 0.20,
        roughness: 0.45,
        transparent: true,
        opacity: 0.70,
        depthWrite: false,
      }),
      licit: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.licit.hex,
        emissive: 0x064e3b,
        emissiveIntensity: 0.20,
        roughness: 0.45,
        transparent: true,
        opacity: 0.70,
        depthWrite: false,
      }),
      unknown: new THREE.MeshStandardMaterial({
        color: STATUS_COLORS.unknown.hex,
        emissive: 0x0f172a,
        emissiveIntensity: 0.15,
        roughness: 0.50,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    };

    // Dedicated Transmission Packet Assets: Pure unmistakable white bead + luminous halo
    this.packetGeometry = new THREE.SphereGeometry(1.4, 12, 8);
    this.packetMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      depthWrite: false,
    });

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.40, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(0.75, 'rgba(224, 242, 254, 0.35)');
    gradient.addColorStop(1.0, 'rgba(224, 242, 254, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(canvas);
    this.packetGlowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
  }

  setupSelectionRing() {
    const group = new THREE.Group();

    // Crisp Cyan/Electric Blue selection indicator ring (wraps selected node; NEVER overwrites node's color)
    const ringGeo = new THREE.RingGeometry(3.6, 4.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: STATUS_COLORS.selected.hex, // Electric Cyan (#38bdf8)
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    this.selectionRing = group;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
  }

  setupEvents() {
    const el = this.renderer.domElement;
    let isDragging = false;
    let downX = 0, downY = 0;

    el.addEventListener('pointerdown', (e) => {
      isDragging = false;
      downX = e.clientX;
      downY = e.clientY;
      this.targetCameraPos = null;
      this.targetLookAt = null;
    });

    el.addEventListener('wheel', () => {
      this.targetCameraPos = null;
      this.targetLookAt = null;
    }, { passive: true });

    el.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) {
        isDragging = true;
      }
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const now = performance.now();
      if (now - this.lastHoverCheck > 35) {
        this.lastHoverCheck = now;
        this.checkHover(e.clientX, e.clientY);
      }
    });

    el.addEventListener('click', () => {
      if (isDragging) return;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes = Array.from(this.nodeMeshMap.values()).filter(m => m.visible);
      const intersects = this.raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const node = this.nodeDataMap.get(mesh.name);
        if (node) {
          this.selectNode(node, true, true);
        }
      } else {
        if (this.selectedNode) {
          this.clearSelection();
          if (this.onNodeSelected) {
            this.onNodeSelected(null);
          }
        }
      }
    });

    el.addEventListener('dblclick', () => {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes = Array.from(this.nodeMeshMap.values()).filter(m => m.visible);
      const intersects = this.raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const node = this.nodeDataMap.get(mesh.name);
        if (node) {
          this.focusNode(node);
        }
      }
    });

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || (window.innerHeight - 110);
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  setData(graphData) {
    if (!graphData || !graphData.nodes) return;
    this.rawNodes = graphData.nodes;
    this.rawLinks = graphData.links || [];
    this.activeSlice = graphData.timestep || 1;
    this.buildGraph();
  }

  buildGraph() {
    this.clearMeshes();

    // 1. Build Adjacency Map for 1-hop lookups & Directional Edge indexing
    this.adjacencyMap.clear();
    this.edgeObjectMap.clear();
    this.rawNodes.forEach(n => this.adjacencyMap.set(String(n.id), new Set()));

    this.rawLinks.forEach(l => {
      const s = String(typeof l.source === 'object' ? l.source.id : l.source);
      const t = String(typeof l.target === 'object' ? l.target.id : l.target);
      if (this.adjacencyMap.has(s)) this.adjacencyMap.get(s).add(t);
      if (this.adjacencyMap.has(t)) this.adjacencyMap.get(t).add(s);
      this.edgeObjectMap.set(`${s}-${t}`, l);
      this.edgeObjectMap.set(`${t}-${s}`, l);
    });

    // 2. Intelligent 3D Volumetric Layout (Cached per timestep for instant switching)
    const sliceKey = String(this.activeSlice || 1);
    let coordsMap = this.sliceCoordCache.get(sliceKey);

    if (!coordsMap) {
      coordsMap = this.compute3DLayoutCoordinates();
      this.sliceCoordCache.set(sliceKey, coordsMap);
    }

    // 3. Create Node Meshes & Record Permanent 3D Coordinates
    this.nodePositionMap.clear();
    this.rawNodes.forEach(node => {
      const pos = coordsMap.get(String(node.id)) || { x: 0, y: 0, z: 0 };
      this.nodePositionMap.set(String(node.id), pos);

      const mesh = this.createNodeMesh(node);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.name = String(node.id);

      this.scene.add(mesh);
      this.nodeMeshMap.set(String(node.id), mesh);
      this.nodeDataMap.set(String(node.id), node);
    });

    // 4. Primary Illicit Anchor for window labeling
    this.primaryIllicitAnchor = this.rawNodes.find(n => n.label === '1' || n.groundTruth === 'illicit') || null;
    if (this.primaryIllicitAnchor && this.anchorLabel) {
      this.anchorLabel.innerHTML = `ILLICIT ANCHOR #${this.primaryIllicitAnchor.id}`;
      this.anchorLabel.classList.remove('hidden');
    } else if (this.anchorLabel) {
      this.anchorLabel.classList.add('hidden');
    }

    // 5. Create 2-Layer Directional Edge Lines (All real connections rendered!)
    this.createEdgeLines(this.rawNodes, this.rawLinks);

    // 6. Create Directional Fund Flow Particles (Continuously moving in background & focused on trace)
    this.createFlowParticles(this.rawNodes, this.rawLinks);

    // 7. Apply Filter Visibility in-place (defaults to 'all' — all 1,200 nodes visible!)
    this.applyFilterVisibility();

    // 8. Focus First-Load Cluster:
    // Start with a close, cinematic-but-professional 3D view of a meaningful connected transaction cluster
    // (preferring anchor #16742787 and its real 1-hop connected transactions), rather than showing all 1,200 nodes from far away!
    this.focusFirstLoadCluster(false);

    // 9. Immediate Render Pass
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  focusFirstLoadCluster(animate = false) {
    if (!this.rawNodes || this.rawNodes.length === 0) return;

    // 1. Choose meaningful anchor based on loaded graph topology:
    // Priority 1: Suspicious transaction anchor #16742787 (if present in current slice)
    // Priority 2: Primary illicit flagged node
    // Priority 3: Highest connected node (highest total degree)
    // Priority 4: First node in graph
    let anchor = null;

    if (this.selectedNode && this.nodeDataMap.has(String(this.selectedNode.id))) {
      anchor = this.nodeDataMap.get(String(this.selectedNode.id));
    }

    if (!anchor && this.nodeDataMap.has('16742787')) {
      anchor = this.nodeDataMap.get('16742787');
    }

    if (!anchor && this.primaryIllicitAnchor) {
      anchor = this.primaryIllicitAnchor;
    }

    if (!anchor) {
      anchor = this.rawNodes.find(n => n.label === '1' || n.groundTruth === 'illicit');
    }

    if (!anchor) {
      let maxDeg = -1;
      this.rawNodes.forEach(n => {
        const deg = (n.degree || 0) + (n.in_degree || 0) + (n.out_degree || 0);
        if (deg > maxDeg) {
          maxDeg = deg;
          anchor = n;
        }
      });
    }

    if (!anchor) {
      anchor = this.rawNodes[0];
    }

    if (anchor) {
      // 1. Highlight anchor node with selection ring & target label (without hiding or dimming the rest of the network!)
      this.selectNode(anchor, animate, false);
      // 2. Set medium 3D camera distance (~380-440 units) showing anchor + surrounding connected network
      this.setMediumCameraFocus(anchor, animate);
    } else {
      this.fitCameraToVisibleNodes(animate);
    }
  }

  setMediumCameraFocus(anchorNode, animate = false) {
    if (!anchorNode) return;
    const mesh = this.nodeMeshMap.get(String(anchorNode.id));
    const anchorPos = mesh ? mesh.position : (this.nodePositionMap.get(String(anchorNode.id)) || { x: 0, y: 0, z: 0 });

    // Target center biased toward anchor while preserving global cluster balance
    const targetLook = new THREE.Vector3(anchorPos.x * 0.35, anchorPos.y * 0.35, anchorPos.z * 0.35);

    // Medium 3D distance (~380 units): anchor is clearly visible, AND hundreds of surrounding nodes/edges are visible in 3D depth
    const targetPos = new THREE.Vector3(
      targetLook.x + 220,
      targetLook.y + 170,
      targetLook.z + 280
    );

    if (animate) {
      this.targetLookAt = targetLook;
      this.targetCameraPos = targetPos;
    } else {
      this.targetLookAt = null;
      this.targetCameraPos = null;
      this.camera.position.copy(targetPos);
      this.controls.target.copy(targetLook);
      this.controls.update();
    }
  }

  focusCameraOnNode(node, animate = true) {
    if (!node) return;
    const mesh = this.nodeMeshMap.get(String(node.id));
    const nodePos = mesh ? mesh.position : (this.nodePositionMap.get(String(node.id)) || { x: 0, y: 0, z: 0 });

    // 1. Target center precisely on the clicked transaction node
    const targetLook = new THREE.Vector3(nodePos.x, nodePos.y, nodePos.z);

    // 2. Camera direction vector: maintain current viewing ray to eliminate any spinning or disorienting rotation
    const currentOffset = this.camera.position.clone().sub(this.controls.target);
    const dist = currentOffset.length();
    const dir = dist > 1 ? currentOffset.normalize() : new THREE.Vector3(0.55, 0.40, 0.70).normalize();

    // 3. Focused distance (~160 units): clicked node & its 1-hop connected transactions are prominent,
    // while surrounding network context remains clearly visible in depth behind it
    const focusDistance = 160;
    const targetPos = targetLook.clone().add(dir.multiplyScalar(focusDistance));

    if (animate) {
      this.targetLookAt = targetLook;
      this.targetCameraPos = targetPos;
    } else {
      this.targetLookAt = null;
      this.targetCameraPos = null;
      this.camera.position.copy(targetPos);
      this.controls.target.copy(targetLook);
      this.controls.update();
    }
  }

  compute3DLayoutCoordinates() {
    // Partition nodes into structural categories for organic 3D volumetric clustering
    const coords = new Map();
    const count = this.rawNodes.length;
    const spread = count < 100 ? 220 : 360;

    // Component / Cluster discovery
    const illicitNodes = this.rawNodes.filter(n => n.label === '1');
    const illicitIds = new Set(illicitNodes.map(n => String(n.id)));

    const simNodes = this.rawNodes.map(n => {
      const nid = String(n.id);
      const isIll = illicitIds.has(nid);

      let x, y, z;
      if (isIll) {
        // Priority Threat Cluster: elevated 3D forensic quadrant for clear visibility
        x = 60 + (Math.random() - 0.5) * 120;
        y = 50 + (Math.random() - 0.5) * 90;
        z = 70 + (Math.random() - 0.5) * 120;
      } else {
        // Organic 3D spherical volume with full depth in X, Y, and Z
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = (0.25 + 0.75 * Math.cbrt(Math.random())) * spread;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi) * 0.90;
        z = r * Math.sin(phi) * Math.sin(theta);
      }

      return {
        id: nid,
        label: n.label,
        x, y, z
      };
    });

    const simLinks = this.rawLinks.map(l => ({
      source: String(typeof l.source === 'object' ? l.source.id : l.source),
      target: String(typeof l.target === 'object' ? l.target.id : l.target),
    }));

    // 3D Force Simulation relaxation (40 ticks: fast ~300ms, zero lag, organic volumetric depth)
    const simulation = d3Force3D.forceSimulation(simNodes, 3)
      .force('link', d3Force3D.forceLink(simLinks).id(d => d.id).distance(38).strength(0.75))
      .force('charge', d3Force3D.forceManyBody().strength(-45).distanceMax(280).distanceMin(15))
      .force('center', d3Force3D.forceCenter(0, 0, 0))
      .alphaDecay(0.04)
      .stop();

    for (let i = 0; i < 40; i++) {
      simulation.tick();
    }

    simNodes.forEach(sn => {
      coords.set(sn.id, { x: sn.x || 0, y: sn.y || 0, z: sn.z || 0 });
    });

    return coords;
  }

  createNodeMesh(node) {
    const status = getTransactionStatus(node);

    // Node sizes: small, elegant, restrained glow (not giant spheres)
    let baseRadius = 2.2;
    if (status.key === 'illicit') baseRadius = 3.6;
    else if (status.key === 'high') baseRadius = 3.0;
    else if (status.key === 'review') baseRadius = 2.5;
    else if (status.key === 'licit') baseRadius = 2.4;
    else baseRadius = 1.9;

    // Differentiate scale by transaction degree so hubs stand out subtly
    const deg = (node.in_degree || 0) + (node.out_degree || 0) || (node.degree || 0);
    const degScale = 1 + Math.min(0.50, Math.log1p(deg) * 0.18);
    const finalRadius = baseRadius * degScale;

    // Use multifaceted gem geometry (Icosahedron) for threat anchors / illicit, faceted sphere for standard
    const isGem = status.key === 'illicit' || status.key === 'high';
    const geo = isGem ? this.sharedGemGeometry : this.sharedNodeGeometry;
    const material = this.sharedMaterials[status.key] || this.sharedMaterials.unknown;

    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.setScalar(finalRadius);
    mesh.name = String(node.id);
    mesh.userData = { statusKey: status.key, baseRadius: finalRadius };

    // Subtle glowing halo ring for illicit nodes (cyber-forensic priority marker)
    if (status.key === 'illicit') {
      const haloGeo = new THREE.RingGeometry(1.3, 1.7, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: STATUS_COLORS.illicit.hex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.60,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.name = `${node.id}_halo`;
      mesh.add(halo);
      mesh.userData.halo = halo;
    }

    return mesh;
  }

  createEdgeLines(nodes, links) {
    const nodePosMap = this.nodePositionMap;
    const basePositions = [];
    const baseColors = [];
    const focusPositions = [];
    const focusColors = [];

    // Directional Gradient Colors along lines (Input -> Output)
    const cSky = new THREE.Color(0x38bdf8);      // Electric Sky Blue (Source/Input)
    const cTeal = new THREE.Color(0x2dd4bf);     // Neon Teal (Destination/Output)
    const cThreat = new THREE.Color(0xef4444);   // Threat Crimson Red (Criminal Source)
    const cOrange = new THREE.Color(0xfb923c);   // Amber-Orange (Threat Output Destination)

    links.forEach(l => {
      const srcId = String(typeof l.source === 'object' ? l.source.id : l.source);
      const tgtId = String(typeof l.target === 'object' ? l.target.id : l.target);

      const p1 = nodePosMap.get(srcId);
      const p2 = nodePosMap.get(tgtId);

      if (p1 && p2) {
        const sNode = this.nodeDataMap.get(srcId);
        const tNode = this.nodeDataMap.get(tgtId);
        const isThreatEdge = (sNode && sNode.label === '1') || (tNode && tNode.label === '1');

        if (isThreatEdge) {
          focusPositions.push(p1.x, p1.y, p1.z);
          focusPositions.push(p2.x, p2.y, p2.z);
          focusColors.push(cThreat.r, cThreat.g, cThreat.b);
          focusColors.push(cOrange.r, cOrange.g, cOrange.b);
        } else {
          basePositions.push(p1.x, p1.y, p1.z);
          basePositions.push(p2.x, p2.y, p2.z);
          baseColors.push(cSky.r, cSky.g, cSky.b);
          baseColors.push(cTeal.r * 0.9, cTeal.g * 0.9, cTeal.b * 0.9);
        }
      }
    });

    // Layer A: Base Background Network Edges (Clean, readable, 1 draw call)
    if (basePositions.length > 0) {
      const baseGeo = new THREE.BufferGeometry();
      baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(basePositions, 3));
      baseGeo.setAttribute('color', new THREE.Float32BufferAttribute(baseColors, 3));

      const baseMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
      });

      this.baseEdgesLineMesh = new THREE.LineSegments(baseGeo, baseMat);
      this.scene.add(this.baseEdgesLineMesh);
    }

    // Layer B: Focus Threat Edges (Vivid criminal flow contrast, 1 draw call)
    if (focusPositions.length > 0) {
      const focusGeo = new THREE.BufferGeometry();
      focusGeo.setAttribute('position', new THREE.Float32BufferAttribute(focusPositions, 3));
      focusGeo.setAttribute('color', new THREE.Float32BufferAttribute(focusColors, 3));

      const focusMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });

      this.focusEdgesLineMesh = new THREE.LineSegments(focusGeo, focusMat);
      this.scene.add(this.focusEdgesLineMesh);
    }
  }

  createFlowParticles(nodes, links) {
    this.createTransmissionPackets();
  }

  createTransmissionPackets() {
    // 1. Clean up existing transmission layer
    if (this.transmissionLayer) {
      while (this.transmissionLayer.children.length > 0) {
        const child = this.transmissionLayer.children[0];
        this.transmissionLayer.remove(child);
      }
    } else {
      this.transmissionLayer = new THREE.Group();
      this.transmissionLayer.renderOrder = 999;
      this.scene.add(this.transmissionLayer);
    }
    this.transmissionPackets = [];

    if (!this.rawLinks || this.rawLinks.length === 0) {
      console.log('TRANSMISSION:\nactive edges = 0\nactive packets = 0');
      window.__CRYPTOFORENSICS_TRANSMISSION__ = { activeEdges: 0, activePackets: 0 };
      return;
    }

    const getEdgeIds = (l) => ({
      s: String(typeof l.source === 'object' ? l.source.id : l.source),
      t: String(typeof l.target === 'object' ? l.target.id : l.target)
    });

    // 2. Gather all real directed edges with valid positions in the loaded graph
    const validEdges = [];
    const edgeSeen = new Set();

    this.rawLinks.forEach(l => {
      const { s, t } = getEdgeIds(l);
      const edgeKey = `${s}->${t}`;
      if (edgeSeen.has(edgeKey)) return;

      const sMesh = this.nodeMeshMap.get(s);
      const tMesh = this.nodeMeshMap.get(t);
      const sPos = sMesh ? sMesh.position : this.nodePositionMap.get(s);
      const tPos = tMesh ? tMesh.position : this.nodePositionMap.get(t);

      if (sPos && tPos && (!sMesh || sMesh.visible) && (!tMesh || tMesh.visible)) {
        const dist = sPos.distanceTo(tPos);
        if (dist >= 10.0) {
          edgeSeen.add(edgeKey);
          const sNode = this.nodeDataMap.get(s);
          const tNode = this.nodeDataMap.get(t);
          const isThreat = (sNode && (sNode.label === '1' || sNode.groundTruth === 'illicit')) ||
                           (tNode && (tNode.label === '1' || tNode.groundTruth === 'illicit'));

          validEdges.push({
            sourceId: s,
            targetId: t,
            sourcePos: sPos,
            targetPos: tPos,
            dist,
            isThreat,
          });
        }
      }
    });

    if (validEdges.length === 0) {
      console.log('TRANSMISSION:\nactive edges = 0\nactive packets = 0');
      window.__CRYPTOFORENSICS_TRANSMISSION__ = { activeEdges: 0, activePackets: 0 };
      return;
    }

    // 3. Select a small number of REAL edges
    const selId = this.selectedNode ? String(this.selectedNode.id) : (this.primaryIllicitAnchor ? String(this.primaryIllicitAnchor.id) : null);
    const hop1Set = selId ? (this.adjacencyMap.get(selId) || new Set()) : new Set();

    const focalStreams = [];
    const clusterStreams = [];
    const threatStreams = [];
    const networkStreams = [];

    validEdges.forEach(e => {
      if (selId && (e.sourceId === selId || e.targetId === selId)) {
        focalStreams.push(e);
      } else if (selId && (hop1Set.has(e.sourceId) || hop1Set.has(e.targetId))) {
        clusterStreams.push(e);
      } else if (e.isThreat) {
        threatStreams.push(e);
      } else {
        networkStreams.push(e);
      }
    });

    const activeEdges = [];
    const activeSeen = new Set();
    const addEdge = (e) => {
      const key = `${e.sourceId}->${e.targetId}`;
      if (!activeSeen.has(key) && activeEdges.length < 16) {
        activeSeen.add(key);
        activeEdges.push(e);
      }
    };

    focalStreams.forEach(addEdge);
    clusterStreams.forEach(addEdge);
    threatStreams.forEach(addEdge);

    // Pick representative connected real edges across the visible network
    if (activeEdges.length < 14 && networkStreams.length > 0) {
      const step = Math.max(1, Math.floor(networkStreams.length / Math.max(1, 14 - activeEdges.length)));
      for (let i = 0; i < networkStreams.length && activeEdges.length < 14; i += step) {
        addEdge(networkStreams[i]);
      }
    }

    // Guarantee minimum active edges if valid edges exist
    if (activeEdges.length < 8 && validEdges.length > 0) {
      for (let i = 0; i < validEdges.length && activeEdges.length < 12; i++) {
        addEdge(validEdges[i]);
      }
    }

    // 4. For each active real edge, create small WHITE circular/sprite packets
    // SOURCE ● ── • ── • ── • ──→ TARGET ●
    const packetsPerEdge = 3;
    const SPEED = 0.35; // complete cycle in ~2.8s

    activeEdges.forEach(edge => {
      for (let k = 0; k < packetsPerEdge; k++) {
        const initialProgress = k / packetsPerEdge; // 0.00, 0.333, 0.667

        const packetGroup = new THREE.Group();
        packetGroup.renderOrder = 999;

        // Core bright white sphere
        const coreMesh = new THREE.Mesh(this.packetGeometry, this.packetMaterial);
        coreMesh.renderOrder = 999;
        packetGroup.add(coreMesh);

        // Luminous white halo sprite
        if (this.packetGlowMaterial) {
          const glowSprite = new THREE.Sprite(this.packetGlowMaterial);
          glowSprite.scale.set(4.5, 4.5, 1.0);
          glowSprite.renderOrder = 999;
          packetGroup.add(glowSprite);
        }

        // Calculate initial position: source.position.clone().lerp(target.position, progress)
        const initialPos = edge.sourcePos.clone().lerp(edge.targetPos, initialProgress);
        packetGroup.position.copy(initialPos);

        this.transmissionLayer.add(packetGroup);

        this.transmissionPackets.push({
          group: packetGroup,
          sourcePos: edge.sourcePos,
          targetPos: edge.targetPos,
          progress: initialProgress,
          speed: SPEED,
        });
      }
    });

    this.transmissionLayer.visible = this.particlesEnabled;

    // Requirement 13: Debug console log
    console.log(`TRANSMISSION:\nactive edges = ${activeEdges.length}\nactive packets = ${this.transmissionPackets.length}`);
    window.__CRYPTOFORENSICS_TRANSMISSION__ = {
      activeEdges: activeEdges.length,
      activePackets: this.transmissionPackets.length,
    };
  }

  updateFlowParticlesPool() {
    this.createTransmissionPackets();
  }

  setClassificationFilter(val) {
    if (this.filters.classification === val) return;
    this.filters.classification = val;
    this.applyFilterVisibility();
  }

  setHighRiskOnly(val) {
    if (this.filters.highRiskOnly === val) return;
    this.filters.highRiskOnly = val;
    this.applyFilterVisibility();
  }

  applyFilterVisibility() {
    const isHighRiskOnly = this.filters.highRiskOnly;
    const filterClass = this.filters.classification; // 'all', 'illicit', 'licit', 'unknown'

    const isNodeHighRisk = (node) => {
      return node.label === '1' || node.risk_level === 'CRITICAL' || node.risk_level === 'HIGH';
    };

    const visibleNodeIds = new Set();

    this.rawNodes.forEach(node => {
      const isIllicit = node.label === '1';
      const isLicit = node.label === '2';
      const isUnknown = !isIllicit && !isLicit;

      let matchClass = false;
      if (filterClass === 'all') matchClass = true;
      else if (filterClass === 'illicit' && isIllicit) matchClass = true;
      else if (filterClass === 'licit' && isLicit) matchClass = true;
      else if (filterClass === 'unknown' && isUnknown) matchClass = true;

      let matchRisk = true;
      if (isHighRiskOnly && !isNodeHighRisk(node)) {
        matchRisk = false;
      }

      if (matchClass && matchRisk) {
        visibleNodeIds.add(String(node.id));
      }
    });

    // In 'illicit' filter or high-risk filter, include direct 1-hop connected flows so context is visible
    if (filterClass === 'illicit' || isHighRiskOnly) {
      const seedIds = Array.from(visibleNodeIds);
      seedIds.forEach(id => {
        const nbrs = this.adjacencyMap.get(id);
        if (nbrs) nbrs.forEach(nid => visibleNodeIds.add(nid));
      });
    }

    // Always guarantee selected entity and its neighborhood are visible
    if (this.selectedNode) {
      const selId = String(this.selectedNode.id);
      visibleNodeIds.add(selId);
      const hop1 = this.adjacencyMap.get(selId);
      if (hop1) hop1.forEach(id => visibleNodeIds.add(id));
      if (this.isTracing && this.tracedDistanceMap.size > 0) {
        this.tracedDistanceMap.forEach((_, id) => visibleNodeIds.add(id));
      }
    }

    let renderedCount = 0;
    let visibleIllicitCount = 0;

    // Update node meshes visibility
    this.nodeMeshMap.forEach((mesh, id) => {
      const node = this.nodeDataMap.get(id);
      if (!node) return;

      const isVisible = visibleNodeIds.has(id);
      mesh.visible = isVisible;
      if (!isVisible) return;

      renderedCount++;
      if (node.label === '1') visibleIllicitCount++;

      if (mesh.userData) {
        const { statusKey, baseRadius } = mesh.userData;
        mesh.material = this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
        if (this.selectedNode && id === String(this.selectedNode.id)) {
          mesh.scale.setScalar(baseRadius * 1.40);
        } else {
          mesh.scale.setScalar(baseRadius);
        }
      }
    });

    // Update edge lines to only connect visible nodes
    this.updateEdgeGeometryForVisibleNodes(visibleNodeIds);

    // Update particles pool
    this.updateFlowParticlesPool();

    // If selected node was filtered out, clear selection
    if (this.selectedNode && !visibleNodeIds.has(String(this.selectedNode.id))) {
      this.clearSelection();
    }

    // Update UI telemetry counters
    const lblNodes = document.getElementById('lbl-rendered-nodes');
    const lblIllicit = document.getElementById('lbl-rendered-illicit');
    if (lblNodes) lblNodes.textContent = renderedCount.toLocaleString();
    if (lblIllicit) lblIllicit.textContent = visibleIllicitCount.toLocaleString();
  }

  updateEdgeGeometryForVisibleNodes(visibleNodeIds) {
    if (!this.baseEdgesLineMesh && !this.focusEdgesLineMesh) return;

    const basePositions = [];
    const baseColors = [];
    const focusPositions = [];
    const focusColors = [];

    const cSky = new THREE.Color(0x38bdf8);
    const cTeal = new THREE.Color(0x2dd4bf);
    const cThreat = new THREE.Color(0xef4444);
    const cOrange = new THREE.Color(0xfb923c);

    this.rawLinks.forEach(l => {
      const srcId = String(typeof l.source === 'object' ? l.source.id : l.source);
      const tgtId = String(typeof l.target === 'object' ? l.target.id : l.target);

      if (visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId)) {
        const p1 = this.nodePositionMap.get(srcId);
        const p2 = this.nodePositionMap.get(tgtId);

        if (p1 && p2) {
          const sNode = this.nodeDataMap.get(srcId);
          const tNode = this.nodeDataMap.get(tgtId);
          const isThreat = sNode?.label === '1' || tNode?.label === '1';

          if (isThreat) {
            focusPositions.push(p1.x, p1.y, p1.z);
            focusPositions.push(p2.x, p2.y, p2.z);
            focusColors.push(cThreat.r, cThreat.g, cThreat.b);
            focusColors.push(cOrange.r, cOrange.g, cOrange.b);
          } else {
            basePositions.push(p1.x, p1.y, p1.z);
            basePositions.push(p2.x, p2.y, p2.z);
            baseColors.push(cSky.r, cSky.g, cSky.b);
            baseColors.push(cTeal.r * 0.9, cTeal.g * 0.9, cTeal.b * 0.9);
          }
        }
      }
    });

    if (this.baseEdgesLineMesh) {
      const geo = this.baseEdgesLineMesh.geometry;
      geo.setAttribute('position', new THREE.Float32BufferAttribute(basePositions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(baseColors, 3));
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      this.baseEdgesLineMesh.visible = basePositions.length > 0;
      if (!this.selectedNode && this.baseEdgesLineMesh.material) {
        this.baseEdgesLineMesh.material.opacity = 0.30;
      }
    }

    if (this.focusEdgesLineMesh) {
      const geo = this.focusEdgesLineMesh.geometry;
      geo.setAttribute('position', new THREE.Float32BufferAttribute(focusPositions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(focusColors, 3));
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      this.focusEdgesLineMesh.visible = focusPositions.length > 0;
      if (!this.selectedNode && this.focusEdgesLineMesh.material) {
        this.focusEdgesLineMesh.material.opacity = 0.78;
      }
    }
  }

  fitCameraToVisibleNodes(animate = false) {
    const meshes = Array.from(this.nodeMeshMap.values()).filter(m => m.visible);
    if (meshes.length === 0) return;

    let sumX = 0, sumY = 0, sumZ = 0;
    meshes.forEach(m => {
      sumX += m.position.x;
      sumY += m.position.y;
      sumZ += m.position.z;
    });

    const cx = sumX / meshes.length;
    const cy = sumY / meshes.length;
    const cz = sumZ / meshes.length;
    const center = new THREE.Vector3(cx, cy, cz);

    let maxRadius = 50;
    meshes.forEach(m => {
      const d = m.position.distanceTo(center);
      if (d > maxRadius) maxRadius = d;
    });

    const fovRad = (this.camera.fov * Math.PI) / 180;
    const aspect = this.camera.aspect || 1;

    const distH = (maxRadius * 1.12) / Math.tan(fovRad / 2);
    const distW = (maxRadius * 1.12) / (Math.tan(fovRad / 2) * aspect);
    const requiredDist = Math.max(distH, distW, 200);

    // True 3D Isometric / Cinematic Perspective Angle (Elevation and Azimuth)
    const targetPos = new THREE.Vector3(
      cx + requiredDist * 0.62,
      cy + requiredDist * 0.45,
      cz + requiredDist * 0.78
    );

    if (animate) {
      this.targetLookAt = center.clone();
      this.targetCameraPos = targetPos;
    } else {
      this.targetCameraPos = null;
      this.targetLookAt = null;
      this.camera.position.copy(targetPos);
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  clearMeshes() {
    this.nodeMeshMap.forEach(mesh => this.scene.remove(mesh));
    this.nodeMeshMap.clear();
    this.nodeDataMap.clear();

    if (this.baseEdgesLineMesh) {
      this.scene.remove(this.baseEdgesLineMesh);
      if (this.baseEdgesLineMesh.geometry) this.baseEdgesLineMesh.geometry.dispose();
      if (this.baseEdgesLineMesh.material) this.baseEdgesLineMesh.material.dispose();
      this.baseEdgesLineMesh = null;
    }

    if (this.focusEdgesLineMesh) {
      this.scene.remove(this.focusEdgesLineMesh);
      if (this.focusEdgesLineMesh.geometry) this.focusEdgesLineMesh.geometry.dispose();
      if (this.focusEdgesLineMesh.material) this.focusEdgesLineMesh.material.dispose();
      this.focusEdgesLineMesh = null;
    }

    if (this.activeFocusLineMesh) {
      this.scene.remove(this.activeFocusLineMesh);
      if (this.activeFocusLineMesh.geometry) this.activeFocusLineMesh.geometry.dispose();
      if (this.activeFocusLineMesh.material) this.activeFocusLineMesh.material.dispose();
      this.activeFocusLineMesh = null;
    }

    if (this.transmissionLayer) {
      while (this.transmissionLayer.children.length > 0) {
        const child = this.transmissionLayer.children[0];
        this.transmissionLayer.remove(child);
      }
    }
    this.transmissionPackets = [];

    if (this.flowParticlePoints) {
      this.scene.remove(this.flowParticlePoints);
      if (this.flowParticleGeo) this.flowParticleGeo.dispose();
      if (this.flowParticleMat) this.flowParticleMat.dispose();
      this.flowParticlePoints = null;
      this.flowParticleGeo = null;
      this.flowParticleMat = null;
      this.flowParticles = [];
    }
  }

  checkHover(clientX, clientY) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshMap.values()).filter(m => m.visible);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    const tooltipEl = document.getElementById('graph-node-tooltip');

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const node = this.nodeDataMap.get(mesh.name);

      if (node && node !== this.hoveredNode) {
        this.hoveredNode = node;
        document.body.style.cursor = 'pointer';

        if (tooltipEl) {
          tooltipEl.classList.remove('hidden');
          tooltipEl.style.left = `${clientX + 14}px`;
          tooltipEl.style.top = `${clientY - 10}px`;

          const isThreat = node.label === '1';
          const isLicit = node.label === '2';
          const tag = isThreat ? 'Threat Flagged (Illicit)' : (isLicit ? 'Verified Entity (Licit)' : 'Unlabeled Target');
          const tagClass = isThreat ? 'threat' : (isLicit ? 'licit' : 'unknown');

          tooltipEl.innerHTML = `
            <div class="tip-status ${tagClass}">${tag}</div>
            <div class="tip-id mono">txId: #${node.id}</div>
            <div class="tip-deg">Connections: ${node.degree || 0} (In: ${node.in_degree || 0}, Out: ${node.out_degree || 0})</div>
          `;
        }
      }
    } else {
      if (this.hoveredNode) {
        this.hoveredNode = null;
        document.body.style.cursor = 'default';
        if (tooltipEl) tooltipEl.classList.add('hidden');
      }
    }
  }

  async selectNodeById(nodeId, animateCamera = false, notifyCallback = false) {
    if (!nodeId) return;
    const cleanId = String(nodeId).trim();
    let node = this.nodeDataMap.get(cleanId);

    if (!node) {
      try {
        const res = await fetch(`/api/graph/trace?target_tx=${cleanId}&depth=1&direction=both`);
        if (res.ok) {
          const traceData = await res.json();
          if (traceData && traceData.nodes && traceData.nodes.length > 0) {
            this.mergeTraceSubnetwork(traceData);
            node = this.nodeDataMap.get(cleanId);
          }
        }
      } catch (e) {
        console.warn('Could not load trace for node selection:', e);
      }
    }

    if (node) {
      this.selectNode(node, animateCamera, notifyCallback);
    }
  }

  mergeTraceSubnetwork(traceData) {
    if (!traceData || !traceData.nodes) return;
    const centerPos = (this.selectedNode && this.nodePositionMap.get(String(this.selectedNode.id))) || { x: 0, y: 0, z: 0 };
    
    traceData.nodes.forEach((n, idx) => {
      const nid = String(n.id);
      if (!this.nodeDataMap.has(nid)) {
        const angle = (idx / Math.max(1, traceData.nodes.length)) * Math.PI * 2;
        const rad = 45 + (Math.random() * 25);
        const pos = {
          x: centerPos.x + Math.cos(angle) * rad,
          y: centerPos.y + (Math.random() - 0.5) * 35,
          z: centerPos.z + Math.sin(angle) * rad,
        };
        this.nodePositionMap.set(nid, pos);

        const nodeObj = {
          id: nid,
          label: n.label,
          timestep: n.timestep || this.activeSlice,
          degree: (n.in_degree || 0) + (n.out_degree || 0) || (n.degree || 1),
          in_degree: n.in_degree || 0,
          out_degree: n.out_degree || 0,
          risk_level: n.risk_level || 'UNKNOWN',
          color: n.color,
        };
        this.nodeDataMap.set(nid, nodeObj);
        this.rawNodes.push(nodeObj);

        const mesh = this.createNodeMesh(nodeObj);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.name = nid;
        this.scene.add(mesh);
        this.nodeMeshMap.set(nid, mesh);
      }
    });

    if (traceData.links) {
      traceData.links.forEach(l => {
        const s = String(typeof l.source === 'object' ? l.source.id : l.source);
        const t = String(typeof l.target === 'object' ? l.target.id : l.target);
        if (!this.adjacencyMap.has(s)) this.adjacencyMap.set(s, new Set());
        if (!this.adjacencyMap.has(t)) this.adjacencyMap.set(t, new Set());
        this.adjacencyMap.get(s).add(t);
        this.adjacencyMap.get(t).add(s);
        this.edgeObjectMap.set(`${s}-${t}`, l);
        this.edgeObjectMap.set(`${t}-${s}`, l);

        if (!this.rawLinks.some(rl => {
          const rs = String(typeof rl.source === 'object' ? rl.source.id : rl.source);
          const rt = String(typeof rl.target === 'object' ? rl.target.id : rl.target);
          return (rs === s && rt === t);
        })) {
          this.rawLinks.push({ source: s, target: t, value: 1.0 });
        }
      });
    }

    const visibleIds = new Set(Array.from(this.nodeMeshMap.keys()));
    this.updateEdgeGeometryForVisibleNodes(visibleIds);
  }

  selectNode(node, animateCamera = false, notifyCallback = false) {
    if (!node) return;
    this.selectedNode = node;
    const selId = String(node.id);

    const mesh = this.nodeMeshMap.get(selId);
    if (!mesh) return;

    // Ensure selected node and its 1-hop neighborhood are visible
    mesh.visible = true;
    const hop1Set = this.adjacencyMap.get(selId) || new Set();
    hop1Set.forEach(nbrId => {
      const nbrMesh = this.nodeMeshMap.get(nbrId);
      if (nbrMesh) nbrMesh.visible = true;
    });

    // 1. Position subtle cyan selection ring around selected node
    // ONLY the ring is cyan; the node itself retains its authentic status color!
    if (this.selectionRing) {
      this.selectionRing.position.copy(mesh.position);
      this.selectionRing.visible = true;
      if (this.camera) {
        this.selectionRing.quaternion.copy(this.camera.quaternion);
      }
      const bRad = (mesh.userData && mesh.userData.baseRadius) ? mesh.userData.baseRadius : 2.0;
      const ringScale = (bRad * 1.30) / 2.6;
      this.selectionRing.scale.set(ringScale, ringScale, ringScale);
    }

    // 2. Update 3D Target Screen Projection Label
    if (this.targetLabel) {
      const status = getTransactionStatus(node);
      const connCount = hop1Set.size;
      const connText = connCount === 0
        ? '<span style="color:#94a3b8; font-weight:normal; margin-left:6px;">No connected transactions found</span>'
        : `<span style="color:#38bdf8; font-weight:normal; margin-left:6px;">${connCount} Connected Counterpart${connCount === 1 ? 'y' : 'ies'}</span>`;
      this.targetLabel.innerHTML = `TARGET #${node.id} · <span style="color:${status.hex}">${status.label.toUpperCase()}</span> · ${connText}`;
      this.targetLabel.classList.remove('hidden');
    }
    if (this.anchorLabel && this.primaryIllicitAnchor && String(this.primaryIllicitAnchor.id) === selId) {
      this.anchorLabel.classList.add('hidden');
    }

    // 3. Clear Visual Hierarchy:
    // - SELECTED TRANSACTION: scale 1.30x (not huge), authentic classification color, 100% opacity
    // - REAL CONNECTED TRANSACTIONS: scale 1.12x, authentic classification color, 100% opacity
    // - SURROUNDING NETWORK CONTEXT: scale 0.88x, dimmed authentic material (subtle opacity, depth visible, NOT hidden!)
    this.nodeMeshMap.forEach((m, id) => {
      const nData = this.nodeDataMap.get(id);
      if (!nData || !m.visible) return;
      const { statusKey, baseRadius } = m.userData || { statusKey: 'unknown', baseRadius: 2.0 };

      if (id === selId) {
        m.material = this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
        m.scale.setScalar(baseRadius * 1.30);
      } else if (hop1Set.has(id)) {
        m.material = this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
        m.scale.setScalar(baseRadius * 1.12);
      } else {
        m.material = this.dimmedMaterials[statusKey] || this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
        m.scale.setScalar(baseRadius * 0.88);
      }
    });

    // 4. Highlight 1-hop active fund paths with vivid directed lines
    this.createActiveFocusLines(node, 1);

    // Keep all real network edges visible with clear depth hierarchy
    if (this.baseEdgesLineMesh && this.baseEdgesLineMesh.material) {
      this.baseEdgesLineMesh.material.opacity = 0.16;
    }
    if (this.focusEdgesLineMesh && this.focusEdgesLineMesh.material) {
      this.focusEdgesLineMesh.material.opacity = 0.75;
    }

    // 5. Smooth camera focus directly on the selected transaction node
    if (animateCamera) {
      this.focusCameraOnNode(node, true);
    }

    // 6. Update directional white flow particles across the network
    this.updateFlowParticlesPool();

    if (notifyCallback && this.onNodeSelected) {
      this.onNodeSelected(node);
    }
  }

  traceNetwork(node, depth = 1) {
    if (!node) return;
    this.isTracing = true;
    this.traceTargetNode = node;
    this.traceDepth = depth;
    const selId = String(node.id);

    // 1. BFS Multi-Hop Traversal
    const visitedDistance = new Map();
    const queue = [{ id: selId, dist: 0 }];
    visitedDistance.set(selId, 0);

    while (queue.length > 0) {
      const { id, dist } = queue.shift();
      if (dist >= depth) continue;

      const neighbors = this.adjacencyMap.get(id) || new Set();
      for (const neighborId of neighbors) {
        if (!visitedDistance.has(neighborId)) {
          visitedDistance.set(neighborId, dist + 1);
          queue.push({ id: neighborId, dist: dist + 1 });
        }
      }
    }

    this.tracedDistanceMap = visitedDistance;

    // Ensure all nodes in traced subgraph are visible
    visitedDistance.forEach((_, id) => {
      const m = this.nodeMeshMap.get(id);
      if (m) m.visible = true;
    });

    // 2. Count metrics
    let directThreats = 0;
    let extendedThreats = 0;
    const totalNodesInTrace = visitedDistance.size;

    visitedDistance.forEach((dist, id) => {
      const nData = this.nodeDataMap.get(id);
      if (nData && nData.label === '1') {
        if (dist === 1) directThreats++;
        else if (dist > 1) extendedThreats++;
      }
    });

    let clusterType = 'Isolated P2P Transfer';
    if (directThreats >= 2 || extendedThreats >= 2) clusterType = 'Multi-Tier Laundering Syndicate';
    else if (directThreats === 1) clusterType = '1-Hop Tainted Intermediary';
    else if (totalNodesInTrace > 12) clusterType = 'High Fan-Out Mixer Hub';

    // 3. Multi-tier visual update for Traced Subgraph + Background Network Context
    this.nodeMeshMap.forEach((m, id) => {
      const nData = this.nodeDataMap.get(id);
      if (!nData || !m.visible) return;
      const { statusKey, baseRadius } = m.userData || { statusKey: 'unknown', baseRadius: 2.0 };

      if (visitedDistance.has(id)) {
        const dist = visitedDistance.get(id);
        if (dist === 0) {
          m.scale.setScalar(baseRadius * 1.35);
          m.material = this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
        } else {
          m.scale.setScalar(baseRadius * 1.05);
          m.material = this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
        }
      } else {
        m.scale.setScalar(baseRadius * 0.70);
        m.material = this.dimmedMaterials[statusKey] || this.dimmedMaterials.unknown;
      }
    });

    // 4. Create Active Focus Lines for Traced Subgraph
    this.createActiveFocusLines(node, depth);

    // Keep background edges visible as forensic context
    if (this.baseEdgesLineMesh && this.baseEdgesLineMesh.material) {
      this.baseEdgesLineMesh.material.opacity = 0.25;
    }
    if (this.focusEdgesLineMesh && this.focusEdgesLineMesh.material) {
      this.focusEdgesLineMesh.material.opacity = 0.65;
    }

    // 5. Build directional trace steps from actual graph DAG edges
    const traceSteps = [];
    const targetStatus = getTransactionStatus(node);
    traceSteps.push({
      step: 1,
      role: 'Investigated Target',
      txId: node.id,
      status: targetStatus,
      direction: 'Origin'
    });

    let currentStepNum = 2;
    const hop1Set = this.adjacencyMap.get(selId) || new Set();
    hop1Set.forEach(nbrId => {
      const nbrData = this.nodeDataMap.get(nbrId) || { id: nbrId };
      const isOutflow = this.rawLinks.some(l => {
        const s = String(typeof l.source === 'object' ? l.source.id : l.source);
        const t = String(typeof l.target === 'object' ? l.target.id : l.target);
        return s === selId && t === String(nbrId);
      });
      traceSteps.push({
        step: currentStepNum++,
        role: isOutflow ? 'Fund Outflow (Recipient)' : 'Fund Inflow (Source)',
        txId: nbrId,
        status: getTransactionStatus(nbrData),
        direction: isOutflow ? 'Output' : 'Input',
        hop: 1
      });
    });

    if (depth >= 2) {
      hop1Set.forEach(h1Id => {
        const h2Set = this.adjacencyMap.get(h1Id) || new Set();
        h2Set.forEach(h2Id => {
          if (h2Id !== selId && !hop1Set.has(h2Id)) {
            const h2Data = this.nodeDataMap.get(h2Id) || { id: h2Id };
            const isOutflow = this.rawLinks.some(l => {
              const s = String(typeof l.source === 'object' ? l.source.id : l.source);
              const t = String(typeof l.target === 'object' ? l.target.id : l.target);
              return s === String(h1Id) && t === String(h2Id);
            });
            traceSteps.push({
              step: currentStepNum++,
              role: isOutflow ? '2nd-Hop Outflow' : '2nd-Hop Inflow',
              txId: h2Id,
              status: getTransactionStatus(h2Data),
              direction: isOutflow ? 'Output' : 'Input',
              hop: 2,
              via: h1Id
            });
          }
        });
      });
    }

    // 6. Notify callback with structured path steps
    if (this.onTraceUpdated) {
      this.onTraceUpdated({
        targetNode: node,
        totalNodes: totalNodesInTrace,
        directThreats,
        extendedThreats,
        clusterType,
        depth,
        traceSteps
      });
    }

    // 7. Update flow particles along the traced multi-hop paths
    this.updateFlowParticlesPool();

    // 8. Smoothly frame traced subgraph (one-shot, stable)
    this.focusNodeNeighborhood(node, depth, true);
  }

  focusNodeNeighborhood(node, depth = 1, animate = true) {
    if (!node || !this.controls || !this.camera) return;
    const selId = String(node.id);
    const mesh = this.nodeMeshMap.get(selId);
    if (!mesh) return;

    const neighborhood = new Set([selId]);
    const hop1 = this.adjacencyMap.get(selId) || new Set();
    hop1.forEach(id => neighborhood.add(id));

    if (depth > 1) {
      hop1.forEach(h1Id => {
        const hop2 = this.adjacencyMap.get(h1Id);
        if (hop2) hop2.forEach(id => neighborhood.add(id));
      });
    }

    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    neighborhood.forEach(id => {
      const pos = this.nodePositionMap.get(id);
      if (pos) {
        sumX += pos.x;
        sumY += pos.y;
        sumZ += pos.z;
        count++;
      }
    });

    if (count === 0) return;
    const center = new THREE.Vector3(sumX / count, sumY / count, sumZ / count);

    let maxRadius = 30;
    neighborhood.forEach(id => {
      const pos = this.nodePositionMap.get(id);
      if (pos) {
        const d = center.distanceTo(new THREE.Vector3(pos.x, pos.y, pos.z));
        if (d > maxRadius) maxRadius = d;
      }
    });

    const fovRad = (this.camera.fov * Math.PI) / 180;
    const aspect = this.camera.aspect || 1;
    const distH = (maxRadius * 1.25) / Math.tan(fovRad / 2);
    const distW = (maxRadius * 1.25) / (Math.tan(fovRad / 2) * aspect);
    // Medium 3D distance preserving surrounding network context around the focused cluster
    const requiredDist = Math.max(340, Math.min(480, Math.max(distH, distW, 340)));

    // Professional 3D isometric perspective angle (cinematic elevation and azimuth)
    const targetPos = new THREE.Vector3(
      center.x + requiredDist * 0.48,
      center.y + requiredDist * 0.38,
      center.z + requiredDist * 0.78
    );

    if (animate) {
      this.targetLookAt = center.clone();
      this.targetCameraPos = targetPos;
    } else {
      this.targetLookAt = null;
      this.targetCameraPos = null;
      this.camera.position.copy(targetPos);
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  clearTrace() {
    this.isTracing = false;
    this.tracedDistanceMap.clear();
    if (this.selectedNode) {
      this.selectNode(this.selectedNode, false);
    } else {
      this.exitInvestigation();
    }
  }

  createActiveFocusLines(targetNode, depth = 1) {
    if (this.activeFocusLineMesh) {
      this.scene.remove(this.activeFocusLineMesh);
      this.activeFocusLineMesh.geometry.dispose();
      this.activeFocusLineMesh = null;
    }

    const positions = [];
    const colors = [];
    const selId = String(targetNode.id);

    const cTarget = new THREE.Color(STATUS_COLORS.selected.hex); // Sky blue
    const cThreat = new THREE.Color(STATUS_COLORS.illicit.hex);  // Red
    const cHigh = new THREE.Color(STATUS_COLORS.high.hex);       // Orange
    const cLicit = new THREE.Color(STATUS_COLORS.licit.hex);     // Green
    const cReview = new THREE.Color(STATUS_COLORS.review.hex);   // Amber
    const cUnknown = new THREE.Color(STATUS_COLORS.unknown.hex); // Gray

    const activeSet = this.isTracing && this.tracedDistanceMap.size > 0
      ? this.tracedDistanceMap
      : (this.adjacencyMap.get(selId) || new Set());

    const getNodeEdgeColor = (nid, nObj) => {
      if (nid === selId) return cTarget;
      const st = getTransactionStatus(nObj);
      if (st.key === 'illicit') return cThreat;
      if (st.key === 'high') return cHigh;
      if (st.key === 'licit') return cLicit;
      if (st.key === 'review') return cReview;
      return cUnknown;
    };

    this.rawLinks.forEach(l => {
      const s = String(typeof l.source === 'object' ? l.source.id : l.source);
      const t = String(typeof l.target === 'object' ? l.target.id : l.target);

      let includeEdge = false;
      if (this.isTracing) {
        includeEdge = activeSet.has(s) && activeSet.has(t);
      } else {
        includeEdge = (s === selId && activeSet.has(t)) || (t === selId && activeSet.has(s));
      }

      if (includeEdge) {
        const p1 = this.nodePositionMap.get(s);
        const p2 = this.nodePositionMap.get(t);
        if (p1 && p2) {
          positions.push(p1.x, p1.y, p1.z);
          positions.push(p2.x, p2.y, p2.z);

          const sNode = this.nodeDataMap.get(s);
          const tNode = this.nodeDataMap.get(t);

          const sColor = getNodeEdgeColor(s, sNode);
          const tColor = getNodeEdgeColor(t, tNode);

          colors.push(sColor.r, sColor.g, sColor.b);
          colors.push(tColor.r, tColor.g, tColor.b);
        }
      }
    });

    if (positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });

      this.activeFocusLineMesh = new THREE.LineSegments(geo, mat);
      this.scene.add(this.activeFocusLineMesh);
    }
  }

  exitInvestigation() {
    this.selectedNode = null;
    this.isTracing = false;
    this.traceTargetNode = null;
    this.tracedDistanceMap.clear();

    if (this.selectionRing) {
      this.selectionRing.visible = false;
    }

    if (this.targetLabel) {
      this.targetLabel.classList.add('hidden');
    }
    if (this.anchorLabel && this.primaryIllicitAnchor) {
      this.anchorLabel.classList.remove('hidden');
    }

    if (this.activeFocusLineMesh) {
      this.scene.remove(this.activeFocusLineMesh);
      this.activeFocusLineMesh.geometry.dispose();
      this.activeFocusLineMesh = null;
    }

    // Restore all nodes to standard scales and active shared status materials
    this.nodeMeshMap.forEach(m => {
      if (m.userData) {
        const { statusKey, baseRadius } = m.userData;
        m.scale.setScalar(baseRadius);
        m.material = this.sharedMaterials[statusKey] || this.sharedMaterials.unknown;
      }
    });

    // Reapply filter visibility
    this.applyFilterVisibility();

    if (this.baseEdgesLineMesh && this.baseEdgesLineMesh.material) {
      this.baseEdgesLineMesh.material.opacity = 0.30;
    }
    if (this.focusEdgesLineMesh && this.focusEdgesLineMesh.material) {
      this.focusEdgesLineMesh.material.opacity = 0.78;
    }

    // Return camera smoothly to the normal network overview
    const overviewTarget = this.nodeDataMap.get('16742787') || this.primaryIllicitAnchor || this.rawNodes[0];
    if (overviewTarget) {
      this.setMediumCameraFocus(overviewTarget, true);
    }

    // Reset flow particles to global overview flows
    this.updateFlowParticlesPool();

    if (this.onTraceUpdated) {
      this.onTraceUpdated(null);
    }
  }

  clearSelection() {
    this.exitInvestigation();
  }

  focusNode(node) {
    this.selectNode(node, true);
  }

  toggleParticles() {
    this.particlesEnabled = !this.particlesEnabled;
    if (this.transmissionLayer) {
      this.transmissionLayer.visible = this.particlesEnabled;
    }
    if (this.flowParticlePoints) {
      this.flowParticlePoints.visible = this.particlesEnabled;
    }
    return this.particlesEnabled;
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.5;
    return this.autoRotate;
  }

  resetCamera() {
    const anchor = this.selectedNode || this.nodeDataMap.get('16742787') || this.primaryIllicitAnchor || this.rawNodes[0];
    if (anchor) {
      this.setMediumCameraFocus(anchor, true);
    } else {
      this.fitCameraToVisibleNodes(true);
    }
  }

  setTopDownCamera() {
    const meshes = Array.from(this.nodeMeshMap.values()).filter(m => m.visible);
    if (meshes.length === 0) return;

    let sumX = 0, sumZ = 0;
    meshes.forEach(m => {
      sumX += m.position.x;
      sumZ += m.position.z;
    });
    const cx = sumX / meshes.length;
    const cz = sumZ / meshes.length;

    this.targetCameraPos = new THREE.Vector3(cx, 460, cz + 20);
    this.targetLookAt = new THREE.Vector3(cx, 0, cz);
  }

  focusSuspects() {
    const illicitNode = this.primaryIllicitAnchor || this.rawNodes.find(n => n.label === '1' || n.groundTruth === 'illicit');
    if (illicitNode) {
      this.selectNode(illicitNode, true, false);
    } else {
      this.resetCamera();
    }
  }

  centerOnNode(node) {
    if (!node) return;
    const mesh = this.nodeMeshMap.get(String(node.id));
    if (!mesh) return;

    this.controls.target.copy(mesh.position);
    this.camera.position.set(mesh.position.x + 40, mesh.position.y + 35, mesh.position.z + 160);
    this.controls.update();
  }

  searchNode(txId) {
    const trimmed = (txId || '').toString().trim();
    const node = this.nodeDataMap.get(trimmed) || this.rawNodes.find(n => String(n.id) === trimmed);
    if (node) {
      this.selectNode(node, false, false);
      this.centerOnNode(node);
      return true;
    }
    return false;
  }

  pause() {
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume() {
    if (!this.isPaused && this.animationFrameId) return;
    this.isPaused = false;
    if (!this.animationFrameId) {
      this.animate();
    }
  }

  animate() {
    if (this.isPaused) {
      this.animationFrameId = null;
      return;
    }
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Camera glide interpolation if programmatic target set
    if (this.targetCameraPos && this.targetLookAt) {
      this.camera.position.lerp(this.targetCameraPos, 0.10);
      this.controls.target.lerp(this.targetLookAt, 0.10);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.8) {
        this.camera.position.copy(this.targetCameraPos);
        this.controls.target.copy(this.targetLookAt);
        this.targetCameraPos = null;
        this.targetLookAt = null;
      }
    }

    // User orbit/pan/zoom controls update
    this.controls.update();

    // Ensure selection ring and illicit halos face the camera
    if (this.selectionRing && this.selectionRing.visible && this.camera) {
      this.selectionRing.quaternion.copy(this.camera.quaternion);
    }
    this.nodeMeshMap.forEach(mesh => {
      if (mesh.visible && mesh.userData && mesh.userData.halo) {
        mesh.userData.halo.quaternion.copy(this.camera.quaternion);
      }
    });

    // Advance dedicated transmission-packet animation layer continuously
    const isFlowActive = this.particlesEnabled;
    if (this.transmissionLayer) {
      this.transmissionLayer.visible = isFlowActive && this.transmissionPackets.length > 0;
    }

    if (isFlowActive && this.transmissionPackets && this.transmissionPackets.length > 0) {
      const delta = this.clock ? Math.min(0.05, this.clock.getDelta()) : 0.016;

      for (let i = 0; i < this.transmissionPackets.length; i++) {
        const p = this.transmissionPackets[i];
        p.progress += delta * p.speed;
        if (p.progress >= 1.0) {
          p.progress = 0.0;
        }

        // position = source.position.clone().lerp(target.position, progress)
        p.group.position.copy(p.sourcePos).lerp(p.targetPos, p.progress);
      }
    }

    // Screen positions of 3D labels (using preallocated projectVector, zero allocation)
    if (this.labelsOverlay) {
      const v = this.projectVector;

      if (this.selectedNode && this.targetLabel && !this.targetLabel.classList.contains('hidden')) {
        const mesh = this.nodeMeshMap.get(String(this.selectedNode.id));
        if (mesh && mesh.visible) {
          mesh.getWorldPosition(v);
          v.y += ((mesh.scale.y || 2) * 1.5) + 3;
          v.project(this.camera);
          if (v.z <= 1) {
            const x = (v.x * 0.5 + 0.5) * this.container.clientWidth;
            const y = (-(v.y * 0.5) + 0.5) * this.container.clientHeight;
            this.targetLabel.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
            this.targetLabel.style.display = 'block';
          } else {
            this.targetLabel.style.display = 'none';
          }
        } else {
          this.targetLabel.style.display = 'none';
        }
      }

      if (this.primaryIllicitAnchor && this.anchorLabel && !this.anchorLabel.classList.contains('hidden') && (!this.selectedNode || String(this.selectedNode.id) !== String(this.primaryIllicitAnchor.id))) {
        const mesh = this.nodeMeshMap.get(String(this.primaryIllicitAnchor.id));
        if (mesh && mesh.visible) {
          mesh.getWorldPosition(v);
          v.y += ((mesh.scale.y || 2) * 1.5) + 3;
          v.project(this.camera);
          if (v.z <= 1) {
            const x = (v.x * 0.5 + 0.5) * this.container.clientWidth;
            const y = (-(v.y * 0.5) + 0.5) * this.container.clientHeight;
            this.anchorLabel.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
            this.anchorLabel.style.display = 'block';
          } else {
            this.anchorLabel.style.display = 'none';
          }
        } else {
          this.anchorLabel.style.display = 'none';
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.pause();
    this.clearMeshes();
    if (this.sharedNodeGeometry) {
      this.sharedNodeGeometry.dispose();
      this.sharedNodeGeometry = null;
    }
    if (this.sharedGemGeometry) {
      this.sharedGemGeometry.dispose();
      this.sharedGemGeometry = null;
    }
    if (this.packetGeometry) {
      this.packetGeometry.dispose();
      this.packetGeometry = null;
    }
    if (this.packetMaterial) {
      this.packetMaterial.dispose();
      this.packetMaterial = null;
    }
    if (this.packetGlowMaterial) {
      if (this.packetGlowMaterial.map) this.packetGlowMaterial.map.dispose();
      this.packetGlowMaterial.dispose();
      this.packetGlowMaterial = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
