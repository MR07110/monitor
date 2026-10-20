(() => {
  'use strict';

  // ================= 1. ESKI DOMENDAN YANGI DOMENGA REDIRECT =================
  if (window.location.hostname === 'web-desktop-chi.vercel.app') {
    window.location.replace('https://monitor-mr.vercel.app' + window.location.pathname + window.location.search);
    return;
  }

  // ================= 2. DEVTOOLS & KONSOL HIMOYA =================
  document.addEventListener('contextmenu', e => e.preventDefault());
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
  const loginView = document.getElementById('login-view');
  const countdownView = document.getElementById('countdown-view');
  const screenView = document.getElementById('screen-view');
  const orientationWarning = document.getElementById('orientation-warning');

  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const loginError = document.getElementById('login-error');

  const countdownNum = document.getElementById('countdown-num');
  const progressBar = document.getElementById('progress-bar');
  const videoEl = document.getElementById('screen-video');

  // Xavfsiz xotira (Refresh bo'lsa darhol uziladi)
  let authToken = null;
  let mpegtsPlayer = null;
  let remoteHost = localStorage.getItem('remote_desk_host') || '';
  let syncTimer = null;
  let prewarmStarted = false;

  // ================= 4. KONFIGURATSIYA =================
  async function initConfig() {
    const params = new URLSearchParams(window.location.search);
    const qHost = params.get('host') || params.get('h');
    if (qHost) {
      remoteHost = qHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      localStorage.setItem('remote_desk_host', remoteHost);
    }

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

    // Bloklanganlikni tekshirish
    try {
      const blockRes = await fetch(getApiUrl('/api/check-block'), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (blockRes.ok) {
        const blockData = await blockRes.json();
        if (blockData.blocked && blockData.retryAfterSeconds) {
          startBlockCountdown(blockData.retryAfterSeconds);
        }
      }
    } catch (e) {}
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

  // ================= 5. ORIENTATSIYA NAZORATI (MOBILE & TABLET) =================
  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const isMobileOrTablet = window.innerWidth <= 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStreaming = !screenView.classList.contains('hidden');

    if (isStreaming && isPortrait && isMobileOrTablet) {
      orientationWarning.classList.remove('hidden');
    } else {
      orientationWarning.classList.add('hidden');
    }
  }

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', () => {
    setTimeout(checkOrientation, 200);
  });

  // ================= 6. TO'LIQ EKRAN (FULLSCREEN TOGGLE) =================
  function toggleFullscreen(forceOpen = false) {
    const doc = document;
    const isFull = doc.fullscreenElement || doc.webkitFullscreenElement;

    if (forceOpen || !isFull) {
      if (doc.documentElement.requestFullscreen) {
        doc.documentElement.requestFullscreen().catch(() => {});
      } else if (doc.documentElement.webkitRequestFullscreen) {
        doc.documentElement.webkitRequestFullscreen();
      } else if (videoEl.webkitEnterFullscreen) {
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

  // Desktop: Ekranni 2 marta tez bosish
  videoEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleFullscreen();
  });

  // Mobile / Tablet: Ekranga 2 marta tez tegish (Double Tap)
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

  // ================= 7. CHIQIB KETISH (KIRISH QIYIN, CHIQISH OSON) =================
  function exitSession(reason = '') {
    authToken = null;
    prewarmStarted = false;

    if (videoEl) {
      try {
        if (typeof videoEl.ondisconnect === 'function') {
          videoEl.ondisconnect();
        }
        videoEl.src = '';
      } catch (e) {}
    }

    orientationWarning.classList.add('hidden');
    screenView.classList.add('hidden');
    countdownView.classList.add('hidden');
    loginView.classList.remove('hidden');

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (reason) {
      loginError.textContent = reason;
      loginError.classList.remove('hidden');
    }
  }

  // Tarmoq uzilishi bilan darhol chiqib ketish
  window.addEventListener('offline', () => {
    exitSession('Internet aloqasi uzildi');
  });

  // Sahifadan chiqilganda darhol chiqish
  window.addEventListener('pagehide', () => {
    exitSession();
  });

  // ================= 8. TELEGRAM DARAJASIDAGI WEBRTC STREAM =================
  function startStream() {
    if (prewarmStarted) return;
    prewarmStarted = true;

    if (!videoEl) return;

    try {
      const streamUrl = getStreamUrl();
      videoEl.mode = 'webrtc,mse';
      videoEl.src = streamUrl;

      const triggerPlay = () => {
        try {
          if (videoEl.video) {
            videoEl.video.muted = true;
            videoEl.video.playsInline = true;
            videoEl.video.play().catch(() => {});
          }
        } catch (e) {}
      };

      triggerPlay();
      window.addEventListener('click', triggerPlay, { once: true });
      window.addEventListener('touchstart', triggerPlay, { once: true });
    } catch (err) {
      exitSession('Video ulanish xatosi: ' + err.message);
    }
  }

  // ================= 9. 10 SONIYALIK TAYMER (2S QOLGANDA PRE-WARM) =================
  function startCountdown(seconds = 10) {
    loginView.classList.add('hidden');
    countdownView.classList.remove('hidden');
    screenView.classList.remove('hidden'); // Orqa fonda tayyorlab turish

    prewarmStarted = false;
    let remain = seconds;
    countdownNum.textContent = remain;
    progressBar.style.width = '100%';

    const timer = setInterval(() => {
      remain -= 1;

      // 2 soniya qolganda orqa fonda kamerani/videoni yoqib buferlash
      if (remain <= 2 && !prewarmStarted) {
        startStream();
      }

      if (remain <= 0) {
        clearInterval(timer);
        countdownView.classList.add('hidden');
        screenView.classList.remove('hidden');

        // Avtomatik to'liq ekran (fullscreen) va orientatsiya tekshiruvi
        toggleFullscreen(true);
        checkOrientation();
      } else {
        countdownNum.textContent = remain;
        progressBar.style.width = `${(remain / seconds) * 100}%`;
      }
    }, 1000);
  }

  // ================= 10. BLOK TAYMERI =================
  let blockCountdownTimer = null;
  function startBlockCountdown(totalSeconds) {
    if (blockCountdownTimer) clearInterval(blockCountdownTimer);
    let remain = Math.max(1, Math.round(totalSeconds));

    function updateBlockText() {
      const mins = Math.floor(remain / 60);
      const secs = remain % 60;
      let timeText = '';
      if (mins > 0) timeText += `${mins} daqiqa `;
      timeText += `${secs} soniya`;
      loginError.textContent = `Xavfsizlik bloki: Juda ko'p xato urinishlar. Ushbu IP ${timeText}ga bloklangan.`;
      loginError.classList.remove('hidden');
    }

    updateBlockText();
    blockCountdownTimer = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        clearInterval(blockCountdownTimer);
        blockCountdownTimer = null;
        loginError.classList.add('hidden');
      } else {
        updateBlockText();
      }
    }, 1000);
  }

  // ================= 11. LOGIN SUBMIT =================
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Tekshirilmoqda...';

    try {
      const res = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success) {
        if (blockCountdownTimer) {
          clearInterval(blockCountdownTimer);
          blockCountdownTimer = null;
        }
        authToken = data.token;
        passwordInput.value = '';
        startCountdown(data.countdown || 10);
      } else {
        if (data.retryAfterSeconds) {
          startBlockCountdown(data.retryAfterSeconds);
        } else {
          if (blockCountdownTimer) {
            clearInterval(blockCountdownTimer);
            blockCountdownTimer = null;
          }
          loginError.textContent = data.message || 'Login yoki parol noto‘g‘ri!';
          loginError.classList.remove('hidden');
        }
      }
    } catch (err) {
      loginError.textContent = 'Server bilan bog‘lanishda xatolik yuz berdi';
      loginError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirish';
    }
  });

  // Boshlash
  initConfig();
})();
