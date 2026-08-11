export default function Avatar({ name, url, size }) {
  if (url) {
    return (
      <img
        className="mya-avatar"
        style={{ width: size, height: size }}
        src={url}
        alt={name || ""}
      />
    );
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="mya-avatar mya-avatar--placeholder"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}
