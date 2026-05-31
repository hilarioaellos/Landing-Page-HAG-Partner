export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow eyebrow-section">
      <span className="eyebrow-bar" />
      {children}
    </div>
  );
}
