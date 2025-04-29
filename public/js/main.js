// Configuration
const config = {
    MESSAGE_DELAY: 700, // 0.7 seconds delay between messages
    RESPONSE_TIMEOUT: 10000,
    STORAGE_KEY: 'fibonacciState',
    BASE_VALUES: {
        0: 0,
        1: 1
    }
};

// Shared state
const state = {
    deviceRole: null,
    socket: null,
    values: { ...config.BASE_VALUES },
    computationQueue: new Set(),
    targetN: null,
    messageCount: 0,
    isPhoneDisconnected: false,
    disconnectTimer: null,
    responseTimer: null
};

// UI Elements
const elements = {
    roleSelection: document.getElementById('role-selection'),
    laptopInterface: document.getElementById('laptop-interface'),
    phoneInterface: document.getElementById('phone-interface'),
    calculateBtn: document.getElementById('calculate-btn'),
    reconnectBtn: document.getElementById('reconnect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    fibInput: document.getElementById('fib-input'),
    laptopLogs: document.getElementById('laptop-logs'),
    phoneLogs: document.getElementById('phone-logs'),
    storageTable: document.getElementById('storage-table')?.getElementsByTagName('tbody')[0],
    messageCount: document.getElementById('message-count'),
    laptopBtn: document.getElementById('laptop-btn'),
    phoneBtn: document.getElementById('phone-btn')
};

// Utility Functions
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function resetState() {
    state.computationQueue = new Set();
    state.messageCount = 0;
    state.disconnectTimer = null;
    state.values = { ...config.BASE_VALUES };
}

function saveState() {
    if (state.deviceRole !== 'phone') return;
    
    const savedState = {
        values: state.values,
        targetN: state.targetN,
        messageCount: state.messageCount
    };
    
    localStorage.setItem(config.STORAGE_KEY, JSON.stringify(savedState));
}

function loadState() {
    const savedState = localStorage.getItem(config.STORAGE_KEY);
    if (!savedState) return false;
    
    try {
        const parsed = JSON.parse(savedState);
        state.values = parsed.values || { ...config.BASE_VALUES };
        state.targetN = parsed.targetN || null;
        state.messageCount = parsed.messageCount || 0;
        return true;
    } catch (error) {
        console.error('Failed to load saved state:', error);
        return false;
    }
}

// UI Functions
function updateUI(message, role = state.deviceRole) {
    const logElement = role === 'laptop' ? elements.laptopLogs : elements.phoneLogs;
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logElement.appendChild(logEntry);
    logElement.scrollTop = logElement.scrollHeight;
}

function updateStorageTable() {
    if (!elements.storageTable) return;
    
    elements.storageTable.innerHTML = '';
    
    Object.entries(state.values)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([n, value]) => {
            const row = elements.storageTable.insertRow();
            row.insertCell(0).textContent = n;
            row.insertCell(1).textContent = value;
        });
}

function updateMessageCount() {
    state.messageCount++;
    if (elements.messageCount) {
        elements.messageCount.textContent = state.messageCount;
    }
}

function updateDisconnectButton(isDisconnected) {
    if (elements.disconnectBtn) {
        elements.disconnectBtn.textContent = isDisconnected ? 'Reconnect Storage' : 'Disconnect Storage';
    }
}

function updateReconnectButton(enabled) {
    if (elements.reconnectBtn) {
        elements.reconnectBtn.disabled = !enabled;
    }
}

function showInterface() {
    elements.roleSelection.classList.add('hidden');
    if (state.deviceRole === 'laptop') {
        elements.laptopInterface.classList.remove('hidden');
    } else {
        elements.phoneInterface.classList.remove('hidden');
        updateStorageTable();
    }
}

function updateDisconnectCountdown(seconds) {
    const message = `No response from mobile, terminating in ${seconds}s`;
    const lastLog = elements.laptopLogs?.lastElementChild;
    
    if (lastLog && lastLog.textContent.includes('terminating in')) {
        lastLog.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    } else {
        updateUI(message, 'laptop');
    }
}

// Timer Functions
function startDisconnectTimer() {
    let countdown = 10;
    
    if (state.disconnectTimer) {
        clearInterval(state.disconnectTimer);
    }
    
    state.disconnectTimer = setInterval(() => {
        if (countdown <= 0) {
            stopDisconnectTimer();
            resetState();
            return;
        }
        
        updateDisconnectCountdown(countdown);
        countdown--;
    }, 1000);
}

function stopDisconnectTimer() {
    if (state.disconnectTimer) {
        clearInterval(state.disconnectTimer);
        state.disconnectTimer = null;
    }
}

// Computation Functions
function computeFibonacci(n) {
    if (n === null || n === undefined) return undefined;
    if (n <= 1) return n;
    let prev = 0, curr = 1;
    for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
    }
    return curr;
}

