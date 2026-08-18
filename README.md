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
- 🔄 **Instant Auto-Sync**: When a guest device joins a room, the host device automatically packages the entire IndexedDB history and syncs it to the guest in milliseconds.
- 🎨 **Sleek "Cyber-Tech" UI**: A dark-mode, matrix-green hacker aesthetic combined with the familiar, user-friendly layout of modern chat apps (like WhatsApp).
- 📎 **Unrestricted File Sharing**: Send PDFs, images, and documents securely without arbitrary cloud-provider file size limits. 

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
   git clone https://github.com/yourusername/NexusDrop.git
   ```
2. **Run Locally:**
   Simply double-click `index.html` to open it in your browser.
3. **Host a Room:**
   - Click **Initialize Server** on Device A. 
   - Note the generated 4-digit PIN.
4. **Join a Room:**
   - Open the app on Device B.
   - Enter the 4-digit PIN and click **Connect**.
   - Watch the UI instantly sync your chat history!

> **Note on Persistence**: To access files from Device B at a later date, Device A (the Host) must have the NexusDrop tab open to facilitate the P2P WebRTC handshake.

---

## 🎯 Why This Project Matters

For recruiters and developers looking at this repository, **NexusDrop** demonstrates a deep understanding of modern web capabilities:
- **Problem Solving**: Identifying a real-world friction point and engineering a lightweight, targeted solution.
- **Advanced Browser APIs**: Moving beyond basic DOM manipulation to utilize WebRTC, File Readers, `ArrayBuffers`, and asynchronous IndexedDB storage.
- **Architectural Constraints**: Successfully designing a stateful application within a stateless, serverless environment.

---
*Built with passion, necessity, and vanilla JavaScript.* 👨‍💻
