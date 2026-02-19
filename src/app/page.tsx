import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <div className="container">

        {/* ============================================
            HERO — Split Screen Layout
            Left: text content  |  Right: visual element
            ============================================ */}
        <section className="split-hero" aria-labelledby="hero-heading">
          <div className="split-hero-content">
            <div className="badge badge-warning hero-badge">
              Election Commission of India • Authorized Digital Platform
            </div>
            <h1 id="hero-heading" className="hero-title" style={{ textAlign: 'left' }}>
              Secure Digital<br />
              <span className="hero-title-highlight">Voting Portal</span>
            </h1>
            <p className="hero-description" style={{ textAlign: 'left', margin: '0 0 36px' }}>
              India&apos;s trusted online voting platform with Aadhaar-linked identity verification,
              AI-powered biometric authentication, and end-to-end encrypted ballot casting.
            </p>
            <div className="hero-ctas" style={{ justifyContent: 'flex-start' }}>
              <Link href="/register" className="btn btn-primary btn-lg">
                Register as Voter
              </Link>
              <Link href="/login" className="btn btn-secondary btn-lg">
                Login to Vote
              </Link>
            </div>
          </div>

          <div className="split-hero-visual">
            <div className="hero-glass-stack">
              <div className="hero-glass-card hero-glass-1">
                <span className="hero-glass-icon">🛡️</span>
                <div>
                  <strong>End-to-End Encrypted</strong>
                  <p>AES-256 bit protection</p>
                </div>
              </div>
              <div className="hero-glass-card hero-glass-2">
                <span className="hero-glass-icon">👤</span>
                <div>
                  <strong>Biometric Verified</strong>
                  <p>AI-powered Face Scan</p>
                </div>
              </div>
              <div className="hero-glass-card hero-glass-3">
                <span className="hero-glass-icon">🗳️</span>
                <div>
                  <strong>Tamper-Proof Ballot</strong>
                  <p>Immutable audit trail</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            STATS — Card/Block Layout
            ============================================ */}
        <section className="grid-4 stats-showcase" aria-label="Platform trust metrics">
          <div className="card stat-highlight">
            <div className="stat-highlight-value">256-bit</div>
            <div className="stat-highlight-label">AES Encryption</div>
          </div>
          <div className="card stat-highlight">
            <div className="stat-highlight-value">Aadhaar</div>
            <div className="stat-highlight-label">ID Verification</div>
          </div>
          <div className="card stat-highlight">
            <div className="stat-highlight-value">Face++</div>
            <div className="stat-highlight-label">Biometric Auth</div>
          </div>
          <div className="card stat-highlight">
            <div className="stat-highlight-value">99.9%</div>
            <div className="stat-highlight-label">Uptime SLA</div>
          </div>
        </section>

        {/* ============================================
            HOW IT WORKS — Z-Shape / Zig-Zag Layout
            Alternating text-left/image-right then flipped
            ============================================ */}
        <section aria-labelledby="how-it-works" className="zigzag-section">
          <div className="text-center mb-40">
            <h2 id="how-it-works" className="section-title">How Voting Works</h2>
          </div>

          {/* Step 1 — Text Left, Visual Right */}
          <div className="zigzag-row">
            <div className="zigzag-text">
              <span className="zigzag-step-num">01</span>
              <h3>Aadhaar Verification</h3>
              <p>Enter your 12-digit Aadhaar number. We verify your identity in real-time against the UIDAI government database. Your details are fetched, confirmed, and linked to your voter profile instantly.</p>
            </div>
            <div className="zigzag-visual">
              <div className="card zigzag-card">
                <div className="zigzag-card-icon">🪪</div>
                <div className="zigzag-card-label">UIDAI Database</div>
                <div className="zigzag-progress">
                  <div className="zigzag-progress-bar" style={{ width: '100%' }} />
                </div>
                <div className="zigzag-card-status">✅ Identity Confirmed</div>
              </div>
            </div>
          </div>

          {/* Step 2 — Visual Left, Text Right (reversed) */}
          <div className="zigzag-row zigzag-reverse">
            <div className="zigzag-text">
              <span className="zigzag-step-num">02</span>
              <h3>Biometric Authentication</h3>
              <p>Complete a live face scan or fingerprint check using your device. Our AI compares your biometrics against your registered data to prevent impersonation and ensure it&apos;s really you.</p>
            </div>
            <div className="zigzag-visual">
              <div className="card zigzag-card">
                <div className="zigzag-card-icon">📸</div>
                <div className="zigzag-card-label">Face Scan</div>
                <div className="zigzag-scan-lines">
                  <div className="zigzag-scan-line" />
                  <div className="zigzag-scan-line" />
                  <div className="zigzag-scan-line" />
                </div>
                <div className="zigzag-card-status">🔍 Matching 98.7%</div>
              </div>
            </div>
          </div>

          {/* Step 3 — Text Left, Visual Right */}
          <div className="zigzag-row">
            <div className="zigzag-text">
              <span className="zigzag-step-num">03</span>
              <h3>Cast Your Ballot</h3>
              <p>Review all candidates, select your choice, and confirm with one click. Your vote is encrypted with AES-256 and recorded on a tamper-proof ledger. No one — not even administrators — can see your choice.</p>
            </div>
            <div className="zigzag-visual">
              <div className="card zigzag-card">
                <div className="zigzag-card-icon">🗳️</div>
                <div className="zigzag-card-label">Encrypted Ballot</div>
                <div className="zigzag-lock-row">
                  <span>🔒</span> <span>🔒</span> <span>🔒</span>
                </div>
                <div className="zigzag-card-status">✅ Vote Sealed</div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            SECURITY — Asymmetrical / Featured Layout
            Big card on left, two smaller on right
            ============================================ */}
        <section aria-labelledby="security-heading" className="mb-40">
          <div className="text-center mb-40">
            <h2 id="security-heading" className="section-title">Security &amp; Integrity</h2>
          </div>

          <div className="asymmetric-grid">
            <div className="card asymmetric-featured">
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔐</div>
              <h3>End-to-End Encryption</h3>
              <p>Every ballot is encrypted with AES-256 from the moment you cast it until final tallying. No intermediary — not servers, not admins, not even us — can read your vote. The decryption key is split across multiple election commissioners.</p>
              <div className="asymmetric-badge">Military-Grade Security</div>
            </div>

            <div className="asymmetric-side">
              <div className="card">
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>🛡️</div>
                <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>One Voter, One Vote</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Device fingerprinting, IP tracking, and biometric checks ensure no voter can cast more than one ballot per election.
                </p>
              </div>
              <div className="card">
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
                <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Audit Trail</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Every action is logged with timestamps. Election results are verifiable by authorized auditors without revealing individual votes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            ELIGIBILITY — Split Screen Layout
            ============================================ */}
        <section aria-labelledby="eligibility-heading" className="mb-40">
          <div className="text-center mb-40">
            <h2 id="eligibility-heading" className="section-title">Who Can Vote</h2>
          </div>

          <div className="split-cards">
            <div className="card split-card-left">
              <div className="split-card-header">
                <span style={{ fontSize: '1.8rem' }}>✅</span>
                <h3>Requirements</h3>
              </div>
              <ul className="check-list">
                <li>Indian citizen aged 18 or above</li>
                <li>Valid Aadhaar card linked to mobile</li>
                <li>Device with camera or fingerprint sensor</li>
                <li>Active internet connection</li>
              </ul>
            </div>
            <div className="card split-card-right">
              <div className="split-card-header">
                <span style={{ fontSize: '1.8rem' }}>📎</span>
                <h3>Documents Needed</h3>
              </div>
              <ul className="check-list">
                <li>12-digit Aadhaar number</li>
                <li>Registered email address</li>
                <li>Face photo (taken live during registration)</li>
                <li>Strong password (min. 6 characters)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================
            CTA Banner — Full Width Featured
            ============================================ */}
        <section className="cta-banner mb-40">
          <div className="card cta-banner-card">
            <h2>Ready to Make Your Voice Count?</h2>
            <p>Register in under 2 minutes with your Aadhaar. Verification is instant.</p>
            <div className="hero-ctas" style={{ marginTop: 24 }}>
              <Link href="/register" className="btn btn-primary btn-lg">
                Get Started Now
              </Link>
              <Link href="/login" className="btn btn-secondary btn-lg">
                Already Registered? Login
              </Link>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
