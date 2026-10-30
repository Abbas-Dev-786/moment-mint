import { useState } from "react"


type View = "connect" | "dashboard" | "settings"

const views: Array<{ id: View; label: string }> = [
  { id: "connect", label: "Connect" },
  { id: "dashboard", label: "Dashboard" },
  { id: "settings", label: "Settings" },
]

function App() {
  const [view, setView] = useState<View>("connect")

  return (
    <div className="momentmint-app">
      <header className="momentmint-header">
        <a className="brand" href="/" aria-label="MomentMint home">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>MomentMint</strong>
            <small>community-powered highlights</small>
          </span>
        </a>

        <nav aria-label="Primary navigation">
          {views.map((item) => (
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="momentmint-main">
        {view === "connect" && <ConnectView onContinue={() => setView("dashboard")} />}
        {view === "dashboard" && <DashboardView />}
        {view === "settings" && <SettingsView />}
      </main>

      <footer className="momentmint-footer">
        <span>Phase 0 foundation</span>
        <span>Creator-controlled workflow</span>
      </footer>
    </div>
  )
}

function ConnectView({ onContinue }: { onContinue: () => void }) {
  return (
    <section aria-labelledby="connect-title" className="hero-panel">
      <div className="eyebrow">Your community sees it first</div>
      <h1 id="connect-title">Turn chat reactions into your next highlight.</h1>
      <p className="hero-copy">
        MomentMint groups independent <code>!moment</code> nominations into a
        focused inbox, then helps you prepare a Twitch clip for review.
      </p>
      <div className="hero-actions">
        <button className="primary-button" onClick={onContinue} type="button">
          Preview creator dashboard
        </button>
        <span className="action-note">Twitch connection arrives in Phase 2.</span>
      </div>
      <div className="principles" aria-label="Product principles">
        <Principle title="Community signal" text="Distinct viewers count once." />
        <Principle title="Creator control" text="Nothing is shared automatically." />
        <Principle title="Truthful status" text="Clips are verified before ready." />
      </div>
    </section>
  )
}

function DashboardView() {
  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Creator workspace</div>
          <h1 id="dashboard-title">Highlight inbox</h1>
        </div>
        <span className="status-pill neutral">Preview data</span>
      </div>
      <div className="metric-grid">
        <Metric label="Connection" value="Not connected" />
        <Metric label="Live session" value="Waiting" />
        <Metric label="Nominations" value="0" />
        <Metric label="Clip candidates" value="0" />
      </div>
      <div className="empty-panel">
        <span className="empty-icon" aria-hidden="true">
          ✦
        </span>
        <h2>No moments yet</h2>
        <p>
          Once Twitch is connected, viewers can type <code>!moment</code> in chat.
          Nearby nominations will appear here as one candidate.
        </p>
      </div>
    </section>
  )
}

function SettingsView() {
  return (
    <section aria-labelledby="settings-title" className="settings-panel">
      <div className="eyebrow">Workspace controls</div>
      <h1 id="settings-title">Settings</h1>
      <p>These defaults will become editable when the Twitch connection is implemented.</p>
      <dl className="settings-list">
        <Setting label="Nomination command" value="!moment" />
        <Setting label="Distinct viewers to qualify" value="2 viewers" />
        <Setting label="Grouping window" value="30 seconds" />
        <Setting label="Automatic clip creation" value="Off by default" />
      </dl>
    </section>
  )
}

function Principle({ title, text }: { title: string; text: string }) {
  return (
    <div className="principle">
      <span className="principle-dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default App
