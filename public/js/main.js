// Configuration
const config = {
    MESSAGE_DELAY: 700, // 0.7 seconds delay between messages
    RESPONSE_TIMEOUT: 10000,
    STORAGE_KEY: 'fibonacciState',
    BASE_VALUES: new Map([
        [0, 0],
        [1, 1]
    ])
};

// Shared state
const state = {
    deviceRole: null,
    socket: null,
    values: new Map(),
    computationQueue: new Set(),
    targetN: null,
    originalTarget: null,
    messageCount: 0,
    isPhoneDisconnected: false,
    disconnectTimer: null
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
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initializeBaseValues() {
    state.values = new Map(config.BASE_VALUES);
}

function resetState() {
    state.deviceRole = null;
    state.computationQueue = new Set();
    state.targetN = null;
    state.originalTarget = null;
    state.messageCount = 0;
    state.isPhoneDisconnected = false;
    if (state.disconnectTimer) {
        clearInterval(state.disconnectTimer);
        state.disconnectTimer = null;
    }
    initializeBaseValues();
}

function saveState() {
    if (state.deviceRole !== 'phone') return;
    
    const savedState = {
        values: Array.from(state.values.entries()),
        targetN: state.targetN,
        originalTarget: state.originalTarget,
        messageCount: state.messageCount
    };
    
    try {
        localStorage.setItem(config.STORAGE_KEY, JSON.stringify(savedState));
    } catch (error) {
        console.error('Failed to save state:', error);
    }
}

function loadState() {
    try {
        const savedState = localStorage.getItem(config.STORAGE_KEY);
        if (!savedState) return false;
        
        const parsed = JSON.parse(savedState);
        state.values = new Map(parsed.values || Array.from(config.BASE_VALUES));
        state.targetN = typeof parsed.targetN === 'number' ? parsed.targetN : null;
        state.originalTarget = typeof parsed.originalTarget === 'number' ? parsed.originalTarget : null;
        state.messageCount = typeof parsed.messageCount === 'number' ? parsed.messageCount : 0;
        return true;
    } catch (error) {
        console.error('Failed to load state:', error);
        initializeBaseValues();
        return false;
    }
}

// UI Functions
function updateUI(message, role = state.deviceRole) {
    const logElement = role === 'laptop' ? elements.laptopLogs : elements.phoneLogs;
    if (!logElement) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logElement.appendChild(logEntry);
    logElement.scrollTop = logElement.scrollHeight;
}

function updateStorageTable() {
    if (!elements.storageTable) return;
    
    elements.storageTable.innerHTML = '';
    Array.from(state.values.entries())
        .sort(([a], [b]) => a - b)
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
    if (!elements.roleSelection) return;
    
    elements.roleSelection.classList.add('hidden');
    if (state.deviceRole === 'laptop') {
        elements.laptopInterface?.classList.remove('hidden');
        elements.phoneInterface?.classList.add('hidden');
    } else {
        elements.laptopInterface?.classList.add('hidden');
        elements.phoneInterface?.classList.remove('hidden');
        updateStorageTable();
    }
}

function showRoleSelection() {
    elements.roleSelection?.classList.remove('hidden');
    elements.laptopInterface?.classList.add('hidden');
    elements.phoneInterface?.classList.add('hidden');
}

// Timer Functions
function startDisconnectTimer() {
    let countdown = 10;
    
    if (state.disconnectTimer) {
        clearInterval(state.disconnectTimer);
    }
    
    updateUI(`No response from mobile, terminating in ${countdown}s`);
    
    state.disconnectTimer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            stopDisconnectTimer();
            resetState();
            return;
        }
        updateUI(`No response from mobile, terminating in ${countdown}s`);
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
    if (typeof n !== 'number' || n < 0) return undefined;
    if (n <= 1) return n;
    
    let prev = 0, curr = 1;
    for (let i = 2; i <= n; i++) {
        [prev, curr] = [curr, prev + curr];
    }
    return curr;
}

