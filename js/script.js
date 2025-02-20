const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt')
const subTopic = 'orca/rosus/3dvisual'

const object3D = document.getElementById('3Dcube')
let width3Dobject = object3D.parentElement.clientWidth
let height3Dobject = object3D.parentElement.clientHeight

// Scene & Renderer
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xeeeeee)

const camera = new THREE.PerspectiveCamera(75, width3Dobject / height3Dobject, 0.1, 1000)
camera.position.z = 5

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(width3Dobject, height3Dobject)
object3D.appendChild(renderer.domElement)

// Objek 3D
const geometry = new THREE.BoxGeometry(4, 1, 5)
const material = [
    new THREE.MeshBasicMaterial({ color: 0xffff00 }), // kanan
    new THREE.MeshBasicMaterial({ color: 0xffff00 }), // kiri
    new THREE.MeshBasicMaterial({ color: 0x800080 }), // depan
    new THREE.MeshBasicMaterial({ color: 0x800080 }), // belakang
    new THREE.MeshBasicMaterial({ color: 0x00ffff }), // atas
    new THREE.MeshBasicMaterial({ color: 0x00ffff })  // bawah
]
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Animation
function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
}
animate()

// MQTT Connection
client.on('connect', () => {
    console.log('Connected to MQTT Broker!')
    client.subscribe(subTopic, { qos: 1 }, (err) => {
        if (!err) console.log('Subscribed to topic:', subTopic)
    })
})

// Update Rotasi dari MQTT Data
client.on('message', (topic, message) => {
    if (topic === subTopic) {
        try {
            const data = JSON.parse(message)

            // Update Info WiFi
            document.querySelector('#ssid').innerText = data.wifi_ssid || 'Unknown'
            document.querySelector('#ip').innerText = data.wifi_local_ip || '0.0.0.0'

            // Update Rotasi Objek
            if (typeof data.pitch === 'number') cube.rotation.x = data.pitch
            if (typeof data.yaw === 'number') cube.rotation.y = data.yaw
            if (typeof data.roll === 'number') cube.rotation.z = data.roll

            tampilData(data)
        } catch (err) {
            console.error('Error parsing JSON:', err)
        }
    }
})

// Tampilkan data ke UI
function tampilData(data) {
    document.querySelector('#gyroX').innerText = Math.round(data.gyroscope.x)
    document.querySelector('#gyroY').innerText = Math.round(data.gyroscope.y)
    document.querySelector('#gyroZ').innerText = Math.round(data.gyroscope.z)

    document.querySelector('#accX').innerText = Math.round(data.acceleration.x)
    document.querySelector('#accY').innerText = Math.round(data.acceleration.y)
    document.querySelector('#accZ').innerText = Math.round(data.acceleration.z)

    document.querySelector('#roll').innerText = data.roll.toFixed(1)
    document.querySelector('#pitch').innerText = data.pitch.toFixed(1)
    document.querySelector('#yaw').innerText = data.yaw.toFixed(1)

    document.querySelector('#temp').innerText = Math.round(data.temperature)
}

// MQTT Error Handling
client.on('error', (err) => {
    console.error('MQTT Error:', err)
})

// Resize Handler
window.addEventListener('resize', () => {
    width3Dobject = object3D.parentElement.clientWidth
    height3Dobject = object3D.parentElement.clientHeight
    camera.aspect = width3Dobject / height3Dobject
    camera.updateProjectionMatrix()
    renderer.setSize(width3Dobject, height3Dobject)
})