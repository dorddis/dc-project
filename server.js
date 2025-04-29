const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store device roles and their connections
const devices = {
    laptop: null,
    phone: null
};

// Configuration
const config = {
    MESSAGE_DELAY: 700, // 0.7 seconds delay between messages
    BASE_VALUES: {
        0: 0,
        1: 1
    }
};

// Server state
let isPhoneDisconnected = false;

// Helper function to delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
    console.log('Client connected');

    // Handle device role selection
    socket.on('select-role', async (role) => {
        if (role === 'laptop' || role === 'phone') {
            // If another device already has this role, disconnect it
            if (devices[role] && devices[role].connected) {
                await delay(config.MESSAGE_DELAY);
                devices[role].emit('force-disconnect', 'Another device took your role');
                devices[role].disconnect();
            }
            devices[role] = socket;
            socket.role = role;
            await delay(config.MESSAGE_DELAY);
            socket.emit('role-confirmed', role);
            console.log(`Device registered as ${role}`);
        }
    });

    // Handle phone disconnection
    socket.on('phone-disconnect', async () => {
        if (socket.role === 'phone') {
            isPhoneDisconnected = true;
            console.log('Phone storage disconnected');
            if (devices.laptop) {
                await delay(config.MESSAGE_DELAY);
                devices.laptop.emit('phone-disconnected');
            }
        }
    });

    // Handle phone reconnection
    socket.on('phone-reconnect', async (savedState) => {
        if (socket.role === 'phone') {
            isPhoneDisconnected = false;
            console.log('Phone storage reconnected');
            if (devices.laptop) {
                await delay(config.MESSAGE_DELAY);
                devices.laptop.emit('phone-reconnected', savedState);
            }
        }
    });

    // Handle request reconnect from laptop
    socket.on('request-reconnect', async () => {
        if (socket.role === 'laptop' && devices.phone) {
            await delay(config.MESSAGE_DELAY);
            devices.phone.emit('reconnect-requested');
        }
    });

    // Handle value requests from laptop
    socket.on('request-values', async (data) => {
        if (socket.role !== 'laptop' || !devices.phone || isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        devices.phone.emit('value-request', {
            n1: Number(data.n1),
            n2: Number(data.n2)
        });
        console.log('Laptop requesting values:', data);
    });

    // Handle value responses from phone
    socket.on('send-values', async (data) => {
        if (socket.role !== 'phone' || !devices.laptop || isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        devices.laptop.emit('receive-values', data);
        console.log('Phone sending values:', data);
    });

    // Handle values not found
    socket.on('values-not-found', async (data) => {
        if (socket.role !== 'phone' || !devices.laptop || isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        devices.laptop.emit('compute-values', data);
        console.log('Values not found:', data);
    });

    // Handle computed results from laptop
    socket.on('computed-result', async (data) => {
        if (socket.role !== 'laptop' || !devices.phone || isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        devices.phone.emit('store-value', data);
        console.log('Laptop computed values:', data);
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        if (socket.role) {
            if (socket.role === 'phone' && devices.laptop) {
                isPhoneDisconnected = true;
                await delay(config.MESSAGE_DELAY);
                devices.laptop.emit('phone-disconnected');
            }
            devices[socket.role] = null;
            console.log(`${socket.role} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 