import "./App.css";

const foundations = ["React + TypeScript", "Tauri 2 + Rust", "Local-first architecture"];

function App() {
  return (
    <main className="app-shell">
      <header className="titlebar">
        <span className="brand-mark" aria-hidden="true">
          D
        </span>
        <strong>DevBox</strong>
        <span className="milestone">M0 · Engineering baseline</span>
      </header>

      <section className="workspace" aria-labelledby="workspace-title">
        <p className="eyebrow">LOCAL-FIRST DEVELOPER TOOLBOX</p>
        <h1 id="workspace-title">The foundation is ready.</h1>
        <p className="summary">
          This bootstrap screen confirms the React workspace is running. Product features begin in
          the next milestone.
        </p>

        <ul className="foundation-list" aria-label="Configured foundations">
          {foundations.map((foundation) => (
            <li key={foundation}>
              <span aria-hidden="true">✓</span>
              {foundation}
            </li>
          ))}
        </ul>
      </section>

      <footer className="statusbar">
        <span className="status-dot" aria-hidden="true" />
        <span>Ready</span>
        <span className="status-spacer" />
        <span>v0.1.0</span>
      </footer>
    </main>
  );
}

export default App;
