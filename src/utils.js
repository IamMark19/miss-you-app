// Small framework-agnostic helpers shared across components.

export function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.floor(day / 7)}w ago`;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function vibrateIfSupported(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // vibration is a nice-to-have, never worth breaking on
    }
  }
}

export function makeStars(count) {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 1.6 + 0.7,
    delay: Math.random() * 6,
    dur: 3 + Math.random() * 3,
  }));
}

// Centers-crops then downscales an image file to a small compressed JPEG data
// URL, so profile pictures stay tiny regardless of the original photo size.
export function compressImageToDataUrl(file, maxSize = 240, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