async function requestFibonacciComputation() {
    if (!state.socket || state.deviceRole !== 'laptop' || state.isPhoneDisconnected) return;
    
    const n = state.targetN;
    if (n === null || n === undefined) {
        updateUI('Invalid target number');
        return;
    }
    
    // Base cases
    if (n <= 1) {
        state.values[n] = n;
        updateUI(`F(${n}) = ${n}`);
        
        // If this was part of a larger computation, continue
        if (state.computationQueue.size > 0) {
            const next = Math.min(...state.computationQueue);
            state.targetN = next;
            state.computationQueue.delete(next);
            await requestFibonacciComputation();
        }
        return;
    }
    
    // Check if we already have this value
    if (n in state.values) {
        updateUI(`Already have F(${n}) = ${state.values[n]}`);
        return;
    }
    
    // Check if we have the required values to compute this
    const n1 = n - 1;
    const n2 = n - 2;
    
    if (n1 in state.values && n2 in state.values) {
        // We can compute this value directly
        const result = state.values[n1] + state.values[n2];
        state.values[n] = result;
        updateUI(`Computed F(${n}) = ${result}`);
        
        // If this was part of a larger computation, continue
        if (state.computationQueue.size > 0) {
            const next = Math.min(...state.computationQueue);
            state.targetN = next;
            state.computationQueue.delete(next);
            await requestFibonacciComputation();
        }
        return;
    }
    
    // Request the values we need
    await delay(config.MESSAGE_DELAY);
    state.socket.emit('request-values', { n1, n2 });
    updateUI(`Requesting values for F(${n1}) and F(${n2})`);
}