async function requestFibonacciComputation() {
    if (!state.socket?.connected || state.deviceRole !== 'laptop' || state.isPhoneDisconnected) {
        updateUI('Cannot compute: disconnected or invalid state');
        return;
    }
    
    const n = state.targetN;
    if (typeof n !== 'number' || n < 0) {
        updateUI('Invalid target number');
        return;
    }
    
    // Handle base cases
    if (n <= 1) {
        state.values.set(n, n);
        updateUI(`F(${n}) = ${n}`);
        await continueComputation();
        return;
    }
    
    // Check if we already have this value
    if (state.values.has(n)) {
        updateUI(`Already have F(${n}) = ${state.values.get(n)}`);
        await continueComputation();
        return;
    }
    
    // Check if we have required values
    const n1 = n - 1, n2 = n - 2;
    if (state.values.has(n1) && state.values.has(n2)) {
        const result = state.values.get(n1) + state.values.get(n2);
        state.values.set(n, result);
        updateUI(`Computed F(${n}) = ${result}`);
        
        // Send result to phone
        await delay(config.MESSAGE_DELAY);
        state.socket.emit('computed-result', { [n]: result });
        updateMessageCount();
        
        await continueComputation();
        return;
    }
    
    // Request values from phone
    await delay(config.MESSAGE_DELAY);
    state.socket.emit('request-values', { n1, n2 });
    updateUI(`Requesting values for F(${n1}) and F(${n2})`);
}

async function continueComputation() {
    if (state.computationQueue.size > 0) {
        const next = Math.min(...state.computationQueue);
        state.targetN = next;
        state.computationQueue.delete(next);
        await requestFibonacciComputation();
    } else if (state.originalTarget > state.targetN) {
        state.targetN = state.originalTarget;
        await requestFibonacciComputation();
    }
}

// Socket Handling
function initializeSocket() {
    if (state.socket?.connected) {
        state.socket.disconnect();
    }
    
    try {
        state.socket = io();
        setupSocketHandlers();
        return true;
    } catch (error) {
        console.error('Failed to initialize socket:', error);
        return false;
    }
}

