(() => {
  'use strict';

  // ================= 1. ESKI DOMENDAN YANGI DOMENGA REDIRECT =================
  if (window.location.hostname === 'web-desktop-chi.vercel.app') {
    window.location.replace('https://monitor-mr.vercel.app' + window.location.pathname + window.location.search);
    return;
  }

  // ================= 2. DEVTOOLS & KONSOL HIMOYA =================
  document.addEventListener('contextmenu', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  });

  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  // ================= 3. DOM ELEMENTLAR =================
  // 0. Splash View
  const splashView = document.getElementById('splash-view');

  // 1. Login View
  const loginView = document.getElementById('login-view');
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const loginError = document.getElementById('login-error');

  // 2. Welcome View
  const welcomeView = document.getElementById('welcome-view');
  const welcomeUser = document.getElementById('welcome-user');
  const modeScreenBtn = document.getElementById('mode-screen-btn');
  const modeShellBtn = document.getElementById('mode-shell-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // 3. Countdown View
  const countdownView = document.getElementById('countdown-view');
  const countdownNum = document.getElementById('countdown-num');
  const progressBar = document.getElementById('progress-bar');

  // 4. Screen View & Bottom Bar
  const screenView = document.getElementById('screen-view');
  const videoEl = document.getElementById('screen-video');
  const screenBottombar = document.getElementById('screen-bottombar');
  const barDashboardBtn = document.getElementById('bar-dashboard-btn');
  const barPauseBtn = document.getElementById('bar-pause-btn');
  const barIconPause = document.getElementById('bar-icon-pause');
  const barIconPlay = document.getElementById('bar-icon-play');
  const barAudioBtn = document.getElementById('bar-audio-btn');
  const barIconAudioOn = document.getElementById('bar-icon-audio-on');
  const barIconAudioOff = document.getElementById('bar-icon-audio-off');
  const barMicBtn = document.getElementById('bar-mic-btn');
  const barShellBtn = document.getElementById('bar-shell-btn');
  const barFullscreenBtn = document.getElementById('bar-fullscreen-btn');
  const barMoreBtn = document.getElementById('bar-more-btn');
  const barMoreMenu = document.getElementById('bar-more-menu');
  const menuPipBtn = document.getElementById('menu-pip-btn');
  const menuReconnectBtn = document.getElementById('menu-reconnect-btn');
  const menuLogoutBtn = document.getElementById('menu-logout-btn');

  // 5. Shell Terminal View
  const shellView = document.getElementById('shell-view');
  const shellCwdText = document.getElementById('shell-cwd-text');
  const shellToScreenBtn = document.getElementById('shell-to-screen-btn');
  const shellToMenuBtn = document.getElementById('shell-to-menu-btn');
  const shellLogoutBtn = document.getElementById('shell-logout-btn');
  const terminalScreen = document.getElementById('terminal-screen');
  const terminalHistory = document.getElementById('terminal-history');
  const terminalInput = document.getElementById('terminal-input');
  const terminalActiveLine = document.querySelector('.terminal-active-line');
  const ghostHidden = document.getElementById('ghost-hidden');
  const ghostSuggestion = document.getElementById('ghost-suggestion');

  // ================= 4. HOLAT (STATE) =================
  let authToken = localStorage.getItem('desktop_auth_token') || null;
  let currentUsername = localStorage.getItem('desktop_username') || '';
  let remoteHost = localStorage.getItem('remote_desk_host') || '';
  let currentCwd = '~';
  const cmdHistory = [];
  let cmdIndex = -1;
  let shellHistory = [];
  let currentSuggestion = '';
  let isMicActive = false;
  let prewarmStarted = false;
  let countdownTimer = null;
  let blockCountdownTimer = null;

  let bottombarTimer = null;

  function showBottombar() {
    if (!screenBottombar) return;
    screenBottombar.classList.remove('hidden-bar');

    if (bottombarTimer) clearTimeout(bottombarTimer);

    // Agar 3-nuqta menyusi ochiq bo'lmasa 4 soniyadan keyin avtomatik yashiriladi
    if (!barMoreMenu || barMoreMenu.classList.contains('hidden')) {
      bottombarTimer = setTimeout(() => {
        hideBottombar();
      }, 4000);
    }
  }

  function hideBottombar() {
    if (!screenBottombar) return;
    if (barMoreMenu) barMoreMenu.classList.add('hidden');
    screenBottombar.classList.add('hidden-bar');
  }

  function toggleBottombar() {
    if (!screenBottombar) return;
    if (screenBottombar.classList.contains('hidden-bar')) {
      showBottombar();
    } else {
      hideBottombar();
    }
  }

  // ================= 5. VIEW BOSHQARUVI =================
  function showView(viewId) {
    const views = [splashView, loginView, welcomeView, countdownView, screenView, shellView];
    views.forEach(v => {
      if (v) {
        if (v.id === viewId) {
          v.classList.remove('hidden');
        } else {
          v.classList.add('hidden');
        }
      }
    });

    if (viewId !== 'screen-view' && viewId !== 'countdown-view') {
      stopStream();
      hideBottombar();
    }

    if (viewId === 'screen-view') {
      showBottombar();
    }

    if (viewId === 'shell-view') {
      initShellStreamSocket();
      fetchShellHistory();
      setTimeout(() => {
        if (terminalInput) terminalInput.focus();
      }, 60);
    }
  }

  function showWelcomeView(username) {
    if (welcomeUser) {
      welcomeUser.textContent = 'MONITOR';
    }
    showView('welcome-view');
  }

  // ================= 6. KONFIGURATSIYA VA AVTORIZATSIYA TEKSHIRUVI =================
  async function initConfig() {
    const params = new URLSearchParams(window.location.search);
    const qHost = params.get('host') || params.get('h');
    if (qHost) {
      remoteHost = qHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      localStorage.setItem('remote_desk_host', remoteHost);
    }

    if (!remoteHost) {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data && data.host) {
            remoteHost = data.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
            localStorage.setItem('remote_desk_host', remoteHost);
          }
        }
      } catch (e) {}
    }

    const savedToken = localStorage.getItem('desktop_auth_token');

    // Agar token saqlangan bo'lsa: Blok va Auth ni bir vaqtda (parallel) tezkor tekshiramiz
    if (savedToken) {
      try {
        const [authRes, blockRes] = await Promise.all([
          fetch(getApiUrl('/api/check-auth'), {
            headers: {
              'Authorization': `Bearer ${savedToken}`,
              'ngrok-skip-browser-warning': 'true'
            },
            credentials: 'include'
          }).catch(() => null),
          fetch(getApiUrl('/api/check-block'), {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          }).catch(() => null)
        ]);

        if (blockRes && blockRes.ok) {
          const blockData = await blockRes.json().catch(() => null);
          if (blockData && blockData.blocked && blockData.retryAfterSeconds) {
            startBlockCountdown(blockData.retryAfterSeconds);
            showView('login-view');
            return;
          }
        }

        if (authRes && authRes.ok) {
          const authData = await authRes.json().catch(() => null);
          if (authData && authData.authenticated) {
            authToken = authData.token || savedToken;
            currentUsername = authData.username || localStorage.getItem('desktop_username') || 'muhamad';
            showWelcomeView(currentUsername);
            return;
          }
        }
      } catch (e) {}

      // Agar sessiya serverda tugagan bo'lsa
      localStorage.removeItem('desktop_auth_token');
      authToken = null;
    } else {
      // Token bo'lmaganda faqat bloklanganlikni tekshiramiz
      try {
        const blockRes = await fetch(getApiUrl('/api/check-block'), {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (blockRes.ok) {
          const blockData = await blockRes.json();
          if (blockData && blockData.blocked && blockData.retryAfterSeconds) {
            startBlockCountdown(blockData.retryAfterSeconds);
          }
        }
      } catch (e) {}
    }

    showView('login-view');
  }

  function getHost() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.host;
    }
    return remoteHost || localStorage.getItem('remote_desk_host') || window.location.host;
  }

  function getApiUrl(path) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return path;
    }
    return `${window.location.protocol}//${getHost()}${path}`;
  }

  function getStreamUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    return `${protocol}//${getHost()}/video-stream${token}`;
  }

  // ================= 6.1 ULTRA-TEZKOR SHELL STREAM (WEBRTC/WEBSOCKET) =================
  let shellWs = null;
  const shellPending = new Map();

  function getShellStreamUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    return `${protocol}//${getHost()}/shell-stream${token}`;
  }

  function initShellStreamSocket() {
    if (!authToken) return;
    if (shellWs && (shellWs.readyState === WebSocket.OPEN || shellWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      shellWs = new WebSocket(getShellStreamUrl());

      shellWs.onopen = () => {
        // Ultra-past kechikishli shell oqimi ulandi
        try {
          shellWs.send(JSON.stringify({ type: 'get_history' }));
        } catch (_) {}
      };

      shellWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { id, type } = data;

          // Fish/Bash tarixi kelganda yuklash
          if (type === 'history' && Array.isArray(data.history)) {
            shellHistory = data.history;
            cmdHistory.length = 0;
            cmdHistory.push(...shellHistory);
            cmdIndex = cmdHistory.length;
            return;
          }

          if (!id || !shellPending.has(id)) return;

          const req = shellPending.get(id);

          if (type === 'chunk') {
            if (req.onChunk) req.onChunk(data);
          } else if (type === 'done') {
            clearTimeout(req.timer);
            shellPending.delete(id);
            if (req.onDone) req.onDone(data);
          }
        } catch (e) {}
      };

      shellWs.onclose = () => {
        shellWs = null;
        if (authToken) {
          setTimeout(initShellStreamSocket, 2000);
        }
      };

      shellWs.onerror = () => {};
    } catch (e) {
      shellWs = null;
    }
  }

  // ================= 6.2 FISH & BASH TARIXINI YUKLASH VA AUTOSUGGEST =================
  async function fetchShellHistory() {
    if (!authToken) return;
    try {
      const res = await fetch(getApiUrl('/api/shell-history'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history) && data.history.length > 0) {
          shellHistory = data.history;
          cmdHistory.length = 0;
          cmdHistory.push(...shellHistory);
          cmdIndex = cmdHistory.length;
        }
      }
    } catch (_) {}
  }

  function updateSuggestion() {
    if (!ghostHidden || !ghostSuggestion || !terminalInput) return;
    const val = terminalInput.value;
    if (!val || !val.trim()) {
      clearSuggestion();
      return;
    }

    // Fish kabi eng yangi tarixdan boshlab qidirish
    let match = '';
    for (let i = shellHistory.length - 1; i >= 0; i--) {
      const item = shellHistory[i];
      if (item && item.startsWith(val) && item !== val) {
        match = item;
        break;
      }
    }

    if (match) {
      currentSuggestion = match;
      ghostHidden.textContent = val;
      ghostSuggestion.textContent = match.slice(val.length);
    } else {
      clearSuggestion();
    }
  }

  function clearSuggestion() {
    currentSuggestion = '';
    if (ghostHidden) ghostHidden.textContent = '';
    if (ghostSuggestion) ghostSuggestion.textContent = '';
  }

  // ================= 8. FULLSCREEN TOGGLE =================
  function toggleFullscreen(forceOpen = false) {
    const doc = document;
    const isFull = doc.fullscreenElement || doc.webkitFullscreenElement;

    if (forceOpen || !isFull) {
      if (doc.documentElement.requestFullscreen) {
        doc.documentElement.requestFullscreen().catch(() => {});
      } else if (doc.documentElement.webkitRequestFullscreen) {
        doc.documentElement.webkitRequestFullscreen();
      } else if (videoEl && videoEl.webkitEnterFullscreen) {
        videoEl.webkitEnterFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen().catch(() => {});
      }
    }
  }

  if (videoEl) {
    videoEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      toggleFullscreen();
    });

    let lastTapTime = 0;
    videoEl.addEventListener('touchend', (e) => {
      const now = Date.now();
      const diff = now - lastTapTime;
      if (diff < 350 && diff > 0) {
        e.preventDefault();
        toggleFullscreen();
      }
      lastTapTime = now;
    });
  }

  // ================= 9. LOGOUT (TIZIMDAN CHIQISH) =================
  async function logoutSession(reason = '') {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    if (authToken) {
      try {
        await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include'
        });
      } catch (e) {}
    }

    authToken = null;
    localStorage.removeItem('desktop_auth_token');
    localStorage.removeItem('desktop_username');
    stopStream();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    showView('login-view');

    if (reason && loginError) {
      loginError.textContent = reason;
      loginError.classList.remove('hidden');
    }
  }

  // ================= 10. WEBRTC STREAM & AUDIO & CONTROLS =================
  function updateAudioUI(isMuted) {
    if (!barAudioBtn) return;
    if (isMuted) {
      if (barIconAudioOn) barIconAudioOn.classList.add('hidden');
      if (barIconAudioOff) barIconAudioOff.classList.remove('hidden');
      barAudioBtn.classList.remove('active');
    } else {
      if (barIconAudioOff) barIconAudioOff.classList.add('hidden');
      if (barIconAudioOn) barIconAudioOn.classList.remove('hidden');
      barAudioBtn.classList.add('active');
    }
  }

  function toggleAudio() {
    if (!videoEl) return;
    const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
    if (innerVideo) {
      innerVideo.muted = !innerVideo.muted;
      if (!innerVideo.muted) {
        innerVideo.play().catch(() => {});
      }
      updateAudioUI(innerVideo.muted);
    }
  }

  function togglePause() {
    if (!videoEl) return;
    const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
    if (!innerVideo) return;

    if (innerVideo.paused) {
      innerVideo.play().catch(() => {});
      if (barIconPause) barIconPause.classList.remove('hidden');
      if (barIconPlay) barIconPlay.classList.add('hidden');
      if (barPauseBtn) barPauseBtn.classList.remove('active');
    } else {
      innerVideo.pause();
      if (barIconPause) barIconPause.classList.add('hidden');
      if (barIconPlay) barIconPlay.classList.remove('hidden');
      if (barPauseBtn) barPauseBtn.classList.add('active');
    }
  }

  function updateMicUI(active) {
    if (!barMicBtn) return;
    if (active) {
      barMicBtn.classList.add('active');
    } else {
      barMicBtn.classList.remove('active');
    }
  }

  async function toggleMic() {
    if (!videoEl) return;
    if (typeof videoEl.toggleMic === 'function') {
      isMicActive = await videoEl.toggleMic();
    } else if (typeof videoEl.setMicEnabled === 'function') {
      isMicActive = !isMicActive;
      videoEl.setMicEnabled(isMicActive);
    }
    updateMicUI(isMicActive);
  }

  async function togglePictureInPicture() {
    if (!videoEl) return;
    const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
    if (!innerVideo) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await innerVideo.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP xatosi:', err.message);
    }
  }

  function reconnectStream() {
    stopStream();
    setTimeout(() => {
      startStream();
      showBottombar();
    }, 150);
  }

  function startStream() {
    if (prewarmStarted || !videoEl) return;
    prewarmStarted = true;

    try {
      const streamUrl = getStreamUrl();
      videoEl.mode = 'webrtc';
      videoEl.media = 'video,audio,microphone';
      videoEl.src = streamUrl;

      const triggerPlay = () => {
        try {
          const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
          if (innerVideo) {
            innerVideo.playsInline = true;
            innerVideo.muted = false;
            innerVideo.play().then(() => {
              updateAudioUI(false);
            }).catch(() => {
              innerVideo.muted = true;
              innerVideo.play().catch(() => {});
              updateAudioUI(true);
            });
          }
        } catch (e) {}
      };

      triggerPlay();
      window.addEventListener('click', triggerPlay, { once: true });
      window.addEventListener('touchstart', triggerPlay, { once: true });
    } catch (err) {
      console.warn('Video ulanish xatosi:', err.message);
    }
  }

  function stopStream() {
    prewarmStarted = false;
    isMicActive = false;
    updateMicUI(false);

    if (videoEl) {
      try {
        if (typeof videoEl.ondisconnect === 'function') {
          videoEl.ondisconnect();
        }
      } catch (e) {}
    }
  }

  // ================= 11. TAYMER & SCREEN REJIMIGA KIRISH =================
  function startCountdown(seconds = 3) {
    if (countdownTimer) clearInterval(countdownTimer);
    showView('countdown-view');
    prewarmStarted = false;

    let remain = seconds;
    if (countdownNum) countdownNum.textContent = remain;
    if (progressBar) progressBar.style.width = '100%';

    countdownTimer = setInterval(() => {
      remain -= 1;

      if (remain <= 1 && !prewarmStarted) {
        startStream();
      }

      if (remain <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        showView('screen-view');
        startStream();
        toggleFullscreen(true);
      } else {
        if (countdownNum) countdownNum.textContent = remain;
        if (progressBar) progressBar.style.width = `${(remain / seconds) * 100}%`;
      }
    }, 1000);
  }

  // ================= 12. SHELL TERMINAL BOSHQARUVI =================
  function updateCwdUI() {
    if (!shellCwdText) return;
    const home = '/home/muhamad';
    let display = currentCwd;
    if (display === home) {
      display = '~';
    } else if (display.startsWith(home + '/')) {
      display = '~' + display.slice(home.length);
    }
    shellCwdText.textContent = display;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ansiToHtml(str) {
    if (!str) return '';
    const ansiMap = {
      '30': 'color: #4e4e4e',
      '31': 'color: #ff5555',
      '32': 'color: #50fa7b',
      '33': 'color: #f1fa8c',
      '34': 'color: #bd93f9',
      '35': 'color: #ff79c6',
      '36': 'color: #8be9fd',
      '37': 'color: #f8f8f2',
      '90': 'color: #797979',
      '91': 'color: #ff6e6e',
      '92': 'color: #69ff94',
      '93': 'color: #ffffa5',
      '94': 'color: #d6acff',
      '95': 'color: #ff92df',
      '96': 'color: #a4ffff',
      '97': 'color: #ffffff',
      '1': 'font-weight: bold',
      '2': 'opacity: 0.7',
      '4': 'text-decoration: underline'
    };

    let escaped = escapeHtml(str);
    return escaped.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
      if (codes === '0' || codes === '00') return '</span>';
      const parts = codes.split(';');
      const styles = [];
      for (const p of parts) {
        if (ansiMap[p]) styles.push(ansiMap[p]);
      }
      return styles.length ? `<span style="${styles.join('; ')}">` : '';
    });
  }

  function scrollTerminalToBottom() {
    if (terminalScreen) {
      terminalScreen.scrollTop = terminalScreen.scrollHeight;
    }
  }

  function appendTerminalMessage(title, text, isError = false) {
    if (!terminalHistory) return;
    const entry = document.createElement('div');
    entry.className = 'term-entry';

    let html = `
      <div class="term-cmd-line">
        <span class="prompt-tag">[I]</span>
        <span class="prompt-arrow">&gt;</span>
        <span class="term-cmd-text" style="color: #888888;">${escapeHtml(title)}</span>
      </div>
    `;

    if (text) {
      const errorClass = isError ? ' error' : '';
      html += `<pre class="term-output${errorClass}">${ansiToHtml(text)}</pre>`;
    }

    entry.innerHTML = html;
    terminalHistory.appendChild(entry);
    scrollTerminalToBottom();
  }

  function executeTerminalCommand(rawCmd) {
    const cmd = rawCmd.trim();
    if (!cmd) return Promise.resolve();

    cmdHistory.push(cmd);
    cmdIndex = cmdHistory.length;
    if (!shellHistory.includes(cmd)) {
      shellHistory.push(cmd);
    }

    if (cmd === 'clear') {
      if (terminalHistory) terminalHistory.innerHTML = '';
      return Promise.resolve();
    }

    if (cmd === 'exit') {
      showView('welcome-view');
      return Promise.resolve();
    }

    // Tarixga kiritish va bajarilayotganini ko'rsatish
    const entry = document.createElement('div');
    entry.className = 'term-entry';
    entry.innerHTML = `
      <div class="term-cmd-line">
        <span class="prompt-tag">[I]</span>
        <span class="prompt-arrow">&gt;</span>
        <span class="term-cmd-text">${escapeHtml(cmd)}</span>
      </div>
      <pre class="term-output" style="color: #666666;"></pre>
    `;
    terminalHistory.appendChild(entry);
    scrollTerminalToBottom();

    const outputEl = entry.querySelector('.term-output');

    // 1. Ultra-tezkor WebSocket rejimida jo'natish (WebRTC kabi ko'z yumib ochguncha)
    if (shellWs && shellWs.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        const cmdId = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        let accumulatedText = '';
        let hasReceived = false;

        const timer = setTimeout(() => {
          if (shellPending.has(cmdId)) {
            shellPending.delete(cmdId);
            if (!hasReceived) {
              outputEl.className = 'term-output error';
              outputEl.textContent = 'Buyruq kutish vaqti tugadi (timeout: 20s).';
            }
            resolve();
          }
        }, 20000);

        shellPending.set(cmdId, {
          timer,
          onChunk: (chunk) => {
            hasReceived = true;
            if (chunk.stdout) accumulatedText += chunk.stdout;
            if (chunk.stderr) accumulatedText += chunk.stderr;
            outputEl.innerHTML = ansiToHtml(accumulatedText);
            scrollTerminalToBottom();
          },
          onDone: (data) => {
            hasReceived = true;
            if (data.cwd) {
              currentCwd = data.cwd;
              updateCwdUI();
            }
            if (data.stdout && !accumulatedText.includes(data.stdout)) accumulatedText += data.stdout;
            if (data.stderr && !accumulatedText.includes(data.stderr)) accumulatedText += data.stderr;

            if (!accumulatedText.trim()) {
              outputEl.remove();
            } else {
              const isError = data.exitCode !== 0;
              outputEl.className = isError ? 'term-output error' : 'term-output';
              outputEl.innerHTML = ansiToHtml(accumulatedText);
            }
            scrollTerminalToBottom();
            resolve();
          }
        });

        shellWs.send(JSON.stringify({ id: cmdId, command: cmd, cwd: currentCwd }));
      });
    }

    // 2. Agar WebSocket ulanmagan bo'lsa uni tiklashga urinib, HTTP fallback orqali jo'natish
    initShellStreamSocket();
    outputEl.textContent = '...';

    return (async () => {
      try {
        const res = await fetch(getApiUrl('/api/shell'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          body: JSON.stringify({ command: cmd, cwd: currentCwd })
        });

        if (res.status === 401) {
          outputEl.className = 'term-output error';
          outputEl.textContent = 'Sessiya tugadi. Qayta tizimga kiring.';
          setTimeout(() => logoutSession(), 1500);
          return;
        }

        const data = await res.json();
        if (data.cwd) {
          currentCwd = data.cwd;
          updateCwdUI();
        }

        const hasStdout = Boolean(data.stdout && data.stdout.trim());
        const hasStderr = Boolean(data.stderr && data.stderr.trim());

        if (!hasStdout && !hasStderr) {
          outputEl.remove();
        } else {
          const isError = data.exitCode !== 0;
          outputEl.className = isError ? 'term-output error' : 'term-output';
          let fullText = '';
          if (data.stdout) fullText += data.stdout;
          if (data.stderr) fullText += (fullText ? '\n' : '') + data.stderr;
          outputEl.innerHTML = ansiToHtml(fullText);
        }
      } catch (err) {
        outputEl.className = 'term-output error';
        outputEl.textContent = `Xatolik: ${err.message}`;
      }

      scrollTerminalToBottom();
    })();
  }

  if (terminalInput) {
    terminalInput.addEventListener('input', () => {
      updateSuggestion();
    });

    terminalInput.addEventListener('keydown', async (e) => {
      // Tab yoki ArrowRight (qator oxirida) bosilganda autosuggestion ni qabul qilish
      if (e.key === 'Tab') {
        if (currentSuggestion) {
          e.preventDefault();
          terminalInput.value = currentSuggestion;
          clearSuggestion();
          return;
        }
      }

      if (e.key === 'ArrowRight') {
        if (currentSuggestion && terminalInput.selectionStart === terminalInput.value.length) {
          e.preventDefault();
          terminalInput.value = currentSuggestion;
          clearSuggestion();
          return;
        }
      }

      if (e.key === 'Escape') {
        clearSuggestion();
        return;
      }

      if (e.key === 'Enter') {
        clearSuggestion();
        e.preventDefault();
        const cmd = terminalInput.value;
        if (!cmd.trim()) return;

        terminalInput.value = '';
        if (terminalActiveLine) terminalActiveLine.classList.add('hidden');

        try {
          await executeTerminalCommand(cmd);
        } finally {
          if (terminalActiveLine) terminalActiveLine.classList.remove('hidden');
          terminalInput.focus();
          scrollTerminalToBottom();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        clearSuggestion();
        if (cmdHistory.length > 0 && cmdIndex > 0) {
          cmdIndex--;
          terminalInput.value = cmdHistory[cmdIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        clearSuggestion();
        if (cmdIndex < cmdHistory.length - 1) {
          cmdIndex++;
          terminalInput.value = cmdHistory[cmdIndex];
        } else {
          cmdIndex = cmdHistory.length;
          terminalInput.value = '';
        }
      } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        clearSuggestion();
        if (terminalHistory) terminalHistory.innerHTML = '';
      }
    });
  }

  if (terminalScreen) {
    terminalScreen.addEventListener('click', () => {
      if (window.getSelection().toString().length === 0) {
        if (terminalInput) terminalInput.focus();
      }
    });
  }

  // ================= 13. NAVIGATSIYA TUGMALARI =================
  // Menyu -> Ekran
  if (modeScreenBtn) {
    modeScreenBtn.addEventListener('click', () => {
      startCountdown(3);
    });
  }

  // Menyu -> Shell
  if (modeShellBtn) {
    modeShellBtn.addEventListener('click', () => {
      showView('shell-view');
    });
  }

  // Menyu -> Chiqish
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logoutSession();
    });
  }

  // Ekranga tekkanda / harakatlanganda bottombarni ko'rsatish
  if (screenView) {
    screenView.addEventListener('click', (e) => {
      if (e.target.closest('#screen-bottombar')) return;
      toggleBottombar();
    });

    screenView.addEventListener('mousemove', () => {
      showBottombar();
    });

    screenView.addEventListener('touchstart', (e) => {
      if (e.target.closest('#screen-bottombar')) return;
      showBottombar();
    }, { passive: true });
  }

  // Bottombar -> Bosh menyu (Dashboard)
  if (barDashboardBtn) {
    barDashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showView('welcome-view');
    });
  }

  // Bottombar -> Pauza / Play
  if (barPauseBtn) {
    barPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause();
      showBottombar();
    });
  }

  // Bottombar -> Ovoz (Audio On/Off)
  if (barAudioBtn) {
    barAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudio();
      showBottombar();
    });
  }

  // Bottombar -> Gapirish (Mic On/Off)
  if (barMicBtn) {
    barMicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMic();
      showBottombar();
    });
  }

  // Bottombar -> Shell
  if (barShellBtn) {
    barShellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showView('shell-view');
    });
  }

  // Bottombar -> To'liq ekran
  if (barFullscreenBtn) {
    barFullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
      showBottombar();
    });
  }

  // Bottombar -> 3-Nuqta (More menyu)
  if (barMoreBtn) {
    barMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barMoreMenu) {
        barMoreMenu.classList.toggle('hidden');
        if (!barMoreMenu.classList.contains('hidden')) {
          if (bottombarTimer) clearTimeout(bottombarTimer);
        } else {
          showBottombar();
        }
      }
    });
  }

  // Menyu tashqarisiga bosilganda uni yopish
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.bar-more-wrapper')) {
      if (barMoreMenu) barMoreMenu.classList.add('hidden');
    }
  });

  // More menu -> Picture-in-Picture
  if (menuPipBtn) {
    menuPipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barMoreMenu) barMoreMenu.classList.add('hidden');
      togglePictureInPicture();
    });
  }

  // More menu -> Qayta ulanish (Reconnect)
  if (menuReconnectBtn) {
    menuReconnectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barMoreMenu) barMoreMenu.classList.add('hidden');
      reconnectStream();
    });
  }

  // More menu -> Tizimdan chiqish
  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      logoutSession();
    });
  }

  // Shell sarlavhasi -> Ekran
  if (shellToScreenBtn) {
    shellToScreenBtn.addEventListener('click', () => {
      showView('screen-view');
      startStream();
      toggleFullscreen(true);
    });
  }

  // Shell sarlavhasi -> Menyu
  if (shellToMenuBtn) {
    shellToMenuBtn.addEventListener('click', () => {
      showView('welcome-view');
    });
  }

  // Shell sarlavhasi -> Chiqish
  if (shellLogoutBtn) {
    shellLogoutBtn.addEventListener('click', () => {
      logoutSession();
    });
  }

  // ================= 14. BLOK TAYMERI =================
  function startBlockCountdown(totalSeconds) {
    if (blockCountdownTimer) clearInterval(blockCountdownTimer);
    let remain = Math.max(1, Math.round(totalSeconds));

    function updateBlockText() {
      const mins = Math.floor(remain / 60);
      const secs = remain % 60;
      let timeText = '';
      if (mins > 0) timeText += `${mins} daqiqa `;
      timeText += `${secs} soniya`;
      if (loginError) {
        loginError.textContent = `Xavfsizlik bloki: Juda ko'p xato urinishlar. Ushbu IP ${timeText}ga bloklangan.`;
        loginError.classList.remove('hidden');
      }
    }

    updateBlockText();
    blockCountdownTimer = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        clearInterval(blockCountdownTimer);
        blockCountdownTimer = null;
        if (loginError) loginError.classList.add('hidden');
      } else {
        updateBlockText();
      }
    }, 1000);
  }

  // ================= 15. LOGIN FORMA =================
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginError) loginError.classList.add('hidden');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Tekshirilmoqda...';
      }

      try {
        const res = await fetch(getApiUrl('/api/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
          if (blockCountdownTimer) {
            clearInterval(blockCountdownTimer);
            blockCountdownTimer = null;
          }
          authToken = data.token;
          currentUsername = data.username || username;
          localStorage.setItem('desktop_auth_token', authToken);
          localStorage.setItem('desktop_username', currentUsername);

          if (passwordInput) passwordInput.value = '';
          showWelcomeView(currentUsername);
        } else {
          if (data.retryAfterSeconds) {
            startBlockCountdown(data.retryAfterSeconds);
          } else {
            if (blockCountdownTimer) {
              clearInterval(blockCountdownTimer);
              blockCountdownTimer = null;
            }
            if (loginError) {
              loginError.textContent = data.message || 'Login yoki parol noto‘g‘ri!';
              loginError.classList.remove('hidden');
            }
          }
        }
      } catch (err) {
        if (loginError) {
          loginError.textContent = 'Server bilan bog‘lanishda xatolik yuz berdi';
          loginError.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kirish';
        }
      }
    });
  }

  // ================= 16. ISHGA TUSHIRISH =================
  updateCwdUI();
  initConfig();
})();
