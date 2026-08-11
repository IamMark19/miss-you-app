export default function NotifyPrompt({ isIos, onEnable, onDismiss }) {
  return (
    <div className="mya-onboard">
      <div className="mya-bell">{isIos ? "🏠" : "🔔"}</div>
      <h1 className="mya-h1">{isIos ? "One more step" : "Get a nudge when they miss you"}</h1>
      {isIos ? (
        <>
          <div className="mya-ios-steps">
            On iPhone, notifications only work once this is added to your Home Screen.
            <br />
            <br />
            1. Tap the <b>Share</b> icon in Safari
            <br />
            2. Choose <b>Add to Home Screen</b>
            <br />
            3. Open <b>Miss You</b> from your Home Screen icon
          </div>
          <button className="mya-btn-primary" onClick={onDismiss}>
            Got it
          </button>
        </>
      ) : (
        <>
          <p className="mya-sub">
            Turn on notifications so a signal or message reaches you even when the app is closed.
          </p>
          <button className="mya-btn-primary" onClick={onEnable}>
            Enable notifications
          </button>
          <button className="mya-btn-ghost" onClick={onDismiss}>
            Not now
          </button>
        </>
      )}
    </div>
  );
}
