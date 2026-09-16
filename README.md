# Mystic Hunt — Technical Treasure Hunt & CTF Platform

**Mystic Hunt** is a web-based **technical treasure hunt and CTF platform** built for college technical fests, cybersecurity events, and student competitions. It combines **physical treasure hunts, QR checkpoints, OSINT, cryptography, programming, cybersecurity challenges, and Capture The Flag (CTF)** into a single platform.

The platform allows organizers to create and manage technical treasure hunts where participants solve clues, find locations, scan QR codes, unlock challenges, and progress through the competition using an online leaderboard.

## What is Mystic Hunt?

Mystic Hunt combines a traditional **treasure hunt** with **technical and cybersecurity challenges**.

Instead of only searching for physical objects, participants solve digital challenges to progress through the hunt.

```text
Clue
  ↓
Find Location
  ↓
Find QR Checkpoint
  ↓
Scan QR
  ↓
Unlock Challenge
  ↓
Solve Challenge
  ↓
Continue Hunt
```

The platform can be adapted for **college fests, technical events, cybersecurity competitions, CTF events, and student clubs**.

## Two-Phase Competition

### Phase 1 — Technical Treasure Hunt

Participants follow clues that lead them to different locations around the event venue.

At each checkpoint, a QR code unlocks a digital challenge.

Challenge categories can include:

* OSINT
* Cryptography
* Ciphers
* Encoding & Decoding
* Programming
* Logic
* Cybersecurity
* Digital Forensics
* Beginner CTF challenges

### Phase 2 — CTF

The second phase focuses on Capture The Flag and more technical challenges.

Possible categories include:

* Web Security
* Cryptography
* OSINT
* Digital Forensics
* Reverse Engineering
* Programming
* Cybersecurity
* Miscellaneous CTF challenges

Teams are ranked according to their challenge scores, with completion time used as a tie-breaker.

## Platform Features

* **Team-based competition**
* **QR code checkpoints**
* **Digital clue system**
* **Technical challenge system**
* **OSINT and CTF challenges**
* **Real-time progress tracking**
* **Leaderboard**
* **Score-based ranking**
* **Multiple competition phases**
* **Challenge progression**
* **Admin-controlled event content**

## Technology Stack

| Technology   | Usage                         |
| ------------ | ----------------------------- |
| Next.js      | Web application               |
| React        | UI components                 |
| TypeScript   | Application development       |
| Tailwind CSS | Styling                       |
| Supabase     | Database and backend services |
| Vercel       | Deployment                    |

## Use Cases

Mystic Hunt can be used to organize:

* College technical treasure hunts
* Cybersecurity competitions
* CTF events
* Technical fest competitions
* Coding club events
* Cybersecurity club events
* OSINT competitions
* Interactive campus treasure hunts
* Student hackathon side events

## Getting Started

### Prerequisites

* Node.js
* npm

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd mystic-hunt
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not commit private credentials or `.env.local` to the repository.

## Project Structure

```text
mystic-hunt/
├── app/
├── components/
├── lib/
├── public/
├── styles/
├── .env.local
├── package.json
└── README.md
```

## Deployment

Mystic Hunt is built with Next.js and can be deployed using Vercel or any platform that supports Next.js applications.

## Contributing

Contributions are welcome.

You can contribute by:

* Adding new challenge types
* Improving the leaderboard
* Adding new authentication features
* Improving the admin panel
* Adding CTF challenge integrations
* Improving the UI/UX
* Fixing bugs

## Keywords

Technical Treasure Hunt · Online Treasure Hunt · CTF Platform · Capture The Flag · Cybersecurity Competition · College Treasure Hunt · QR Code Treasure Hunt · OSINT Challenge · Cryptography Challenge · Cybersecurity CTF · Technical Fest · College CTF · Programming Challenges · Digital Forensics

## License

Add your preferred license here.

---

**Mystic Hunt is an open platform for building interactive technical treasure hunts and CTF-style competitions.**
