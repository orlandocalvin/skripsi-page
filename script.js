const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt')
const mqttTopic = "orca/skripsi/esp/remote"
let lightOn = false

client.on('connect', () => {
    console.log("Connected to HiveMQ via MQTT over WebSocket")
})

client.on('error', (err) => {
    console.error("MQTT connection error:", err)
    client.end()
})

function sendCommand(state) {
    if (client.connected) {
        client.publish(mqttTopic, state)
        console.log("Sent:", state)
    }
}

const controlButtons = [
    { id: "forwardBtn", command: "F" },
    { id: "backwardBtn", command: "B" },
    { id: "leftBtn", command: "L" },
    { id: "rightBtn", command: "R" }
]

let intervalId = null
const commandInterval = 100

controlButtons.forEach(({ id, command }) => {
    const button = document.getElementById(id)
    if (!button) return

    button.addEventListener("pointerdown", (e) => {
        e.preventDefault()
        if (intervalId) clearInterval(intervalId)
        sendCommand(command)
        intervalId = setInterval(() => {
            sendCommand(command)
        }, commandInterval)
    })

    const stopSending = (e) => {
        e.preventDefault()
        if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
        }
        sendCommand("S")
    }

    button.addEventListener("pointerup", stopSending)
    button.addEventListener("pointerleave", stopSending)
})

const lightBtn = document.getElementById("lightBtn")
const lightIcon = document.getElementById("lightIcon")
const light_bulb_off = /* html*/ `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor"
                                class="bi bi-lightbulb-off" viewBox="0 0 16 16">
                                <path fill-rule="evenodd"
                                    d="M2.23 4.35A6 6 0 0 0 2 6c0 1.691.7 3.22 1.826 4.31.203.196.359.4.453.619l.762 1.769A.5.5 0 0 0 5.5 13a.5.5 0 0 0 0 1 .5.5 0 0 0 0 1l.224.447a1 1 0 0 0 .894.553h2.764a1 1 0 0 0 .894-.553L10.5 15a.5.5 0 0 0 0-1 .5.5 0 0 0 0-1 .5.5 0 0 0 .288-.091L9.878 12H5.83l-.632-1.467a3 3 0 0 0-.676-.941 4.98 4.98 0 0 1-1.455-4.405zm1.588-2.653.708.707a5 5 0 0 1 7.07 7.07l.707.707a6 6 0 0 0-8.484-8.484zm-2.172-.051a.5.5 0 0 1 .708 0l12 12a.5.5 0 0 1-.708.708l-12-12a.5.5 0 0 1 0-.708" />
                            </svg>`

lightBtn.addEventListener("click", () => {
    lightOn = !lightOn
    sendCommand(lightOn ? "W" : "w")

    if (lightOn) {
        lightIcon.innerHTML = "💡"
    } else {
        lightIcon.innerHTML = light_bulb_off
    }
})

const hornBtn = document.getElementById("hornBtn")
hornBtn.addEventListener("click", () => {
    sendCommand("V")
})

const lockToggle = document.getElementById('lockToggle')
const lockToggleLabel = document.getElementById('lockToggleLabel')

function updateLockStatusText() {
    if (lockToggle.checked) {
        lockToggleLabel.textContent = "🔒 Unlock"
    } else {
        lockToggleLabel.textContent = "🔓 Lock"
    }
}

updateLockStatusText()
lockToggle.addEventListener('change', updateLockStatusText)