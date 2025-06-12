// ===== MQTT Configuration =====
const mqttConfig = {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    topics: {
        cmd: "orca/skripsi/cmd",
        mode: "orca/skripsi/mode",
        web: "orca/skripsi/web"
    }
}

const client = mqtt.connect(mqttConfig.brokerUrl)

// ===== Constants =====
const COMMAND_INTERVAL = 100 // ms
const ICON_LIGHT_ON = "💡"
const ICON_LIGHT_OFF = /* html */ `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor"
    class="bi bi-lightbulb-off" viewBox="0 0 16 16"><path fill-rule="evenodd"
    d="M2.23 4.35A6 6 0 0 0 2 6c0 1.691.7 3.22 1.826 4.31.203.196.359.4.453.619l.762 1.769A.5.5 0 0 0 5.5 13a.5.5 0 0 0 0 1 
    .5.5 0 0 0 0 1l.224.447a1 1 0 0 0 .894.553h2.764a1 1 0 0 0 .894-.553L10.5 15a.5.5 0 0 0 0-1 
    .5.5 0 0 0 0-1 .5.5 0 0 0 .288-.091L9.878 12H5.83l-.632-1.467a3 3 0 0 0-.676-.941 
    4.98 4.98 0 0 1-1.455-4.405zm1.588-2.653.708.707a5 5 0 0 1 7.07 7.07l.707.707a6 6 0 0 
    0-8.484-8.484zm-2.172-.051a.5.5 0 0 1 .708 0l12 12a.5.5 0 0 1-.708.708l-12-12a.5.5 0 0 1 0-.708"/>
</svg>`

// ===== State Variables =====
let isLightOn = false
let is3DSceneInitialized = false
let repeatCommandIntervalId = null
let lockedCommandIntervalId = null
let lockedButtonId = null
let scene, camera, renderer, cube

// ===== UI Elements =====
const gestureToggle = document.getElementById("gestureToggle")
const gestureToggleLabel = document.getElementById("gestureToggleLabel")
const lockToggle = document.getElementById("lockToggle")
const lockToggleLabel = document.getElementById("lockToggleLabel")
const feedbackDisplay = document.getElementById("feedbackDisplay")
const lightBtn = document.getElementById("lightBtn")
const lightIcon = document.getElementById("lightIcon")
const hornBtn = document.getElementById("hornBtn")

const manualControlsLeft = document.querySelector('.manual-controls-left')
const gestureDashboardLeft = document.querySelector('.gesture-dashboard-left')
const manualControlsRight = document.querySelector('.manual-controls-right')
const gestureDashboardRight = document.querySelector('.gesture-dashboard-right')
const object3D = document.getElementById('3Dcube')

const controlButtons = [
    { id: "forwardBtn", command: "F", name: "⬆️" },
    { id: "backwardBtn", command: "B", name: "⬇️" },
    { id: "leftBtn", command: "L", name: "⬅️" },
    { id: "rightBtn", command: "R", name: "➡️" }
]

// ======= UI Setup Functions =======
function updateGestureModeUI(isGestureMode) {
    manualControlsLeft.classList.toggle('hidden', isGestureMode)
    gestureDashboardLeft.classList.toggle('hidden', !isGestureMode)
    manualControlsRight.classList.toggle('hidden', isGestureMode)
    gestureDashboardRight.classList.toggle('hidden', !isGestureMode)

    if (isGestureMode) {
        if (!is3DSceneInitialized) {
            init3DScene()
            is3DSceneInitialized = true
        } else {
            handleResize()
        }
    }
}

function updateGestureToggleLabel() {
    gestureToggleLabel.textContent = gestureToggle.checked ? "Gesture Mode" : "Manual Mode"
}

function updateLockUI() {
    const isLocked = lockToggle.checked
    const iconEl = document.querySelector("#lockToggleLabel .lock-icon")
    const textEl = document.querySelector("#lockToggleLabel .lock-text")

    if (iconEl) iconEl.textContent = isLocked ? "🔒" : "🔓"
    if (textEl) textEl.textContent = isLocked ? "Locked" : "Unlocked"
}

function updateFeedbackDisplay(icon) {
    if (!feedbackDisplay) return
    feedbackDisplay.textContent = icon || "⬆️"
    feedbackDisplay.style.color = icon ? "#ecf0f1" : "transparent"
}

function stopAllCommands() {
    clearInterval(lockedCommandIntervalId)
    clearInterval(repeatCommandIntervalId)
    lockedCommandIntervalId = null
    repeatCommandIntervalId = null

    if (lockedButtonId) {
        document.getElementById(lockedButtonId)?.classList.remove("btn-locked")
        lockedButtonId = null
    }

    sendCommand("S")
    updateFeedbackDisplay("")
}

// ======= Control Button Setup =======
function setupControlButtons() {
    controlButtons.forEach(({ id, command, name }) => {
        const button = document.getElementById(id)
        if (!button) return

        button.addEventListener("pointerdown", (e) => {
            e.preventDefault()
            if (gestureToggle.checked) return
            handleControlPress(button, id, command, name)
        })

        const releaseHandler = (e) => {
            e.preventDefault()
            if (gestureToggle.checked) return
            handleControlRelease()
        }

        button.addEventListener("pointerup", releaseHandler)
        button.addEventListener("pointerleave", releaseHandler)
    })
}

