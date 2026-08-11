import { useMemo } from "react";
import { makeStars } from "../utils.js";

export default function Stars({ count = 24 }) {
  const stars = useMemo(() => makeStars(count), [count]);
  return (
    <div className="mya-stars">
      {stars.map((s) => (
        <span
          key={s.id}
          className="mya-star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
