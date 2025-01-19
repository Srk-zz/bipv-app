import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

class BIPVViewer {
    constructor() {
        this.debug = true;
        this.params = new URLSearchParams(window.location.search);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.init();
        this.setupLights();
        this.loadModel();
        this.createOverlay();
        this.animate();
    }

    log(message) {
        if (this.debug) {
            console.log(`[BIPV Viewer]: ${message}`);
        }
    }

    init() {
        this.log('Initializing viewer...');

        this.renderer.setClearColor(0x111111);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('viewer').appendChild(this.renderer.domElement);

        this.camera.position.set(500, 500, 500);
        this.camera.lookAt(0, 0, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.5; // Allow full rotation
        this.controls.maxPolarAngle = Math.PI; // Remove polar angle restriction

        const axesHelper = new THREE.AxesHelper(100);
        this.scene.add(axesHelper);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.log('Viewer initialized');
    }

    setupLights() {
        this.log('Setting up lights...');

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.position.set(100, 500, 100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(4096, 4096);
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 3000;
        this.scene.add(this.sunLight);

        const hemiLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.5);
        this.scene.add(hemiLight);

        this.log('Lights setup complete');
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '10px';
        overlay.style.left = '10px';
        overlay.style.color = 'white';
        overlay.style.fontSize = '14px';
        overlay.style.padding = '10px';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.borderRadius = '8px';
        overlay.id = 'bipv-overlay';
        document.body.appendChild(overlay);
    }

    updateOverlay(content) {
        const overlay = document.getElementById('bipv-overlay');
        if (overlay) {
            overlay.innerHTML = content;
        }
    }

    loadModel() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/js/libs/draco/');
        loader.setDRACOLoader(dracoLoader);

        const modelFile = this.params.get('model');

        if (!modelFile) {
            this.log('No model file specified in URL parameters');
            return;
        }

        const modelUrl = `/uploads/${modelFile}`;
        this.log(`Loading model from: ${modelUrl}`);

        loader.load(
            modelUrl,
            (gltf) => {
                this.log('Model loaded successfully');
                this.cityModel = gltf.scene;

                this.cityModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.color.set(0x808080); // Set default grey color
                            child.material.metalness = 0.2;
                            child.material.roughness = 0.7;
                        }
                    }
                });

                this.scene.add(this.cityModel);
                this.centerModel();
                this.calculateBIPVPotential();
            },
            (progress) => {
                const percentComplete = (progress.loaded / progress.total) * 100;
                this.log(`Loading progress: ${percentComplete.toFixed(2)}%`);
            },
            (error) => {
                this.log('Error loading model:');
                console.error(error);
            }
        );
    }

    centerModel() {
        const box = new THREE.Box3().setFromObject(this.cityModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        this.cityModel.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;

        this.camera.position.set(distance, distance, distance);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        this.log(`Model centered with bounds: ${box.min.toArray()} to ${box.max.toArray()}`);
    }

    calculateBIPVPotential() {
        if (!this.cityModel) return;

        const ghi = parseFloat(this.params.get('ghi')) || 5.0;
        let totalPotential = 0;

        this.cityModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const geometry = child.geometry;
                if (!geometry.attributes.position) return;

                geometry.computeVertexNormals();

                const normalMatrix = new THREE.Matrix3().getNormalMatrix(child.matrixWorld);
                const normal = new THREE.Vector3(0, 1, 0).applyMatrix3(normalMatrix).normalize();

                const sunDirection = this.sunLight.position.clone().normalize();
                const angle = Math.max(0, normal.dot(sunDirection));

                const surfaceArea = this.calculateSurfaceArea(geometry);
                const efficiency = 0.15;

                const energy = ghi * surfaceArea * angle * efficiency;
                totalPotential += energy;

                if (child.material) {
                    child.material.color.setHSL(angle * 0.3, 1, 0.5);
                }
            }
        });

        this.updateOverlay(
            `GHI Value: ${ghi} kWh/m²/day<br>Estimated Daily BIPV Potential: ${totalPotential.toFixed(2)} kWh`
        );
    }

    calculateSurfaceArea(geometry) {
        let area = 0;
        const positions = geometry.attributes.position.array;

        for (let i = 0; i < positions.length; i += 9) {
            const v1 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const v2 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            const v3 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

            area += new THREE.Triangle(v1, v2, v3).getArea();
        }

        return area;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

const viewer = new BIPVViewer();
window.viewer = viewer;
