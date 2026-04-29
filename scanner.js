// Barcode scanner — uses BarcodeDetector (Android/Chrome) with Quagga2 fallback (iOS/Safari)

(function () {
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

  let overlay = null;
  let activeStream = null;
  let animFrame = null;
  let quaggaRunning = false;
  let resultCallback = null;
  let cancelCallback = null;

  // ---- Overlay DOM ----

  function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'scanOverlay';
    overlay.innerHTML = `
      <video id="scanVideo" playsinline muted autoplay></video>
      <canvas id="scanCanvas" style="display:none"></canvas>
      <div class="scanFrame"></div>
      <p id="scanStatus">Point camera at barcode…</p>
      <button id="scanCancel" class="btn" type="button">Cancel</button>
    `;
    document.body.appendChild(overlay);
    document.getElementById('scanCancel').addEventListener('click', closeScanner);
  }

  function showOverlay() {
    buildOverlay();
    overlay.style.display = 'flex';
  }

  function setStatus(msg) {
    const el = document.getElementById('scanStatus');
    if (el) el.textContent = msg;
  }

  // ---- Cleanup ----

  function stopStream() {
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    if (quaggaRunning) {
      try { Quagga.stop(); } catch (_) {}
      quaggaRunning = false;
    }
    const video = document.getElementById('scanVideo');
    if (video) video.srcObject = null;
  }

  function closeScanner() {
    stopStream();
    if (overlay) overlay.style.display = 'none';
    const cb = cancelCallback;
    resultCallback = null;
    cancelCallback = null;
    if (cb) cb();
  }

  function onScanResult(value) {
    stopStream();
    if (overlay) overlay.style.display = 'none';
    const cb = resultCallback;
    resultCallback = null;
    cancelCallback = null;
    if (cb) cb(value);
  }

  // ---- BarcodeDetector strategy ----

  async function runNativeDetector(stream) {
    const video = document.getElementById('scanVideo');
    video.srcObject = stream;
    await video.play();

    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = FORMATS.filter(f => supported.includes(f));
    if (!formats.length) throw new Error('no supported formats');

    const detector = new BarcodeDetector({ formats });
    setStatus('Point camera at barcode…');

    const scan = async () => {
      if (!resultCallback) return;
      try {
        const results = await detector.detect(video);
        if (results.length > 0) {
          onScanResult(results[0].rawValue);
          return;
        }
      } catch (_) {}
      animFrame = requestAnimationFrame(scan);
    };
    animFrame = requestAnimationFrame(scan);
  }

  // ---- Quagga2 strategy ----

  function runQuagga(stream) {
    const video = document.getElementById('scanVideo');
    video.srcObject = stream;
    video.play();

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: video,
        constraints: { facingMode: 'environment' },
      },
      decoder: {
        readers: [
          'ean_reader',
          'ean_8_reader',
          'upc_reader',
          'upc_e_reader',
          'code_128_reader',
          'code_39_reader',
        ],
      },
      locate: true,
    }, (err) => {
      if (err) {
        setStatus('Scanner error. Try typing the barcode.');
        console.error('Quagga init error:', err);
        return;
      }
      quaggaRunning = true;
      setStatus('Point camera at barcode…');
      Quagga.start();
    });

    Quagga.onDetected((data) => {
      const code = data && data.codeResult && data.codeResult.code;
      if (code) onScanResult(code);
    });
  }

  // ---- Public API ----

  window.openScanner = async function (onResult, onCancel) {
    resultCallback = onResult || null;
    cancelCallback = onCancel || null;

    showOverlay();
    setStatus('Starting camera…');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      activeStream = stream;
    } catch (err) {
      closeScanner();
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera permission and try again.'
        : 'Could not access camera: ' + err.message;
      alert(msg);
      return;
    }

    // Try native BarcodeDetector first
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        await runNativeDetector(stream);
        return;
      } catch (_) {
        // fall through to Quagga2
      }
    }

    // Quagga2 fallback
    if (typeof Quagga !== 'undefined') {
      runQuagga(stream);
    } else {
      closeScanner();
      alert('Barcode scanning is not supported on this browser. Please type the barcode manually.');
    }
  };
})();
