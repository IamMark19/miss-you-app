export default function Welcome({ onCreate, onJoin, error }) {
  return (
    <div className="mya-onboard">
      <p className="mya-eyebrow">Miss You</p>
      <p className="mya-script">the same sky, different windows</p>
      <h1 className="mya-h1">Start with your person</h1>
      <button className="mya-btn-start" onClick={onCreate}>
        Create a pair
      </button>
      <button className="mya-btn-ghost" onClick={onJoin}>
        I have a code
      </button>
      {error && <p className="mya-error">{error}</p>}
    </div>
  );
}
