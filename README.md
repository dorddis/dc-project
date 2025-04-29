# Distributed Fibonacci DP Demo

This project demonstrates a distributed Fibonacci sequence calculation using WebSocket communication between a laptop and a mobile device. The demo showcases dynamic programming principles with real-time logging of all operations.

## Architecture

- Laptop: Acts as a computation node and web server
- Mobile Device: Acts as a storage node
- Communication: WebSocket (Socket.IO) for real-time device-to-device communication
- UI: Real-time logging of all Fibonacci DP operations

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A modern web browser (Chrome, Firefox, or Safari recommended)
- Both devices must be on the same network

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
   - On your mobile device: Use your laptop's local IP address (e.g., http://192.168.x.x:3000)

3. Select roles for each device:
   - One device should select "Laptop" role (computation)
   - One device should select "Phone" role (storage)

4. Enter n and click "Calculate F(n)" to begin the demo

## Hosting Options and Network Access

### Local Network Access
To access the application from other devices on your local network:

1. Find your computer's local IP address:
   - Windows: Run `ipconfig` in Command Prompt
   - macOS/Linux: Run `ifconfig` in Terminal
   - Look for the IPv4 address under your active network adapter

2. Ensure your computer's firewall allows incoming connections on port 3000

3. Access the application from other devices using:
   ```
   http://<your-computer-ip>:3000
   ```

### Cloud Hosting Options
The application can be hosted on various cloud platforms:

1. **Heroku**
   - Create a new Heroku app
   - Connect your GitHub repository
   - Deploy the application
   - Note: Both devices must be on the same network for WebSocket communication

2. **Vercel**
   - Import your repository
   - Configure build settings
   - Deploy the application
   - Note: Both devices must be on the same network for WebSocket communication

3. **AWS/GCP/Azure**
   - Deploy to a virtual machine
   - Configure security groups to allow port 3000
   - Set up a domain name if needed
   - Note: Both devices must be on the same network for WebSocket communication

### Important Notes
- WebSocket communication requires both devices to be on the same network
- For full functionality, local network deployment is recommended
- Ensure proper security measures when exposing the application to the internet

## Features

- Real-time logging of all Fibonacci DP operations
- Interactive UI with device panels
- Secure WebSocket communication
- Dynamic programming demonstration
- Role swapping between devices
- Automatic reconnection handling
- State persistence for storage device

## Security Notes

- The application uses WebSocket for real-time communication
- All communications are logged for transparency
- State is persisted locally on the storage device

## Troubleshooting

If you encounter connection issues:
1. Ensure both devices are on the same network
2. Check that the server is running and accessible
3. Verify that port 3000 is not blocked by firewalls
4. Try refreshing the browser on both devices
5. Check the browser console for any error messages 
