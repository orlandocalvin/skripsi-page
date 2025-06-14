// ===== Configuration & Constants =====
const MQTT_CONFIG = {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    topics: {
        cmd: "orca/skripsi/cmd",
        mode: "orca/skripsi/mode",
        web: "orca/skripsi/web"
    }
}

const COMMAND_INTERVAL = 100
const DEADZONE_ANGLE = 30
const MAX_ANGLE = 90

const ICON_LIGHT_ON = "💡"
const ICON_LIGHT_OFF = /* html */ `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor"
    class="bi bi-lightbulb-off" viewBox="0 0 16 16">
    <path fill-rule="evenodd"
        d="M2.23 4.35A6 6 0 0 0 2 6c0 1.691.7 3.22 1.826 4.31.203.196.359.4.453.619l.762 1.769A.5.5 0 0 0
        5.5 13a.5.5 0 0 0 0 1 .5.5 0 0 0 0 1l.224.447a1 1 0 0 0 .894.553h2.764a1 1 0 0 0 .894-.553L10.5
        15a.5.5 0 0 0 0-1 .5.5 0 0 0 0-1 .5.5 0 0 0 .288-.091L9.878 12H5.83l-.632-1.467a3 3 0 0 0-.676-.941
        4.98 4.98 0 0 1-1.455-4.405zm1.588-2.653.708.707a5 5 0 0 1 7.07 7.07l.707.707a6 6 0 0
        0-8.484-8.484zm-2.172-.051a.5.5 0 0 1 .708 0l12 12a.5.5 0 0 1-.708.708l-12-12a.5.5 0 0 1 0-.708"/>
</svg>`

const COMMAND_ICONS = { 'F': '⬆️', 'B': '⬇️', 'L': '⬅️', 'R': '➡️' }

const CONTROL_BUTTONS_DATA = [
    { id: "forwardBtn", command: "F", icon: "⬆️" },
    { id: "backwardBtn", command: "B", icon: "⬇️" },
    { id: "leftBtn", command: "L", icon: "⬅️" },
    { id: "rightBtn", command: "R", icon: "➡️" }
]


// ===== Application State =====
let mqttClient = null
let isLightOn = false
let repeatCommandIntervalId = null
let lockedCommandIntervalId = null
let lockedButtonId = null
let rollGauge = null
let pitchGauge = null
let areGaugesInitialized = false


// ===== DOM Elements (will be assigned after DOM loads) =====
let controlsArea, gestureToggle, gestureToggleLabel, lockToggle, lockIcon, lockText,
    feedbackDisplay, lightBtn, lightIcon, hornBtn, orientationPad, orientationCard,
    padIndicator, padIcons = {}


// ===== Core Functions =====
function initMQTT() {
    mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl)

    mqttClient.on('connect', () => {
        console.log("MQTT Connected")
        // Subscribe to all topics at once
        mqttClient.subscribe(Object.values(MQTT_CONFIG.topics))
    })

    mqttClient.on('error', (err) => {
        console.error("MQTT Error:", err)
        mqttClient.end()
    })

    mqttClient.on('message', handleMqttMessage)
}

function sendCommand(char) {
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(MQTT_CONFIG.topics.cmd, char)
    }
}

function publishGestureMode(isEnabled) {
    const payload = isEnabled ? "gesture" : "manual"
    mqttClient.publish(MQTT_CONFIG.topics.mode, payload, { retain: true })
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


// ===== UI Update Functions =====
function updateGestureModeUI(isGestureMode) {
    controlsArea.classList.toggle('gesture-mode-active', isGestureMode)

    if (isGestureMode) {
        if (!areGaugesInitialized) {
            setTimeout(() => {
                initGauges()
                areGaugesInitialized = true
            }, 0) // Ensure the canvas is rendered first
        }

        setTimeout(syncDashboardHeights, 50)
    }
}

function updateGestureToggleLabel() {
    gestureToggleLabel.textContent = gestureToggle.checked ? "Gesture Mode" : "Manual Mode"
}

function updateLockUI() {
    const isLocked = lockToggle.checked
    lockIcon.textContent = isLocked ? "🔒" : "🔓"
    lockText.textContent = isLocked ? "Locked" : "Unlocked"
    lockToggle.setAttribute('aria-checked', isLocked)
}

function updateFeedbackDisplay(icon) {
    feedbackDisplay.textContent = icon || "🔄️"
    feedbackDisplay.style.color = icon ? "#ecf0f1" : "transparent"
}

function updateOrientationDisplay(data) {
    const rollEl = document.getElementById("roll-value")
    const pitchEl = document.getElementById("pitch-value")
    if (rollEl) rollEl.textContent = data.roll.toFixed(1)
    if (pitchEl) pitchEl.textContent = data.pitch.toFixed(1)
}

function update2DPad(roll, pitch) {
    const isActive = Math.abs(roll) > DEADZONE_ANGLE || Math.abs(pitch) > DEADZONE_ANGLE
    padIndicator.classList.toggle('indicator-active', isActive)
    updateIconHighlight(roll, pitch)

    const clampedRoll = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, roll))
    const clampedPitch = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, pitch))

    const xPos = 50 - (clampedRoll / MAX_ANGLE) * 50
    const yPos = 50 + (clampedPitch / MAX_ANGLE) * 50

    padIndicator.style.left = `${xPos}%`
    padIndicator.style.top = `${yPos}%`
}

