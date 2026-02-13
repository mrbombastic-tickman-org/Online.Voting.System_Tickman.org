import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <div className="container">
        {/* Hero Section */}
        <section className="hero-section" aria-labelledby="hero-heading">
          <div className="badge badge-warning hero-badge">
            Version 2.0 • Now with Face Recognition
          </div>

          <h1 id="hero-heading" className="page-title hero-title">
            YOUR VOTE<br />
            <span className="hero-title-highlight">
              YOUR POWER
            </span>
          </h1>

          <p className="hero-description">
            The most secure voting platform in India. Verified by government ID and strict biometric authentication.
          </p>

          <div className="hero-ctas">
            <Link href="/register" className="btn btn-primary btn-lg">
              Start Registration
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Login to Vote
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="grid-4 stats-showcase" aria-label="Platform statistics">
          <div className="card stat-highlight" style={{ background: '#ffecd1' }}>
            <div className="stat-highlight-value">100%</div>
            <div className="stat-highlight-label">Verified IDs</div>
          </div>
          <div className="card stat-highlight" style={{ background: '#d1f7c4' }}>
            <div className="stat-highlight-value">AI</div>
            <div className="stat-highlight-label">Face Recognition</div>
          </div>
          <div className="card stat-highlight" style={{ background: '#e0c3fc' }}>
            <div className="stat-highlight-value">1:1</div>
            <div className="stat-highlight-label">Device Lock</div>
          </div>
          <div className="card stat-highlight" style={{ background: '#ffd6ef' }}>
            <div className="stat-highlight-value">IP</div>
            <div className="stat-highlight-label">Geo-Tracking</div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="how-it-works">
          <div className="text-center mb-40">
            <h2 id="how-it-works" className="section-title">
              How It Works
            </h2>
          </div>

          <div className="grid-3 mb-40">
            <div className="card feature-card">
              <div className="feature-number" aria-hidden="true">1</div>
              <h3>Verify Identity</h3>
              <p>Enter your Aadhaar-style document ID. We check it against the government database instantly.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-number" aria-hidden="true">2</div>
              <h3>Face Scan</h3>
              <p>Use your webcam to verify your identity. Our AI ensures that you are who you say you are.</p>
            </div>
            <div className="card feature-card">
              <div className="feature-number" aria-hidden="true">3</div>
              <h3>Cast Vote</h3>
              <p>Select your candidate and confirm. Your vote is encrypted and stored securely.</p>
            </div>
          </div>
        </section>


      </div>
    </>
  );
}
