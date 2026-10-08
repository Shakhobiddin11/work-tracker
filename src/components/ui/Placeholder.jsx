export default function Placeholder({ title, description, children }) {
  return <section aria-labelledby="section-heading">
    <p className="eyebrow">Your workspace</p>
    <h1 id="section-heading">{title}</h1>
    <p className="description">{description}</p>
    <div className="empty-state"><span className="empty-mark" aria-hidden="true">+</span>
      <h2>A fresh start</h2><p>{children}</p><span className="badge">Coming soon</span>
    </div>
  </section>
}