function updateIconHighlight(roll, pitch) {
    Object.values(padIcons).forEach(icon => icon.classList.remove('icon-active'))

    // Activate icons based on roll and pitch
    if (pitch < -DEADZONE_ANGLE && pitch >= -MAX_ANGLE) padIcons.up.classList.add('icon-active')
    else if (pitch > DEADZONE_ANGLE && pitch <= MAX_ANGLE) padIcons.down.classList.add('icon-active')

    if (roll > DEADZONE_ANGLE && roll <= MAX_ANGLE) padIcons.left.classList.add('icon-active')
    else if (roll < -DEADZONE_ANGLE && roll >= -MAX_ANGLE) padIcons.right.classList.add('icon-active')
}


// ===== Gauge and Height Sync Functions =====
function createGauge(elementId, range) {
    const gaugeEl = document.getElementById(elementId)
    if (!gaugeEl) return null
    const gaugeOptions = {
        angle: -0.25, lineWidth: 0.2, radiusScale: 0.9,
        pointer: { length: 0.5, strokeWidth: 0.03, color: '#333333' },
        limitMax: true, limitMin: true,
        colorStart: '#3498db', colorStop: '#3498db',
        strokeColor: '#E0E0E0', generateGradient: false, highDpiSupport: true,
    }
    const gauge = new Gauge(gaugeEl).setOptions(gaugeOptions)
    gauge.maxValue = range
    gauge.setMinValue(-range)
    gauge.set(0)
    return gauge
}

function initGauges() {
    rollGauge = createGauge('roll-gauge', MAX_ANGLE)
    pitchGauge = createGauge('pitch-gauge', MAX_ANGLE)
}

function syncDashboardHeights() {
    if (gestureToggle.checked && orientationPad && orientationCard) {
        orientationCard.style.height = `${orientationPad.offsetHeight}px`
    }
}


// ===== Event Handlers =====
function handleControlPress(button, buttonId, command, icon) {
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
            updateFeedbackDisplay(icon)
        }
    } else {
        clearInterval(repeatCommandIntervalId)
        sendCommand(command)
        repeatCommandIntervalId = setInterval(() => sendCommand(command), COMMAND_INTERVAL)
        updateFeedbackDisplay(icon)
    }
}

function handleControlRelease() {
    if (!lockToggle.checked) {
        stopAllCommands()
    }
}

function handleMqttMessage(topic, message) {
    const payload = message.toString()

    if (topic === MQTT_CONFIG.topics.mode) { // Handle different topics
        const isGestureMode = payload === "gesture"
        gestureToggle.checked = isGestureMode
        updateGestureModeUI(isGestureMode)
        updateGestureToggleLabel()

    } else if (topic === MQTT_CONFIG.topics.web) { // Handle web data
        try {
            const data = JSON.parse(payload)
            updateOrientationDisplay(data)
            update2DPad(data.roll, data.pitch)
            if (rollGauge) rollGauge.set(data.roll)
            if (pitchGauge) pitchGauge.set(data.pitch)
        } catch (err) {
            console.error("JSON Parse Error:", err)
        }

    } else if (topic === MQTT_CONFIG.topics.cmd) { // Handle command feedback
        if (gestureToggle.checked) {
            const icon = COMMAND_ICONS[payload] || ""
            updateFeedbackDisplay(icon)
        }
    }
}


// ===== Application Start =====
document.addEventListener('DOMContentLoaded', () => {
    // 1. Assign DOM elements to variables
    controlsArea = document.querySelector('.controls-area')
    gestureToggle = document.getElementById("gestureToggle")
    gestureToggleLabel = document.getElementById("gestureToggleLabel")
    lockToggle = document.getElementById("lockToggle")
    lockIcon = document.querySelector("#lockToggleLabel .lock-icon")
    lockText = document.querySelector("#lockToggleLabel .lock-text")
    feedbackDisplay = document.getElementById("feedbackDisplay")
    lightBtn = document.getElementById("lightBtn")
    lightIcon = document.getElementById("lightIcon")
    hornBtn = document.getElementById("hornBtn")
    orientationPad = document.querySelector('.orientation-pad')
    orientationCard = document.querySelector('.card-orientation-dashboard')
    padIndicator = document.getElementById('pad-indicator')
    padIcons = {
        up: document.getElementById('icon-up'),
        down: document.getElementById('icon-down'),
        left: document.getElementById('icon-left'),
        right: document.getElementById('icon-right')
    }

    // 2. Set up event listeners
    gestureToggle.addEventListener("change", () => {
        const isEnabled = gestureToggle.checked
        updateGestureToggleLabel()
        publishGestureMode(isEnabled)
        updateGestureModeUI(isEnabled)
    })

    lockToggle.addEventListener("change", () => {
        updateLockUI()
        stopAllCommands()
    })

    lightBtn.addEventListener("click", () => {
        isLightOn = !isLightOn
        sendCommand(isLightOn ? "W" : "w")
        lightIcon.innerHTML = isLightOn ? ICON_LIGHT_OFF : ICON_LIGHT_ON
    })

    hornBtn.addEventListener("click", () => sendCommand("V"))

    // Set up control buttons
    CONTROL_BUTTONS_DATA.forEach(buttonData => {
        const buttonElement = document.getElementById(buttonData.id)
        if (buttonElement) {
            const pressHandler = (e) => {
                e.preventDefault()
                if (gestureToggle.checked) return
                handleControlPress(buttonElement, buttonData.id, buttonData.command, buttonData.icon)
            }

            const releaseHandler = (e) => {
                e.preventDefault()
                if (gestureToggle.checked) return
                handleControlRelease()
            }

            buttonElement.addEventListener("pointerdown", pressHandler)
            buttonElement.addEventListener("pointerup", releaseHandler)
            buttonElement.addEventListener("pointerleave", releaseHandler)
        }
    })

    // Set up window resize listener
    let resizeTimer
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(syncDashboardHeights, 100)
    })

    // 3. Initialize the application
    initMQTT()
    updateLockUI()
    updateGestureToggleLabel()
    updateFeedbackDisplay("")
})