// ===== MQTT Configuration =====
const mqttConfig = {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    topics: {
        cmd: "orca/skripsi/cmd",
        mode: "orca/skripsi/mode"
    }
}

const client = mqtt.connect(mqttConfig.brokerUrl)

// ===== State Variables =====
let isLightOn = false
let repeatCommandIntervalId = null
let lockedCommandIntervalId = null
let lockedButtonId = null
const commandInterval = 100 // in ms

// ===== UI Elements =====
const gestureToggle = document.getElementById("gestureToggle")
const gestureToggleLabel = document.getElementById("gestureToggleLabel")
const lockToggle = document.getElementById("lockToggle")
const lockToggleLabel = document.getElementById("lockToggleLabel")

const feedbackDisplay = document.getElementById("feedbackDisplay")
const lightBtn = document.getElementById("lightBtn")
const lightIcon = document.getElementById("lightIcon")
const hornBtn = document.getElementById("hornBtn")

const controlButtons = [
    { id: "forwardBtn", command: "F", name: "⬆️" },
    { id: "backwardBtn", command: "B", name: "⬇️" },
    { id: "leftBtn", command: "L", name: "⬅️" },
    { id: "rightBtn", command: "R", name: "➡️" }
]

// ===== MQTT Client Setup =====
client.on('connect', () => {
    console.log("✅ Connected to MQTT broker")
    client.subscribe(mqttConfig.topics.mode)
})

client.on('error', (err) => {
    console.error("❌ MQTT connection error:", err)
    client.end()
})

client.on('message', (topic, message) => {
    if (topic === mqttConfig.topics.mode) {
        const isGestureMode = message.toString() === "gesture"
        gestureToggle.checked = isGestureMode
        updateGestureModeUI(isGestureMode)

        updateGestureToggleLabel()
    }
})

// ===== Gesture Toggle =====
gestureToggle.addEventListener("change", () => {
    updateGestureToggleLabel()
    const enabled = gestureToggle.checked
    publishGestureMode(enabled)
    updateGestureModeUI(enabled)
})

function publishGestureMode(enabled) {
    const payload = enabled ? "gesture" : "manual"
    client.publish(mqttConfig.topics.mode, payload, { retain: true })
    console.log("🛰️ Mode set to:", payload)
}

function updateGestureModeUI(isGestureMode) {
    controlButtons.forEach(({ id }) => {
        const button = document.getElementById(id)
        if (button) button.disabled = isGestureMode
    })
}

function updateGestureToggleLabel() {
    const labelText = gestureToggle.checked ? "Gesture Mode" : "Manual Mode"
    gestureToggleLabel.textContent = labelText
}

// ===== Control Button Handling =====
function setupControlButtons() {
    controlButtons.forEach(({ id, command, name }) => {
        const button = document.getElementById(id)
        if (!button) return

        button.addEventListener("pointerdown", (e) => {
            e.preventDefault()
            if (gestureToggle.checked) return
            handleControlPress(button, id, command, name)
        })

        const handleRelease = (e) => {
            e.preventDefault()
            if (gestureToggle.checked) return
            handleControlRelease()
        }

        button.addEventListener("pointerup", handleRelease)
        button.addEventListener("pointerleave", handleRelease)
    })
}

function handleControlPress(button, buttonId, command, name) {
    updateFeedbackDisplay(name)
    const isLockMode = lockToggle.checked

    if (isLockMode) {
        if (lockedButtonId === buttonId) {
            clearInterval(lockedCommandIntervalId)
            lockedCommandIntervalId = null
            lockedButtonId = null
            sendCommand("S")
            updateFeedbackDisplay("")
            button.classList.remove("btn-locked")
        } else {
            clearInterval(lockedCommandIntervalId)
            clearInterval(repeatCommandIntervalId)
            const prevBtn = document.getElementById(lockedButtonId)
            if (prevBtn) prevBtn.classList.remove("btn-locked")
            if (lockedButtonId && lockedButtonId !== buttonId) sendCommand("S")

            sendCommand(command)
            lockedCommandIntervalId = setInterval(() => sendCommand(command), commandInterval)
            lockedButtonId = buttonId
            button.classList.add("btn-locked")

            controlButtons.forEach(btn => {
                if (btn.id !== buttonId) {
                    document.getElementById(btn.id)?.classList.remove("btn-locked")
                }
            })
        }
    } else {
        clearInterval(repeatCommandIntervalId)
        sendCommand(command)
        repeatCommandIntervalId = setInterval(() => sendCommand(command), commandInterval)
    }
}

function handleControlRelease() {
    if (!lockToggle.checked) {
        clearInterval(repeatCommandIntervalId)
        repeatCommandIntervalId = null
        sendCommand("S")
        updateFeedbackDisplay("")
    }
}

// ===== Feedback Display =====
function updateFeedbackDisplay(icon) {
    if (feedbackDisplay) {
        if (feedbackDisplay.textContent == '') {
            feedbackDisplay.textContent = '🔄️' // Placeholder Icon
        }

        if (icon) {
            feedbackDisplay.textContent = icon
            feedbackDisplay.style.color = '#ecf0f1'
        } else {
            feedbackDisplay.style.color = 'transparent';
        }
    }
}

// ===== Horn and Light =====
hornBtn.addEventListener("click", () => sendCommand("V"))

const lightOffSVG = /* html*/ `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor"
    class="bi bi-lightbulb-off" viewBox="0 0 16 16">
    <path fill-rule="evenodd"
        d="M2.23 4.35A6 6 0 0 0 2 6c0 1.691.7 3.22 1.826 4.31.203.196.359.4.453.619l.762 1.769A.5.5 0 0 0 5.5 13a.5.5 0 0 0 0 1 .5.5 0 0 0 0 1l.224.447a1 1 0 0 0 .894.553h2.764a1 1 0 0 0 .894-.553L10.5 15a.5.5 0 0 0 0-1 .5.5 0 0 0 0-1 .5.5 0 0 0 .288-.091L9.878 12H5.83l-.632-1.467a3 3 0 0 0-.676-.941 4.98 4.98 0 0 1-1.455-4.405zm1.588-2.653.708.707a5 5 0 0 1 7.07 7.07l.707.707a6 6 0 0 0-8.484-8.484zm-2.172-.051a.5.5 0 0 1 .708 0l12 12a.5.5 0 0 1-.708.708l-12-12a.5.5 0 0 1 0-.708" />
</svg>`

lightBtn.addEventListener("click", () => {
    isLightOn = !isLightOn
    sendCommand(isLightOn ? "W" : "w")
    lightIcon.innerHTML = isLightOn ? lightOffSVG : "💡"
})

// ===== Lock Toggle Handling =====
lockToggle.addEventListener("change", () => {
    updateLockUI()

    clearInterval(lockedCommandIntervalId)
    lockedCommandIntervalId = null

    clearInterval(repeatCommandIntervalId)
    repeatCommandIntervalId = null

    const lockedBtnElem = document.getElementById(lockedButtonId)
    if (lockedBtnElem) lockedBtnElem.classList.remove("btn-locked")

    lockedButtonId = null
    sendCommand("S")
    updateFeedbackDisplay("")
})

function updateLockUI() {
    lockToggleLabel.textContent = lockToggle.checked ? "Locked" : "Unlocked"
}

// ===== Command Sender =====
function sendCommand(char) {
    if (client.connected) {
        client.publish(mqttConfig.topics.cmd, char)
        console.log("📤 Sent:", char)
    }
}

// ===== Initialization =====
updateFeedbackDisplay("")
setupControlButtons()
updateLockUI()
updateGestureToggleLabel()