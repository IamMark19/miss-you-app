export default function NotifyBanner({ type, onEnable, onShowIos, onDismiss }) {
  if (type === "ios") {
    return (
      <div className="mya-banner">
        <span>Add to Home Screen to enable notifications.</span>
        <button onClick={onShowIos}>How</button>
      </div>
    );
  }
  if (type === "enable") {
    return (
      <div className="mya-banner">
        <span>Notifications are off.</span>
        <button onClick={onEnable}>Enable</button>
        <button className="mya-banner-dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    );
  }
  return null;
}
