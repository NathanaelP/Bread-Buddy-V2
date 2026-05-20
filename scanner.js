// Barcode scanner — uses BarcodeDetector (Android/Chrome) with Quagga2 fallback (iOS/Safari)

(function () {
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

  let overlay = null;
  let activeStream = null;
  let animFrame = null;
  let scanning = false;
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
    scanning = false;
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
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

  // ---- BarcodeDetector strategy (receives already-playing video) ----

  function runNativeDetector(video) {
    BarcodeDetector.getSupportedFormats().then(supported => {
      const formats = FORMATS.filter(f => supported.includes(f));
      if (!formats.length) {
        runQuaggaDecoder(video);
        return;
      }
      const detector = new BarcodeDetector({ formats });
      setStatus('Point camera at barcode…');

      const scan = async () => {
        if (!scanning) return;
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
    }).catch(() => runQuaggaDecoder(video));
  }

  // ---- Quagga2 frame-by-frame strategy (receives already-playing video) ----
  // Quagga.decodeSingle processes canvas frames — no camera management needed.
  // This avoids iOS's restriction that video.play() must be in user-gesture scope.

  function runQuaggaDecoder(video) {
    if (typeof Quagga === 'undefined') {
      closeScanner();
      alert('Barcode scanning is not supported on this browser. Please type the barcode manually.');
      return;
    }

    const canvas = document.getElementById('scanCanvas');
    const ctx = canvas.getContext('2d');
    setStatus('Point camera at barcode…');

    function tick() {
      if (!scanning) return;
      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        animFrame = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      Quagga.decodeSingle({
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
        src: canvas.toDataURL('image/jpeg', 0.8),
      }, (result) => {
        if (result && result.codeResult && result.codeResult.code) {
          onScanResult(result.codeResult.code);
        } else if (scanning) {
          animFrame = requestAnimationFrame(tick);
        }
      });
    }

    animFrame = requestAnimationFrame(tick);
  }

  // ---- Public API ----

  window.openScanner = async function (onResult, onCancel) {
    resultCallback = onResult || null;
    cancelCallback = onCancel || null;

    showOverlay();
    setStatus('Starting camera…');

    // Always get stream ourselves so video.play() runs within user-gesture scope.
    // This is required by iOS Safari — if Quagga owns camera setup, the async
    // chain breaks the gesture requirement and the video stays black.
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } catch (err) {
      closeScanner();
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera permission and try again.'
        : 'Could not access camera: ' + err.message;
      alert(msg);
      return;
    }

    activeStream = stream;
    scanning = true;

    const video = document.getElementById('scanVideo');
    video.srcObject = stream;
    try { await video.play(); } catch (_) {}

    setStatus('Point camera at barcode…');

    if (typeof BarcodeDetector !== 'undefined') {
      runNativeDetector(video);
    } else {
      runQuaggaDecoder(video);
    }
  };
})();
