# Mystic Hunt

Mystic Hunt is a web-based technical treasure hunt platform that combines physical clue-based exploration with digital challenges.

The platform is designed for college technical events and supports multiple types of challenges, including OSINT, cryptography, cybersecurity, programming, logic, and CTF challenges.

## Overview

Mystic Hunt has two phases:

### Phase 1 — Treasure Hunt

Teams receive clues through the platform and use them to find physical locations around the event venue.

At each location, participants find and scan a QR code that unlocks the next digital challenge.

**Flow:**

```text
Clue → Find Location → Scan QR → Unlock Challenge → Solve → Next Clue
```

Challenges can include:

* OSINT
* Ciphers and cryptography
* Encoding and decoding
* Programming
* Logic puzzles
* Cybersecurity
* Beginner CTF challenges

### Phase 2 — CTF

Qualified teams move to a dedicated CTF-style round.

This phase focuses more heavily on technical challenges such as:

* Web security
* Cryptography
* OSINT
* Digital forensics
* Programming
* Reverse engineering
* General cybersecurity

Teams are ranked using their scores, with completion time used as a tie-breaker.

## Features

* Team-based gameplay
* QR-based checkpoints
* Digital challenge system
* Multiple challenge categories
* Progress tracking
* Leaderboard
* Score-based ranking
* Separate rounds and qualification stages
* Admin-controlled challenges
* Online platform for managing the event

## Tech Stack

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Supabase**
* **Vercel**

## Getting Started

### Prerequisites

Make sure you have Node.js and npm installed.

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

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Add any other environment variables required by the project.

Do not commit `.env.local` or private credentials to the repository.

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

## Development

The main application is located in the `app/` directory.

Changes made during development are automatically reflected when running the Next.js development server.

## Deployment

The project can be deployed using Vercel or another platform that supports Next.js.

## Purpose

Mystic Hunt was built to provide a platform for conducting technical treasure hunts and CTF-style competitions in college events.

It can be adapted for different event formats, challenge sets, venues, and scoring systems.
