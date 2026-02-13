# 🗳️ VoteSecure India

A secure online voting platform built with **Next.js**, **Prisma**, and **face-api.js** — featuring facial recognition-based voter verification and government ID authentication.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🪪 **Government ID Verification** | Validates Aadhaar-style document IDs against a seeded database |
| 🤖 **Face Recognition** | Real-time face detection & biometric matching using `face-api.js` |
| 🗳️ **Secure Voting** | One-person-one-vote enforcement with IP + user-level duplicate checks |
| 📊 **Admin Dashboard** | Live election stats, vote counts, candidate progress bars |
| 🔐 **Session Auth** | Cookie-based session management with bcrypt password hashing |
| 📱 **Responsive UI** | Neo-Brutalist design that works on mobile, tablet, and desktop |
| ♿ **Accessible** | ARIA labels, keyboard navigation, skip-to-content link |

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router + Turbopack)
- **Database:** PostgreSQL via [Prisma ORM](https://www.prisma.io/) (hosted on [Neon](https://neon.tech/))
- **Face Recognition:** [face-api.js](https://github.com/justadudewhohacks/face-api.js) (client-side)
- **Auth:** Custom JWT-like cookie sessions + [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- **Styling:** Vanilla CSS with Neo-Brutalist design system
- **Language:** TypeScript

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or a [Neon](https://neon.tech/) account)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd vidula
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

### 3. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed with 100+ test records
npx prisma db seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> ⚠️ **Camera access requires `localhost`** — do not use IP addresses (e.g., `192.168.x.x`), as browsers block `getUserMedia` on non-HTTPS origins.

---

## 🧪 Test Credentials

### Admin Login
| Email | Password |
|-------|----------|
| `admin@votesecure.in` | `admin123` |

### Sample Aadhaar IDs (for Registration)
| Name | Document ID |
|------|-------------|
| Arjun Sharma | `AADHAAR-1001-2001-3001` |

> 100+ additional IDs are generated randomly on each seed. Run `npx prisma db seed` to see printed sample IDs in terminal output.

---

## 📁 Project Structure

```
vidula/
├── prisma/
│   ├── schema.prisma          # Database schema (User, Election, Vote, etc.)
│   └── seed.ts                # Seeds 100+ government records + election data
├── public/
│   └── models/                # face-api.js model weights
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── login/page.tsx     # Login page
│   │   ├── register/page.tsx  # Multi-step registration with face scan
│   │   ├── vote/page.tsx      # Voting page with face verification
│   │   ├── admin/page.tsx     # Admin dashboard with election stats
│   │   ├── dashboard/page.tsx # User dashboard
│   │   ├── layout.tsx         # Root layout with Navbar + footer
│   │   ├── globals.css        # Full design system + responsive styles
│   │   └── api/
│   │       ├── auth/          # login, register, logout, session routes
│   │       ├── elections/     # Fetch active elections
│   │       ├── verify-face/   # Compare face descriptors
│   │       ├── verify-document/ # Check Aadhaar against gov records
│   │       ├── vote/          # Submit & validate votes
│   │       └── admin/stats/   # Admin stats (auth-protected)
│   ├── components/
│   │   ├── Navbar.tsx         # Responsive nav with mobile hamburger + logout
│   │   ├── StepIndicator.tsx  # Reusable multi-step progress indicator
│   │   └── LoadingSpinner.tsx # Configurable loading spinner
│   └── lib/
│       ├── auth.ts            # Session create/parse/clear + IP helpers
│       ├── prisma.ts          # Prisma client singleton
│       └── face-utils.ts      # useFaceDetection hook (camera + face-api.js)
└── package.json
```

---

## 🔒 Security

- Passwords hashed with **bcrypt** (10 rounds)
- Admin API protected — returns `401`/`403` for unauthorized access
- Face descriptors compared using **Euclidean distance** with configurable threshold
- IP-based duplicate vote prevention
- Session cookies with `HttpOnly` flag

---

## 📱 Responsive Design

The UI adapts across three breakpoints:

| Viewport | Behavior |
|----------|----------|
| **Desktop** (1200px+) | Full multi-column grids, large typography |
| **Tablet** (600–900px) | Reduced columns, scaled fonts |
| **Mobile** (< 600px) | Single column, hamburger nav, touch-friendly buttons |

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma db seed` | Seed database with test data |
| `npx prisma db push` | Push schema changes to database |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

This project is for educational/demo purposes only. Not intended for production elections.

---

<p align="center">Made with 🇮🇳 for India — <strong>VoteSecure</strong> © 2026</p>
