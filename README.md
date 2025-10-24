# 🌩️ NOSTR Wallet

> **One Identity, Two Protocols** - Your Nostr keys, now powering Bitcoin payments

A revolutionary Bitcoin wallet that unifies your digital identity. Use the same cryptographic keys for both Nostr social interactions and Bitcoin transactions.

## ✨ Why NOSTR Wallet?

Your Nostr identity already holds the keys to Bitcoin. Both protocols use the same secp256k1 cryptography with Schnorr signatures, making your Nostr public key compatible with Bitcoin Taproot addresses (P2TR).

**Simple concept**: One keypair, endless possibilities.

## 🚀 Features

| Feature | Description |
|---------|-------------|
| � **Unified Identity** | Login with any Nostr extension (Alby, nos2x, etc.) |
| � **Native Bitcoin** | Send, receive, and manage Bitcoin with your Nostr keys |
| � **Live Data** | Real-time balance and transaction updates |
| 🎨 **Beautiful UI** | Clean, responsive design with dark/light themes |
| � **Multi-Account** | Switch between multiple Nostr identities |

## 🛠️ Quick Start

```bash
# Clone and install
git clone <repo-url>
cd webapp
npm install

# Start developing
npm run dev
```

Visit `http://localhost:5173` and connect your Nostr extension to get started!

## 🔧 Commands

```bash
npm run dev      # Development server
npm run build    # Production build  
npm test         # Run test suite
npm run lint     # Code linting
```

## 🏗️ Built With

**Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui  
**Protocols**: Nostrify (Nostr), bitcoinjs-lib (Bitcoin)  
**State**: TanStack Query for data management

## ⚠️ Important Notice

> **🧪 Experimental Software**
> 
> Your Nostr private key controls real Bitcoin funds. Please:
> - Test with small amounts only
> - Keep secure backups of your keys  
> - Understand the risks before use

## 📄 License

MIT - Build amazing things!
