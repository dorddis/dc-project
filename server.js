const express  = require('express');
const path     = require('path');
const http     = require('http');
const socketIo = require('socket.io');

// App & Server Setup
const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

// Serve static assets from "public"
app.use(express.static(path.join(__dirname, 'public')));

// Keep track of the two roles
const devices = {
  laptop: null,
  phone:  null
};

// Simulate message latency
const config = { MESSAGE_DELAY: 700 };
let isPhoneDisconnected = false;

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

io.on('connection', socket => {
  console.log(`[SERVER] Client connected: ${socket.id}`);

  // — Role selection —
  socket.on('select-role', async role => {
    if (role !== 'laptop' && role !== 'phone') return;

    // Kick out any existing device of that role
    if (devices[role]?.connected) {
      await delay(config.MESSAGE_DELAY);
      devices[role].emit('force-disconnect', 'Another device took your role');
      devices[role].disconnect(true);
    }

    devices[role] = socket;
    socket.role    = role;
    await delay(config.MESSAGE_DELAY);
    socket.emit('role-confirmed', role);
    console.log(`[SERVER] Registered "${role}" as ${socket.id}`);
  });

  // — Laptop asks for values → forward to phone —
  socket.on('request-values', async data => {
    console.log(`[DEBUG] Received request-values from ${socket.id} (role: ${socket.role})`);
    console.log(`[DEBUG] Phone device exists: ${!!devices.phone}`);
    console.log(`[DEBUG] Phone disconnected: ${isPhoneDisconnected}`);
    
    if (socket.role !== 'laptop' || !devices.phone || isPhoneDisconnected) {
      console.log(`[DEBUG] Skipping forward due to: ${socket.role !== 'laptop' ? 'wrong role' : !devices.phone ? 'no phone' : 'phone disconnected'}`);
      return;
    }
    const n1 = Number(data.n1), n2 = Number(data.n2);
    await delay(config.MESSAGE_DELAY);
    devices.phone.emit('value-request', { n1, n2 });
    console.log(`[SERVER] request-values → value-request:`, { n1, n2 });
  });

  // — Phone sends back actual values → forward to laptop —
  socket.on('send-values', async data => {
    if (socket.role !== 'phone' || !devices.laptop || isPhoneDisconnected) return;
    await delay(config.MESSAGE_DELAY);
    devices.laptop.emit('receive-values', data);
    console.log(`[SERVER] send-values → receive-values:`, data);
  });

  // — Phone says "I don't have them" → forward as values-not-found —
  socket.on('values-not-found', async data => {
    if (socket.role !== 'phone' || !devices.laptop || isPhoneDisconnected) return;
    await delay(config.MESSAGE_DELAY);
    devices.laptop.emit('values-not-found', data);
    console.log(`[SERVER] values-not-found → values-not-found:`, data);
  });

  // — Laptop computed a new chunk → store on phone —
  socket.on('computed-result', async data => {
    if (socket.role !== 'laptop' || !devices.phone || isPhoneDisconnected) return;
    await delay(config.MESSAGE_DELAY);
    devices.phone.emit('store-value', data);
    console.log(`[SERVER] computed-result → store-value:`, data);
  });

  // — Phone manual disconnect/reconnect —
  socket.on('phone-disconnect', async () => {
    if (socket.role !== 'phone') return;
    isPhoneDisconnected = true;
    console.log('[SERVER] Phone storage disconnected');
    if (devices.laptop) {
      await delay(config.MESSAGE_DELAY);
      devices.laptop.emit('phone-disconnected');
    }
  });

  socket.on('phone-reconnect', async savedState => {
    if (socket.role !== 'phone') return;
    isPhoneDisconnected = false;
    console.log('[SERVER] Phone storage reconnected');
    if (devices.laptop) {
      await delay(config.MESSAGE_DELAY);
      devices.laptop.emit('phone-reconnected', savedState);
    }
  });

  // — (Optional) laptop UI "Reconnect Storage" button —
  socket.on('request-reconnect', async () => {
    if (socket.role === 'laptop' && devices.phone) {
      await delay(config.MESSAGE_DELAY);
      devices.phone.emit('reconnect-requested');
    }
  });

  // — Clean up on any socket disconnect —
  socket.on('disconnect', async reason => {
    console.log(`[SERVER] ${socket.role || 'unknown'} disconnected: ${reason}`);
    if (socket.role === 'phone') {
      isPhoneDisconnected = true;
      if (devices.laptop) {
        await delay(config.MESSAGE_DELAY);
        devices.laptop.emit('phone-disconnected');
      }
    }
    if (socket.role) {
      devices[socket.role] = null;
      delete socket.role;
    }
  });
});

// Start listening
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] Listening on http://localhost:${PORT}`);
});