// Socket Event Handlers
function setupSocketHandlers(socket) {
    // Connection events
    socket.on('connect', () => {
        updateUI('Connected to server');
    });

    socket.on('disconnect', () => {
        updateUI('Disconnected from server');
        if (state.deviceRole === 'laptop' && state.isPhoneDisconnected) {
            stopDisconnectTimer();
            updateUI('Connection to server lost. Please reconnect.');
        }
    });

    // Role confirmation
    socket.on('role-confirmed', (role) => {
        state.deviceRole = role;
        if (role === 'phone') {
            loadState();
        }
        showInterface();
        updateUI(`Role confirmed: ${role}`);
    });

    // Laptop handlers
    socket.on('phone-disconnected', () => {
        if (state.deviceRole !== 'laptop') return;
        
        state.isPhoneDisconnected = true;
        updateReconnectButton(true);
        startDisconnectTimer();
    });

    socket.on('phone-reconnected', (savedState) => {
        if (state.deviceRole !== 'laptop') return;
        
        stopDisconnectTimer();
        state.isPhoneDisconnected = false;
        updateReconnectButton(false);
        
        if (savedState) {
            state.values = savedState.values;
            state.targetN = savedState.targetN;
            state.messageCount = savedState.messageCount;
            
            updateUI('Storage reconnected. Resuming computation...');
            if (state.targetN !== null) {
                requestFibonacciComputation();
            }
        } else {
            updateUI('Storage reconnected with no saved state');
        }
    });

    socket.on('values-not-found', async (data) => {
        if (state.deviceRole !== 'laptop') return;
        
        const { n1, n2 } = data;
        if (n1 === undefined || n2 === undefined) {
            updateUI('Received invalid values-not-found response');
            return;
        }
        
        updateUI(`Values not found for F(${n1}) and F(${n2})`);
        
        // Add these to our computation queue if they're not already computed
        if (!(n1 in state.values)) {
            state.computationQueue.add(n1);
        }
        if (!(n2 in state.values)) {
            state.computationQueue.add(n2);
        }
        
        if (state.computationQueue.size > 0) {
            // Start with the smallest number
            const next = Math.min(...state.computationQueue);
            state.targetN = next;
            state.computationQueue.delete(next);
            await requestFibonacciComputation();
        }
    });

    socket.on('receive-values', async (data) => {
        if (state.deviceRole !== 'laptop') return;
        
        await delay(config.MESSAGE_DELAY);
        const { n1, n2, values } = data;
        
        // Store the received values
        Object.assign(state.values, values);
        updateMessageCount();
        
        const receivedValues = Object.keys(values).map(n => `F(${n})=${values[n]}`);
        updateUI(`Received values: ${receivedValues.join(', ')}`);
        
        // Continue with our target computation
        await requestFibonacciComputation();
    });

    socket.on('compute-values', async (data) => {
        if (state.deviceRole !== 'laptop') return;
        
        const { n1, n2 } = data;
        if (n1 === undefined || n2 === undefined) {
            updateUI('Received invalid computation request');
            return;
        }
        
        updateUI(`Computing values for F(${n1}) and F(${n2})`);
        
        const value1 = computeFibonacci(n1);
        const value2 = computeFibonacci(n2);
        
        if (value1 !== undefined && value2 !== undefined) {
            await delay(config.MESSAGE_DELAY);
            socket.emit('computed-result', { [n1]: value1, [n2]: value2 });
            updateMessageCount();
            updateUI(`Computed F(${n1}) = ${value1} and F(${n2}) = ${value2}`);
        } else {
            updateUI('Error computing Fibonacci values');
        }
    });

    // Phone handlers
    socket.on('value-request', async (data) => {
        if (state.deviceRole !== 'phone' || state.isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        const { n1, n2 } = data;
        const values = {};
        let missingValues = false;
        
        // Check which values we have
        if (n1 in state.values) {
            values[n1] = state.values[n1];
        } else {
            missingValues = true;
        }
        
        if (n2 in state.values) {
            values[n2] = state.values[n2];
        } else {
            missingValues = true;
        }
        
        if (!missingValues) {
            socket.emit('send-values', { n1, n2, values });
            updateMessageCount();
            const sentValues = Object.entries(values).map(([n, v]) => `F(${n})=${v}`);
            updateUI(`Sent values: ${sentValues.join(', ')}`);
        } else {
            // Pass back the original numbers that were requested
            socket.emit('values-not-found', { n1, n2 });
            updateUI(`Values not found for F(${n1}) and F(${n2})`);
        }
        
        updateStorageTable();
    });

    socket.on('store-value', async (data) => {
        if (state.deviceRole !== 'phone' || state.isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        const { n, value } = data;
        
        if (n === undefined || value === undefined) {
            updateUI('Received invalid value to store');
            return;
        }
        
        state.values[n] = value;
        updateMessageCount();
        updateUI(`Stored F(${n}) = ${value}`);
        updateStorageTable();
        saveState();
    });

    socket.on('computed-result', async (data) => {
        if (state.deviceRole !== 'laptop' || !elements.phone || state.isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        const computedValues = {};
        
        // Validate and process each computed value
        for (const [n, value] of Object.entries(data)) {
            if (value !== undefined && !isNaN(value)) {
                computedValues[n] = value;
                state.values[n] = value;
            }
        }
        
        if (Object.keys(computedValues).length > 0) {
            socket.emit('store-value', computedValues);
            updateMessageCount();
            const valueStr = Object.entries(computedValues)
                .map(([n, v]) => `F(${n})=${v}`)
                .join(', ');
            updateUI(`Computed and stored: ${valueStr}`);
            
            // Continue with computation if there are more values in the queue
            if (state.computationQueue.size > 0) {
                const next = Math.min(...state.computationQueue);
                state.targetN = next;
                state.computationQueue.delete(next);
                await requestFibonacciComputation();
            }
        }
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize socket connection
    if (!window.io) {
        console.error('Socket.IO client not loaded');
        return;
    }
    
    const socket = io();
    state.socket = socket;
    setupSocketHandlers(socket);
    
    // Set up role selection buttons
    elements.laptopBtn?.addEventListener('click', () => {
        socket.emit('select-role', 'laptop');
    });
    
    elements.phoneBtn?.addEventListener('click', () => {
        socket.emit('select-role', 'phone');
    });
    
    // Set up calculate button
    elements.calculateBtn?.addEventListener('click', async () => {
        if (state.isPhoneDisconnected) {
            updateUI('Cannot start computation while storage is disconnected');
            return;
        }
        
        const n = parseInt(elements.fibInput.value);
        if (isNaN(n) || n < 0) {
            updateUI('Please enter a valid non-negative number');
            return;
        }
        
        // Initialize computation state
        state.targetN = n;
        state.computationQueue = new Set();
        state.values = { ...config.BASE_VALUES }; // Reset to just base values
        updateUI(`Starting computation for F(${n})`);
        await requestFibonacciComputation();
    });
    
    // Set up disconnect button
    elements.disconnectBtn?.addEventListener('click', async () => {
        if (!state.isPhoneDisconnected) {
            state.isPhoneDisconnected = true;
            updateDisconnectButton(true);
            updateUI('Storage disconnected');
            await delay(config.MESSAGE_DELAY);
            socket.emit('phone-disconnect');
        } else {
            state.isPhoneDisconnected = false;
            updateDisconnectButton(false);
            updateUI('Storage reconnected');
            await delay(config.MESSAGE_DELAY);
            socket.emit('phone-reconnect', {
                values: state.values,
                targetN: state.targetN,
                messageCount: state.messageCount
            });
        }
    });
    
    // Set up reconnect button
    elements.reconnectBtn?.addEventListener('click', () => {
        socket.emit('request-reconnect');
        updateUI('Requesting reconnection with phone storage...');
    });
}); 