function handleControlPress(button, buttonId, command, name) {
    const isLockMode = lockToggle.checked

    if (isLockMode) {
        if (lockedButtonId === buttonId) {
            stopAllCommands()
        } else {
            stopAllCommands()
            sendCommand(command)
            lockedCommandIntervalId = setInterval(() => sendCommand(command), COMMAND_INTERVAL)
            lockedButtonId = buttonId
            button.classList.add("btn-locked")
        }
    } else {
        clearInterval(repeatCommandIntervalId)
        sendCommand(command)
        repeatCommandIntervalId = setInterval(() => sendCommand(command), COMMAND_INTERVAL)
    }

    updateFeedbackDisplay(name)
}

function handleControlRelease() {
    if (!lockToggle.checked) stopAllCommands()
}

// ======= Gesture & Lock Toggle =======
gestureToggle.addEventListener("change", () => {
    const enabled = gestureToggle.checked
    updateGestureToggleLabel()
    publishGestureMode(enabled)
    updateGestureModeUI(enabled)
})

lockToggle.addEventListener("change", () => {
    updateLockUI()
    stopAllCommands()
})

// ======= Light & Horn Button =======
lightBtn.addEventListener("click", () => {
    isLightOn = !isLightOn
    sendCommand(isLightOn ? "W" : "w")
    lightIcon.innerHTML = isLightOn ? ICON_LIGHT_OFF : ICON_LIGHT_ON
})

hornBtn.addEventListener("click", () => sendCommand("V"))

// ======= MQTT Setup =======
function initMQTT() {
    client.on('connect', () => {
        console.log("✅ MQTT Connected")
        client.subscribe([mqttConfig.topics.mode, mqttConfig.topics.web])
    })

    client.on('error', (err) => {
        console.error("❌ MQTT Error:", err)
        client.end()
    })

    client.on('message', (topic, message) => {
        if (topic === mqttConfig.topics.mode) {
            const isGestureMode = message.toString() === "gesture"
            gestureToggle.checked = isGestureMode
            updateGestureModeUI(isGestureMode)
            updateGestureToggleLabel()
        } else if (topic === mqttConfig.topics.web) {
            try {
                const data = JSON.parse(message)
                if (is3DSceneInitialized) {
                    cube.rotation.x = (data.pitch || 0) * Math.PI / 180
                    cube.rotation.y = (data.yaw || 0) * Math.PI / 180
                    cube.rotation.z = (data.roll || 0) * Math.PI / 180
                    updateOrientationDisplay(data)
                }
            } catch (err) {
                console.error("❌ JSON Parse Error:", err)
            }
        }
    })
}

function publishGestureMode(enabled) {
    const payload = enabled ? "gesture" : "manual"
    client.publish(mqttConfig.topics.mode, payload, { retain: true })
    console.log("📡 Mode:", payload)
}

function sendCommand(char) {
    if (client.connected) {
        client.publish(mqttConfig.topics.cmd, char)
        console.log("📤 Command:", char)
    }
}

// ======= 3D Visualization (Three.js) =======
function init3DScene() {
    console.log("🌐 Initializing 3D Scene")
    if (!object3D) return

    const parent = object3D.parentElement
    const width = parent.clientWidth
    const height = parent.clientHeight

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xeeeeee)
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 5

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    object3D.appendChild(renderer.domElement)

    const geometry = new THREE.BoxGeometry(4, 1, 5)
    const material = [
        new THREE.MeshBasicMaterial({ color: 0xffff00 }),
        new THREE.MeshBasicMaterial({ color: 0xffff00 }),
        new THREE.MeshBasicMaterial({ color: 0x800080 }),
        new THREE.MeshBasicMaterial({ color: 0x800080 }),
        new THREE.MeshBasicMaterial({ color: 0x00ffff }),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    ]

    cube = new THREE.Mesh(geometry, material)
    scene.add(cube)

    function animate() {
        requestAnimationFrame(animate)
        renderer.render(scene, camera)
    }

    animate()
    handleResize()
}

function updateOrientationDisplay(data) {
    const rollEl = document.getElementById("roll")
    const pitchEl = document.getElementById("pitch")
    const yawEl = document.getElementById("yaw")

    if (rollEl) rollEl.textContent = data.roll.toFixed(1)
    if (pitchEl) pitchEl.textContent = data.pitch.toFixed(1)
    if (yawEl) yawEl.textContent = data.yaw.toFixed(1)
}

function handleResize() {
    if (!object3D || !camera || !renderer) return
    const parent = object3D.parentElement
    const width = parent.clientWidth
    const height = parent.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
}

window.addEventListener('resize', handleResize)

// ======= Initialization =======
document.addEventListener('DOMContentLoaded', () => {
    setupControlButtons()
    initMQTT()
    updateLockUI()
    updateGestureToggleLabel()
    updateFeedbackDisplay("")
})