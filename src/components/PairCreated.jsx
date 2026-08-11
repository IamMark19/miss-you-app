export default function PairCreated({ code, onContinue }) {
  return (
    <div className="mya-onboard">
      <p className="mya-eyebrow">Miss You</p>
      <h1 className="mya-h1">Your pair code</h1>
      <p className="mya-sub">
        Send this to them however you'd normally text — they'll enter it on their end.
      </p>
      <div className="mya-code-display">{code}</div>
      <button className="mya-btn-start" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
