<div align="center">
  
# 🌌 NexusDrop 
### *The Serverless P2P Enclave*

[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()
[![WebRTC](https://img.shields.io/badge/WebRTC-PeerJS-333333?style=for-the-badge&logo=webrtc)]()
[![IndexedDB](https://img.shields.io/badge/Database-IndexedDB-005571?style=for-the-badge)]()
[![Static Hosting](https://img.shields.io/badge/Hosted_On-GitHub_Pages-181717?style=for-the-badge&logo=github)]()

*A sleek, zero-backend, encrypted peer-to-peer chat and file-sharing ecosystem.*

</div>

---

## 📖 The Story Behind NexusDrop

It all started with an old Android device. 📱

I had a secondary, older mobile phone sitting in my drawer. It was a treasure trove of past memories—old pictures, critical PDF documents, and legacy notes. The problem? It didn't have a SIM card, it wasn't logged into WhatsApp, and it lacked any modern cloud-sharing applications. 

Every time I needed to extract a file or a note from that device to my current PC or main phone, it was a frustrating bottleneck. I didn't want to go through the hassle of downloading heavy third-party apps, creating new accounts, or wiring it up via USB just to share a simple image. 

I asked myself: **"Why can't I just open a webpage, generate a 4-digit PIN, and instantly bridge my devices together?"**

I wanted a solution that was:
1. **Serverless & Free**: No expensive cloud databases or backend servers to maintain.
2. **Persistent**: The old device could act as its own "host server" saving data locally.
3. **Frictionless**: Accessible from any browser in the world via a simple PIN.

That necessity birthed **NexusDrop**—a fully functional, WhatsApp-style chat and file-sharing enclave that runs entirely in the browser using WebRTC and IndexedDB.

---

## 🚀 What is NexusDrop?

**NexusDrop** is a static web application that turns your browser into a localized server node. It allows two devices to connect directly to each other via WebRTC to exchange text messages, images, and heavy files in real-time. 

Because it requires absolutely **zero backend infrastructure**, it can be hosted indefinitely for free on GitHub Pages. Your data never touches a centralized database; it routes directly from Device A to Device B.

---

## ✨ Features

- 🟢 **Zero-Server Architecture**: Pure Peer-to-Peer (P2P) communication powered by `PeerJS` and WebRTC.
- 💾 **"Device-as-a-Server" Persistence**: Uses `localforage` (IndexedDB) to permanently store chat history and files locally on the hosting device. If you close the app and return days later, your data is exactly where you left it.
- 📱 **WhatsApp-Style Threading**: Native chat experience including **Swipe-to-Reply** on mobile (or double-click on PC), quoted message blocks, and click-to-scroll navigation.
- 🔐 **Custom Secure Enclaves**: Ditch random IDs. You can create multiple secure rooms, choose your own Room Names, and set your own Custom 4-Digit PINs.
- 🗂️ **Persistent Sidebar**: Seamlessly switch between multiple ongoing rooms using the slide-out sidebar, just like a native messaging app.
- ⚡ **Frictionless Sharing**: One-click "Share Link" generates a magic URL (`?pin=XXXX`) that automatically connects and joins guests without them needing to type a password.
- 📝 **Local Scratchpad**: App opens instantly into an offline note-taking mode. Type notes or drop files immediately, and optionally secure/host them later without losing history.
- 📥 **Native "Save to Device"**: Bypass the browser viewer; files download directly to your Android, tablet, or iOS filesystem via native HTML5 download handling.
---

## 🛠️ Under the Hood (For the Tech-Savvy)

Building NexusDrop required solving the classic "Static Site Data" problem. How do you persist data across devices without a database?

1. **WebRTC Data Channels**: Instead of relying on WebSockets through a Node.js backend, NexusDrop establishes a direct RTC connection between peers. This ensures minimal latency and maximum privacy.
2. **IndexedDB for Blob Storage**: Chat apps require handling large files. `localStorage` is capped at 5MB and only supports strings. NexusDrop utilizes `localforage` to asynchronously stream and store heavy binary `Blob` and `ArrayBuffer` objects directly into the browser's IndexedDB.
3. **Master-Slave Sync Protocol**: 
   - The device that creates the room acts as the **Master Node**. It saves all arrays to its local disk.
   - When a **Client Node** connects via the 4-digit PIN, a handshake occurs. The Master Node queries its IndexedDB and transmits the entire historical state over the WebRTC data channel, bootstrapping the Client Node to the present state.

---

## 💻 Usage Instructions

Since NexusDrop is purely static, you can run it right now without installing a single package.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vijaytheegala/NexusDrop.git
   ```
2. **Run Locally or via GitHub Pages:**
   Simply double-click `index.html` to open it in your browser, or host it on GitHub Pages for global access.
3. **The Local Scratchpad:**
   - The app instantly opens to a functional chat interface. Drop files and type notes immediately. Everything is saved to your local browser.
4. **Host a Secure Room:**
   - Click the warning banner at the top to secure your scratchpad.
   - Enter a **Room Name** and choose a **Custom 4-digit PIN**.
   - Your local scratchpad history automatically migrates to the secure room!
5. **Join a Room:**
   - On Device B, open the sidebar and click **Join Room**.
   - Enter the custom PIN.
   - Watch the UI instantly sync your chat history! (Or, just click a "Shared Link" from the host to bypass typing the PIN entirely).

> **Note on Persistence**: To access files from Device B at a later date, Device A (the Host) must have the NexusDrop tab open to facilitate the P2P WebRTC handshake. Your joined rooms will automatically save to your Sidebar for easy switching.

---

## 🎯 Why This Project Matters

For recruiters and developers looking at this repository, **NexusDrop** demonstrates a deep understanding of modern web capabilities:
- **Problem Solving**: Identifying a real-world friction point and engineering a lightweight, targeted solution.
- **Advanced Browser APIs**: Moving beyond basic DOM manipulation to utilize WebRTC, File Readers, `ArrayBuffers`, and asynchronous IndexedDB storage.
- **Architectural Constraints**: Successfully designing a stateful application within a stateless, serverless environment.

---
*Built with passion, necessity, and vanilla JavaScript.* 👨‍💻
