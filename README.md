# ⚡ RipNexus — Personal Desktop Media Vault
### *Ultra-Fast, Private & 100% Ad-Free Media Downloader for Windows, Mac & Linux*

[![License: MIT](https://img.shields.io/badge/License-MIT-00f2fe.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)]()
[![FFmpeg Accelerated](https://img.shields.io/badge/Engine-FFmpeg%20%2B%20yt--dlp-green.svg)]()
[![100% Private](https://img.shields.io/badge/Privacy-100%25%20Local-success.svg)]()
[![Zero Ads](https://img.shields.io/badge/Ads-0%25%20Zero-orange.svg)]()

> **No Shady Websites. No Popups. No Cloud Subscription Fees.**  
> **RipNexus** is your personal, local desktop media station built to rip high-resolution 4K/1080p video streams, Instagram Reels, Twitter media, and 320kbps MP3 audio directly to your computer at line speed.

---

## 🌟 Highlights

- **🔒 100% Private & Local:** Runs completely on your PC (`localhost:5050`). No external cloud servers, no third-party tracking, and no subscriptions.
- **🌐 1,000+ Platforms Out-of-the-Box:**
  - **YouTube:** 4K 60fps, 1080p Full HD, Shorts, and Live stream clips.
  - **Instagram:** Reels, Stories, and Carousels.
  - **Twitter / X:** High-definition video clips and GIFs.
  - **TikTok & Pinterest:** Watermark-free clips and animations.
  - **Reddit & Vimeo:** Auto-merged audio + video master streams.
  - **Audio Extraction:** High-fidelity 320kbps MP3 audio rip with full metadata.
- **🪐 3D Cyber HUD Interface:** Interactive WebGL 3D particle vortex and live HUD built with Three.js.
- **⚡ Real-Time Transfer Metrics:** Live speed gauge (MB/s), remaining bytes, and ETA counter.
- **📂 Instant Folder Access:** One-click button to immediately open your `Downloads/RipNexus` folder in File Explorer.

---

## 🚀 How to Run (1-Click Launch)

### On Windows:
1. Clone or download this repository:
   ```bash
   git clone https://github.com/nikhildswll-sys/RipNexus.git
   ```
2. Double-click **`run.bat`**.
   - It will automatically set up Python dependencies and launch the dashboard in your default browser at `http://localhost:5050`.

### On macOS / Linux:
```bash
git clone https://github.com/nikhildswll-sys/RipNexus.git
cd RipNexus
pip install -r requirements.txt
python app.py
```
Open **`http://localhost:5050`** in your browser.

---

## 📁 Downloads Directory

All downloaded videos and audio files are saved directly into your personal user downloads folder:
```
Windows: C:\Users\<YourUser>\Downloads\RipNexus
Mac/Linux: ~/Downloads/RipNexus
```

---

## 🛠️ Built With

- **Engine:** Python 3, Flask, `yt-dlp`, FFmpeg 9.0+ hardware muxing
- **UI:** Three.js (WebGL 3D Engine), Glassmorphism CSS, Font Awesome 6
- **Architecture:** Zero external dependencies beyond local Python runtime

---

## 📜 License

Distributed under the **MIT License**. Created by [Nikhil Deswal](https://github.com/nikhildswll-sys).
