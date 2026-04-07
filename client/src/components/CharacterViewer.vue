<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'

const props = defineProps<{
  isAiSpeaking?: boolean
}>()

const isVisible = ref(true)
const containerRef = ref<HTMLDivElement>()
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let vrm: VRM | null = null
let clock: THREE.Clock
let animationId: number

// 腕を自然に下ろすポーズを適用
// Normalized ボーンのレストポーズは VRM 仕様上 T ポーズ（腕水平）なので
// 固定値で下ろして問題ない
function applyNaturalPose(model: VRM) {
  const h = model.humanoid
  if (!h) return

  // Normalized ボーンノードを取得
  const leftUA = h.getNormalizedBoneNode('leftUpperArm')
  const rightUA = h.getNormalizedBoneNode('rightUpperArm')
  const leftLA = h.getNormalizedBoneNode('leftLowerArm')
  const rightLA = h.getNormalizedBoneNode('rightLowerArm')

  // 上腕を下ろす（Tポーズから約70度下げる）
  if (leftUA) leftUA.rotation.z = -1.2
  if (rightUA) rightUA.rotation.z = 1.2

  // 前腕を少し内側に曲げる
  if (leftLA) leftLA.rotation.z = -0.3
  if (rightLA) rightLA.rotation.z = 0.3
}

function init() {
  if (!containerRef.value) return

  let width = containerRef.value.clientWidth
  let height = containerRef.value.clientHeight

  if (!width || !height) {
    width = 400
    height = 200
  }

  clock = new THREE.Clock()

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xa8d5ba)

  // 顔〜胸あたりを横長に映す
  camera = new THREE.PerspectiveCamera(17, width / height, 0.1, 20)
  camera.position.set(0, 1.72, 1.6)
  camera.lookAt(0, 1.4, 0)

  // 照明: MToon（トゥーン）マテリアル向けにシンプルに
  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 1.0)
  key.position.set(0.5, 2, 1.5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.4)
  fill.position.set(-1, 1.5, 0.5)
  scene.add(fill)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.toneMapping = THREE.NoToneMapping
  containerRef.value.appendChild(renderer.domElement)

  const loader = new GLTFLoader()
  loader.register(parser => new VRMLoaderPlugin(parser))
  loader.load(
    '/avatar.vrm',
    gltf => {
      // VRMLoaderPlugin が userData.vrm にセットする
      const loadedVrm = gltf.userData.vrm as VRM | undefined
      if (loadedVrm) {
        vrm = loadedVrm
        // VRM 0.x のみ回転補正（1.0 では不要）
        if (vrm.meta?.metaVersion === '0') {
          VRMUtils.rotateVRM0(vrm)
        }
        applyNaturalPose(vrm)
        scene.add(vrm.scene)
      } else {
        scene.add(gltf.scene)
      }
    },
    undefined,
    err => console.error('[CharacterViewer] Load failed:', err)
  )

  animate()
}

function animate() {
  animationId = requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const t = clock.getElapsedTime()

  if (vrm) {
    // 呼吸
    vrm.scene.position.y = Math.sin(t * 1.5) * 0.003

    // 頭の微動
    const head = vrm.humanoid?.getNormalizedBoneNode('head')
    if (head) {
      head.rotation.y = Math.sin(t * 0.4) * 0.05
      head.rotation.x = Math.sin(t * 0.7) * 0.02
    }

    if (vrm.expressionManager) {
      // まばたき
      const blinkPhase = t % 4
      vrm.expressionManager.setValue(
        'blink',
        blinkPhase > 3.7 && blinkPhase < 3.9 ? 1 : 0
      )

      if (props.isAiSpeaking) {
        vrm.expressionManager.setValue(
          'aa',
          Math.abs(Math.sin(t * 8)) * 0.5
        )
        vrm.expressionManager.setValue('happy', 0.3)
      } else {
        vrm.expressionManager.setValue('aa', 0)
        vrm.expressionManager.setValue('happy', 0.15)
      }
    }

    vrm.update(delta)
  }

  renderer.render(scene, camera)
}

function onResize() {
  if (!containerRef.value || !renderer) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function cleanup() {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(animationId)
  renderer?.dispose()
}

watch(isVisible, async (visible) => {
  if (visible) {
    await nextTick()
    init()
    window.addEventListener('resize', onResize)
  } else {
    cleanup()
  }
})

onMounted(() => {
  init()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<template>
  <div class="character-wrapper">
    <div v-if="isVisible" ref="containerRef" class="character-viewer"></div>
    <button class="btn-toggle" @click="isVisible = !isVisible">
      {{ isVisible ? '▲ アシスタントを隠す' : '▼ アシスタントを表示' }}
    </button>
  </div>
</template>

<style scoped>
.character-wrapper {
  flex-shrink: 0;
}
.character-viewer {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
}
.btn-toggle {
  background: none;
  border: none;
  font-size: 0.78rem;
  color: #868e96;
  cursor: pointer;
  padding: 2px 0;
}
.btn-toggle:hover {
  color: #495057;
}
</style>
