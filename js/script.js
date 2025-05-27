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
lightBtn.addEventListener("click", () => {
    lightOn = !lightOn
    sendCommand(lightOn ? "W" : "w")
})

const hornBtn = document.getElementById("hornBtn")
hornBtn.addEventListener("click", () => {
    sendCommand("V")
})