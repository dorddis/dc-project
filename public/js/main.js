// public/js/main.js

// Configuration
const config = {
    MESSAGE_DELAY: 700,           // 0.7s between messages
    RESPONSE_TIMEOUT: 10000,
    STORAGE_KEY: 'fibonacciState',
    BASE_VALUES: new Map([[0, 0], [1, 1]])
  };
  
  // Shared state
  const state = {
    deviceRole:        null,
    socket:            null,
    values:            new Map(),
    computationQueue:  new Set(),
    targetN:           null,
    originalTarget:    null,
    messageCount:      0,
    isPhoneDisconnected: false,
    disconnectTimer:   null,
    pendingRequests:   new Set()  // Track pending value requests
  };
  
  // UI elements
  const elements = {
    roleSelection:  document.getElementById('role-selection'),
    laptopInterface: document.getElementById('laptop-interface'),
    phoneInterface: document.getElementById('phone-interface'),
    calculateBtn:   document.getElementById('calculate-btn'),
    reconnectBtn:   document.getElementById('reconnect-btn'),
    disconnectBtn:  document.getElementById('disconnect-btn'),
    fibInput:       document.getElementById('fib-input'),
    laptopLogs:     document.getElementById('laptop-logs'),
    phoneLogs:      document.getElementById('phone-logs'),
    storageTable:   document.getElementById('storage-table')?.tBodies[0],
    messageCount:   document.getElementById('message-count'),
    laptopBtn:      document.getElementById('laptop-btn'),
    phoneBtn:       document.getElementById('phone-btn')
  };
  
  // Helpers
  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
  
  function canSendMessage() {
    return state.socket?.connected && state.deviceRole !== null;
  }
  
  function initializeBaseValues() {
    state.values = new Map(config.BASE_VALUES);
  }
  function resetState() {
    state.deviceRole        = null;
    state.computationQueue  = new Set();
    state.targetN           = null;
    state.originalTarget    = null;
    state.messageCount      = 0;
    state.isPhoneDisconnected = false;
    clearInterval(state.disconnectTimer);
    state.disconnectTimer = null;
    initializeBaseValues();
  }
  
  // Persist phone‐side
  function saveState() {
    if (state.deviceRole !== 'phone') return;
    console.log('[DEBUG] Phone saving state:', Array.from(state.values.entries()));
    localStorage.setItem(config.STORAGE_KEY, JSON.stringify({
      values: Array.from(state.values.entries()),
      targetN: state.targetN,
      originalTarget: state.originalTarget,
      messageCount: state.messageCount
    }));
  }
  function loadState() {
    const raw = localStorage.getItem(config.STORAGE_KEY);
    console.log('[DEBUG] Phone loading state from:', raw);
    if (!raw) return false;
    try {
      const p = JSON.parse(raw);
      state.values         = new Map(p.values || Array.from(config.BASE_VALUES));
      state.targetN        = Number.isFinite(p.targetN)      ? p.targetN      : null;
      state.originalTarget = Number.isFinite(p.originalTarget) ? p.originalTarget : null;
      state.messageCount   = Number.isFinite(p.messageCount)  ? p.messageCount  : 0;
      console.log('[DEBUG] Phone loaded state:', Array.from(state.values.entries()));
      return true;
    } catch {
      initializeBaseValues();
      return false;
    }
  }
  
  // UI updates
  function updateUI(msg, role = state.deviceRole) {
    const log = role === 'laptop' ? elements.laptopLogs : elements.phoneLogs;
    if (!log) return;
    const e = document.createElement('div');
    e.className = 'log-entry';
    e.textContent = `${new Date().toLocaleTimeString()}: ${msg}`;
    log.appendChild(e);
    log.scrollTop = log.scrollHeight;
  }
  function updateStorageTable() {
    if (!elements.storageTable) return;
    elements.storageTable.innerHTML = '';
    Array.from(state.values.entries())
      .sort(([a],[b])=>a-b)
      .forEach(([n,v])=>{
        const row = elements.storageTable.insertRow();
        row.insertCell(0).textContent = n;
        row.insertCell(1).textContent = v;
      });
  }
  function updateMessageCount() {
    state.messageCount++;
    if (elements.messageCount) 
      elements.messageCount.textContent = state.messageCount;
  }
  function updateDisconnectButton(dis) {
    if (elements.disconnectBtn)
      elements.disconnectBtn.textContent = dis ? 'Reconnect Storage' : 'Disconnect Storage';
  }
  function updateReconnectButton(enabled) {
    if (elements.reconnectBtn)
      elements.reconnectBtn.disabled = !enabled;
  }
  function showInterface() {
    elements.roleSelection?.classList.add('hidden');
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
  
  // Disconnect timer
  function startDisconnectTimer() {
    let cd = 10;
    updateUI(`No response from storage, terminating in ${cd}s`, 'laptop');
    clearInterval(state.disconnectTimer);
    state.disconnectTimer = setInterval(()=>{
      cd--;
      if (cd <= 0) {
        clearInterval(state.disconnectTimer);
        resetState();
        showRoleSelection();
      } else {
        updateUI(`No response from storage, terminating in ${cd}s`, 'laptop');
      }
    }, 1000);
  }
  
  // Fibonacci logic
  async function requestFibonacciComputation() {
    if (!canSendMessage() || state.deviceRole !== 'laptop') {
      updateUI('Cannot compute: invalid state', 'laptop');
      return;
    }
    const n = state.targetN;
    if (typeof n !== 'number' || n < 0) {
      updateUI('Invalid target', 'laptop');
      return;
    }
  
    // Base or cached
    if (n <= 1) {
      state.values.set(n, n);
      updateUI(`F(${n})=${n}`, 'laptop');
      await continueComputation();
      return;
    }
    if (state.values.has(n)) {
      updateUI(`Have F(${n})=${state.values.get(n)}`, 'laptop');
      await continueComputation();
      return;
    }
  
    // Can compute locally?
    const n1 = n - 1, n2 = n - 2;
    if (state.values.has(n1) && state.values.has(n2)) {
      const res = state.values.get(n1) + state.values.get(n2);
      state.values.set(n, res);
      updateUI(`Computed F(${n})=${res}`, 'laptop');
  
      // Send to phone if connected
      if (!state.isPhoneDisconnected) {
        await delay(config.MESSAGE_DELAY);
        state.socket.emit('computed-result', { [n]: res });
        updateMessageCount();
      }
  
      await continueComputation();
      return;
    }
  
    // If phone is disconnected but we have all values locally, compute them
    if (state.isPhoneDisconnected) {
      // Compute missing values recursively
      if (!state.values.has(n1)) {
        state.computationQueue.add(n1);
      }
      if (!state.values.has(n2)) {
        state.computationQueue.add(n2);
      }
      if (state.computationQueue.size > 0) {
        const next = Math.min(...state.computationQueue);
        state.computationQueue.delete(next);
        state.targetN = next;
        await requestFibonacciComputation();
        return;
      }
    }
  
    // Otherwise ask phone
    if (!state.isPhoneDisconnected) {
      const requestKey = `${n1},${n2}`;
      if (!state.pendingRequests.has(requestKey)) {
        state.pendingRequests.add(requestKey);
        await delay(config.MESSAGE_DELAY);
        state.socket.emit('request-values', { n1, n2 });
        updateUI(`Requesting F(${n1}),F(${n2})`, 'laptop');
      }
    } else {
      updateUI('Storage disconnected, cannot compute', 'laptop');
    }
  }
  
  async function continueComputation() {
    if (state.computationQueue.size > 0) {
      const next = Math.min(...state.computationQueue);
      state.computationQueue.delete(next);
      state.targetN = next;
      await requestFibonacciComputation();
    }
    else if (
      state.originalTarget !== null &&
      state.targetN !== state.originalTarget
    ) {
      const n = state.originalTarget;
      state.originalTarget = null;
      state.targetN = n;
      await requestFibonacciComputation();
    }
    else if (state.targetN !== null) {
      // Final computation step
      const n = state.targetN;
      const n1 = n - 1, n2 = n - 2;
      if (state.values.has(n1) && state.values.has(n2)) {
        const res = state.values.get(n1) + state.values.get(n2);
        state.values.set(n, res);
        updateUI(`Computed F(${n})=${res}`, 'laptop');
        
        // Send to phone
        await delay(config.MESSAGE_DELAY);
        state.socket.emit('computed-result', { [n]: res });
        updateMessageCount();
      }
    }
  }
  
  // Socket setup
  function initializeSocket() {
    if (state.socket?.connected) state.socket.disconnect();
    try {
      state.socket = io();
      setupSocketHandlers();
      return true;
    } catch {
      return false;
    }
  }
  
  function setupSocketHandlers() {
    const s = state.socket;
  
    s.on('connect', () => {
      updateUI('Connected', state.deviceRole);
      showRoleSelection();
    });
    
    s.on('disconnect', () => {
      updateUI('Disconnected', state.deviceRole);
      resetState();
      showRoleSelection();
    });
  
    s.on('force-disconnect', reason => {
      updateUI(`Forced disconnect: ${reason}`, state.deviceRole);
      s.disconnect();
      resetState();
      showRoleSelection();
    });
  
    s.on('role-confirmed', role => {
      state.deviceRole = role;
      if (role === 'phone') loadState();
      else                initializeBaseValues();
      showInterface();
      updateUI(`Role: ${role}`, role);
    });
  
    s.on('phone-disconnected', () => {
      if (state.deviceRole !== 'laptop') return;
      state.isPhoneDisconnected = true;
      updateReconnectButton(true);
      startDisconnectTimer();
      // Clear pending requests when phone disconnects
      state.pendingRequests.clear();
    });
  
    s.on('phone-reconnected', saved => {
      if (state.deviceRole !== 'laptop') return;
      clearInterval(state.disconnectTimer);
      state.isPhoneDisconnected = false;
      updateReconnectButton(false);
  
      if (saved?.values) {
        state.values = new Map(saved.values);
        state.targetN = saved.targetN;
        state.originalTarget = saved.originalTarget;
        state.messageCount = saved.messageCount;
        updateUI('Storage reconnected, resuming', 'laptop');
        
        // Clear pending requests and resume computation
        state.pendingRequests.clear();
        if (state.targetN !== null) {
          // Re-add current target to computation queue
          state.computationQueue.add(state.targetN);
          // Process computation queue
          const next = Math.min(...state.computationQueue);
          state.computationQueue.delete(next);
          state.targetN = next;
          requestFibonacciComputation();
        }
      } else {
        updateUI('Storage reconnected (no state)', 'laptop');
      }
    });
  
    // PHONE → handle value-request
    s.on('value-request', async data => {
      console.log('[DEBUG] Phone received value-request:', data);
      if (state.deviceRole !== 'phone' || state.isPhoneDisconnected) {
        console.log('[DEBUG] Phone ignoring request due to:', state.deviceRole !== 'phone' ? 'wrong role' : 'disconnected');
        return;
      }
      await delay(config.MESSAGE_DELAY);
  
      const n1 = Number(data.n1), n2 = Number(data.n2);
      console.log('[DEBUG] Phone checking values for:', { n1, n2 });
      console.log('[DEBUG] Phone current storage:', Array.from(state.values.entries()));
      
      if (isNaN(n1) || isNaN(n2)) {
        updateUI('Invalid request', 'phone');
        return;
      }
  
      const has1 = state.values.has(n1),
            has2 = state.values.has(n2);
      console.log('[DEBUG] Phone has values:', { has1, has2 });
  
      if (has1 && has2) {
        const vals = { [n1]: state.values.get(n1), [n2]: state.values.get(n2) };
        s.emit('send-values', { values: vals });
        updateMessageCount();
        updateUI(`Sent F(${n1})=${vals[n1]},F(${n2})=${vals[n2]}`, 'phone');
      } else {
        s.emit('values-not-found', { n1, n2 });
        updateUI(`Missing F(${n1}) or F(${n2})`, 'phone');
      }
  
      updateStorageTable();
    });
  
    // LAPTOP → missing values
    const handleMissing = async data => {
      if (state.deviceRole !== 'laptop') return;
      const n1 = Number(data.n1), n2 = Number(data.n2);
      if (isNaN(n1) || isNaN(n2)) {
        updateUI('Invalid compute request','laptop');
        return;
      }
      updateUI(`Compute F(${n1}),F(${n2}) locally`, 'laptop');
  
      if (!state.values.has(n1)) state.computationQueue.add(n1);
      if (!state.values.has(n2)) state.computationQueue.add(n2);
  
      if (state.computationQueue.size > 0) {
        const next = Math.min(...state.computationQueue);
        state.computationQueue.delete(next);
        state.targetN = next;
        await requestFibonacciComputation();
      }
    };
    s.on('compute-values',   handleMissing);
    s.on('values-not-found', handleMissing);
  
    // LAPTOP ← receive-values
    s.on('receive-values', async data => {
      if (state.deviceRole !== 'laptop') return;
      await delay(config.MESSAGE_DELAY);
  
      if (!data?.values || typeof data.values !== 'object') {
        updateUI('Invalid values format','laptop');
        return;
      }
  
      const got = new Map();
      for (const [k,v] of Object.entries(data.values)) {
        const nk = Number(k), nv = Number(v);
        if (!isNaN(nk) && !isNaN(nv)) got.set(nk, nv);
      }
  
      const need1 = state.targetN - 1,
            need2 = state.targetN - 2;
      if (!got.has(need1) || !got.has(need2)) {
        updateUI('Incomplete values, computing locally','laptop');
        if (!got.has(need1)) state.computationQueue.add(need1);
        if (!got.has(need2)) state.computationQueue.add(need2);
        const next = Math.min(...state.computationQueue);
        state.computationQueue.delete(next);
        state.targetN = next;
        await requestFibonacciComputation();
        return;
      }
  
      for (const [k,v] of got) state.values.set(k,v);
      updateMessageCount();
      const list = Array.from(got).map(([n,v]) => `F(${n})=${v}`).join(', ');
      updateUI(`Received ${list}`, 'laptop');
      await requestFibonacciComputation();
    });
  
    // PHONE ← store-value
    s.on('store-value', async data => {
      if (state.deviceRole !== 'phone' || state.isPhoneDisconnected) return;
      await delay(config.MESSAGE_DELAY);
  
      let stored = false;
      for (const [k,v] of Object.entries(data)) {
        const nk = Number(k), nv = Number(v);
        if (!isNaN(nk) && !isNaN(nv)) {
          state.values.set(nk, nv);
          stored = true;
        }
      }
      if (stored) {
        updateMessageCount();
        const list = Object.entries(data).map(([n,v]) => `F(${n})=${v}`).join(', ');
        updateUI(`Stored ${list}`, 'phone');
        updateStorageTable();
        saveState();
      } else {
        updateUI('No valid store data','phone');
      }
    });
  }
  
  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    if (!initializeSocket()) {
      updateUI('Unable to connect','laptop');
      return;
    }
  
    // Role buttons
    elements.laptopBtn?.addEventListener('click', () => {
      state.socket.emit('select-role','laptop');
    });
    elements.phoneBtn?.addEventListener('click', () => {
      state.socket.emit('select-role','phone');
    });
  
    // Calculate
    elements.calculateBtn?.addEventListener('click', async () => {
      if (state.isPhoneDisconnected) {
        updateUI('Storage disconnected','laptop');
        return;
      }
      const n = Number(elements.fibInput.value);
      if (!Number.isInteger(n) || n < 0) {
        updateUI('Enter a non-negative integer','laptop');
        return;
      }
      state.targetN        = n;
      state.originalTarget = n;
      state.computationQueue = new Set();
      initializeBaseValues();
      updateUI(`Starting F(${n})`,'laptop');
      await requestFibonacciComputation();
    });
  
    // Disconnect/reconnect storage
    elements.disconnectBtn?.addEventListener('click', async () => {
      if (!state.isPhoneDisconnected) {
        state.isPhoneDisconnected = true;
        updateDisconnectButton(true);
        updateUI('Storage disconnected','phone');
        await delay(config.MESSAGE_DELAY);
        state.socket.emit('phone-disconnect');
      } else {
        state.isPhoneDisconnected = false;
        updateDisconnectButton(false);
        updateUI('Storage reconnected','phone');
        await delay(config.MESSAGE_DELAY);
        state.socket.emit('phone-reconnect',{
          values:          Array.from(state.values.entries()),
          targetN:         state.targetN,
          originalTarget:  state.originalTarget,
          messageCount:    state.messageCount
        });
      }
    });
  
    // Reconnect button
    elements.reconnectBtn?.addEventListener('click', () => {
      state.socket.emit('request-reconnect');
      updateUI('Requesting reconnection','laptop');
    });
  });
  