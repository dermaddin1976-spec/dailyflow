export default function InfoTip({ label = 'What does this mean?', children }) {
  return (
    <details className="info-tip">
      <summary>{label} <span className="chev">&#9662;</span></summary>
      <p className="info-body">{children}</p>
    </details>
  );
}
