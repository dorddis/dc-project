# Distributed Fibonacci DP Demo

This project demonstrates a distributed Fibonacci sequence calculation using Bluetooth communication between a laptop and a mobile device. The demo showcases dynamic programming principles with real-time logging of all operations.

## Architecture

- Laptop: Acts as a BLE peripheral/GATT server and web server
- Mobile Device: Acts as a BLE central/GATT client
- Communication: Web Bluetooth API for device-to-device communication
- UI: Real-time logging of all Fibonacci DP operations

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A Bluetooth-enabled laptop
- A mobile device with Web Bluetooth support (Chrome browser recommended)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Start the server:
   ```bash
   npm start
   ```

2. Access the web interface:
   - On your laptop: http://localhost:3000
   - On your mobile device: Use your laptop's local IP address (e.g., http://192.168.1.x:3000)

3. Enable Bluetooth on both devices

4. Click "Start Fibonacci" to begin the demo

## Features

- Real-time logging of all Fibonacci DP operations
- Interactive UI with device panels
- Secure Bluetooth communication
- Dynamic programming demonstration
- Role swapping between devices

## Security Notes

- The application uses secure GATT characteristics for data exchange
- Bluetooth pairing is required for initial connection
- All communications are logged for transparency

## Troubleshooting

If you encounter connection issues:
1. Ensure Bluetooth is enabled on both devices
2. Check that both devices are discoverable
3. Verify that the mobile device's browser supports Web Bluetooth API
4. Ensure both devices are on the same network for web server access 