function setupSocketHandlers() {
    const socket = state.socket;
    if (!socket) return;
    
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
    
    socket.on('force-disconnect', (reason) => {
        updateUI(`Forced disconnect: ${reason}`);
        socket.disconnect();
        resetState();
        showRoleSelection();
    });
    
    socket.on('role-confirmed', (role) => {
        state.deviceRole = role;
        if (role === 'phone') {
            loadState();
        } else {
            initializeBaseValues();
        }
        showInterface();
        updateUI(`Role confirmed: ${role}`);
    });
    
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
        
        if (savedState?.values) {
            try {
                state.values = new Map(savedState.values);
                state.targetN = typeof savedState.targetN === 'number' ? savedState.targetN : null;
                state.messageCount = typeof savedState.messageCount === 'number' ? savedState.messageCount : 0;
                
                updateUI('Storage reconnected. Resuming computation...');
                if (state.targetN !== null) {
                    requestFibonacciComputation();
                }
            } catch (error) {
                console.error('Failed to restore state:', error);
                updateUI('Failed to restore state from reconnection');
            }
        } else {
            updateUI('Storage reconnected with no saved state');
        }
    });
    
    // Value request handling
    socket.on('value-request', async (data) => {
        if (state.deviceRole !== 'phone' || state.isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        
        const n1 = Number(data.n1);
        const n2 = Number(data.n2);
        
        if (isNaN(n1) || isNaN(n2)) {
            updateUI('Received invalid value request');
            return;
        }
        
        const has1 = state.values.has(n1);
        const has2 = state.values.has(n2);
        
        if (has1 && has2) {
            const values = {
                [n1]: state.values.get(n1),
                [n2]: state.values.get(n2)
            };
            socket.emit('send-values', { values });
            updateMessageCount();
            updateUI(`Sent values: F(${n1})=${values[n1]}, F(${n2})=${values[n2]}`);
        } else {
            socket.emit('values-not-found', { n1, n2 });
            updateUI(`Values not found for F(${n1}) and F(${n2})`);
        }
        
        updateStorageTable();
    });
    
    // Handle both compute-values and values-not-found the same way
    const handleMissingValues = async (data) => {
        if (state.deviceRole !== 'laptop') return;
        
        const n1 = Number(data.n1);
        const n2 = Number(data.n2);
        
        if (isNaN(n1) || isNaN(n2)) {
            updateUI('Received invalid compute request');
            return;
        }
        
        updateUI(`Computing values for F(${n1}) and F(${n2})`);
        
        if (!state.values.has(n1)) state.computationQueue.add(n1);
        if (!state.values.has(n2)) state.computationQueue.add(n2);
        
        if (state.computationQueue.size > 0) {
            const next = Math.min(...state.computationQueue);
            state.targetN = next;
            state.computationQueue.delete(next);
            await requestFibonacciComputation();
        }
    };
    
    socket.on('compute-values', handleMissingValues);
    socket.on('values-not-found', handleMissingValues);
    
    socket.on('receive-values', async (data) => {
        if (state.deviceRole !== 'laptop') return;
        
        await delay(config.MESSAGE_DELAY);
        
        if (!data?.values || typeof data.values !== 'object') {
            updateUI('Received invalid values format');
            return;
        }
        
        try {
            // Convert and validate received values
            const receivedValues = new Map();
            for (const [key, value] of Object.entries(data.values)) {
                const numKey = Number(key);
                const numValue = Number(value);
                if (!isNaN(numKey) && !isNaN(numValue)) {
                    receivedValues.set(numKey, numValue);
                }
            }
            
            // Verify we got what we needed
            const need1 = state.targetN - 1;
            const need2 = state.targetN - 2;
            
            if (!receivedValues.has(need1) || !receivedValues.has(need2)) {
                updateUI('Incomplete values received, computing locally');
                if (!receivedValues.has(need1)) state.computationQueue.add(need1);
                if (!receivedValues.has(need2)) state.computationQueue.add(need2);
                
                const next = Math.min(...state.computationQueue);
                state.targetN = next;
                state.computationQueue.delete(next);
                await requestFibonacciComputation();
                return;
            }
            
            // Store valid values
            for (const [key, value] of receivedValues) {
                state.values.set(key, value);
            }
            updateMessageCount();
            
            const receivedValuesStr = Array.from(receivedValues)
                .map(([n, v]) => `F(${n})=${v}`)
                .join(', ');
            updateUI(`Received values: ${receivedValuesStr}`);
            
            await requestFibonacciComputation();
            
        } catch (error) {
            console.error('Error processing received values:', error);
            updateUI('Error processing received values');
        }
    });
    
    socket.on('store-value', async (data) => {
        if (state.deviceRole !== 'phone' || state.isPhoneDisconnected) return;
        
        await delay(config.MESSAGE_DELAY);
        
        if (!data || typeof data !== 'object') {
            updateUI('Received invalid data format');
            return;
        }
        
        try {
            let stored = false;
            for (const [key, value] of Object.entries(data)) {
                const n = Number(key);
                const val = Number(value);
                if (!isNaN(n) && !isNaN(val)) {
                    state.values.set(n, val);
                    stored = true;
                }
            }
            
            if (stored) {
                updateMessageCount();
                const storedValues = Object.entries(data)
                    .map(([n, v]) => `F(${n})=${v}`)
                    .join(', ');
                updateUI(`Stored values: ${storedValues}`);
                updateStorageTable();
                saveState();
            } else {
                updateUI('No valid values to store');
            }
        } catch (error) {
            console.error('Error storing values:', error);
            updateUI('Error storing values');
        }
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize socket connection
    if (!initializeSocket()) {
        updateUI('Failed to connect to server');
        return;
    }
    
    // Set up role selection buttons
    elements.laptopBtn?.addEventListener('click', () => {
        if (state.socket?.connected) {
            state.socket.emit('select-role', 'laptop');
        } else {
            updateUI('Not connected to server');
        }
    });
    
    elements.phoneBtn?.addEventListener('click', () => {
        if (state.socket?.connected) {
            state.socket.emit('select-role', 'phone');
        } else {
            updateUI('Not connected to server');
        }
    });
    
    // Set up calculate button
    elements.calculateBtn?.addEventListener('click', async () => {
        if (state.isPhoneDisconnected) {
            updateUI('Cannot start computation while storage is disconnected');
            return;
        }
        
        const n = parseInt(elements.fibInput?.value);
        if (isNaN(n) || n < 0) {
            updateUI('Please enter a valid non-negative number');
            return;
        }
        
        // Initialize computation state
        state.targetN = n;
        state.originalTarget = n;
        state.computationQueue = new Set();
        initializeBaseValues();
        
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
            state.socket?.emit('phone-disconnect');
        } else {
            state.isPhoneDisconnected = false;
            updateDisconnectButton(false);
            updateUI('Storage reconnected');
            await delay(config.MESSAGE_DELAY);
            state.socket?.emit('phone-reconnect', {
                values: Array.from(state.values.entries()),
                targetN: state.targetN,
                messageCount: state.messageCount
            });
        }
    });
    
    // Set up reconnect button
    elements.reconnectBtn?.addEventListener('click', () => {
        if (state.socket?.connected) {
            state.socket.emit('request-reconnect');
            updateUI('Requesting reconnection with phone storage...');
        } else {
            updateUI('Not connected to server');
        }
    });
}); 