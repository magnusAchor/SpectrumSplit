# 🎵 SpectrumSplit - Desktop Audio Stem Separator

A powerful **desktop application** for separating audio tracks using AI-powered Demucs technology. **No internet connection required** - everything runs locally on your machine!

![SpectrumSplit Logo](assets/icon.icns)

## ✨ Features

- **🎯 AI-Powered Separation**: Uses Demucs neural network for professional-quality stem separation
- **💻 Desktop App**: Native macOS application with automatic backend management
- **🎵 Multiple Formats**: Supports MP3, WAV, FLAC, OGG, and more
- **🎼 4-Stem Separation**: Vocals, Drums, Bass, Guitar/Piano
- **🎸 Advanced Splitting**: Further split "other" stems into individual instruments
- **🔒 Privacy-Focused**: Local processing - your audio never leaves your device
- **⚡ Progress Tracking**: Real-time processing updates with visual feedback
- **🧹 Auto-Cleanup**: Automatic file management and temporary file cleanup

## 📦 Installation

### Option 1: Download Pre-built App (Recommended)

1. **Download the latest release** from [GitHub Releases](https://github.com/YOUR_GITHUB_USERNAME/SpectrumSplit/releases)
2. **Extract the zip file**:
   ```bash
   unzip SpectrumSplit-1.0.1-mac.zip
   ```
3. **Move to Applications**:
   ```bash
   mv SpectrumSplit.app /Applications/
   ```
4. **Launch the app** by double-clicking `SpectrumSplit.app` in Finder

**That's it!** The app will automatically start the backend when you launch it.

### Option 2: Build from Source

If you want to build the app yourself:

#### Prerequisites
- **Node.js 18+** and **npm**
- **Python 3.9+** with pip
- **macOS 10.13+**
- **Git**

#### Build Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/magnusAchor/SpectrumSplit.git
   cd SpectrumSplit
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

4. **Build the app**:
   ```bash
   npm run dist:mac
   ```

5. **Find the built app** in `release/mac/SpectrumSplit.app`

## 🚀 Usage

### Basic Audio Separation

1. **Launch SpectrumSplit** from your Applications folder
2. **Click "Choose File"** and select an audio file
3. **Watch the progress bar** as the AI processes your audio
4. **Download individual stems** when processing completes

### Advanced Instrument Splitting

1. After basic separation, click **"Split Instruments"**
2. The "Other" stem will be further separated into individual instruments
3. Download additional instrument stems

### Supported File Types

- MP3, WAV, FLAC, OGG, M4A
- Up to any file size (processing time scales with size)
- Stereo and mono audio supported

## 🏗️ Project Structure

```
SpectrumSplit/
├── electron/                 # Electron main process
│   ├── main.js              # App lifecycle and backend management
│   └── preload.js           # Security bridge (if needed)
├── src/                     # React frontend
│   ├── components/          # UI components
│   ├── pages/               # App pages
│   ├── utils/               # Audio processing utilities
│   └── App.jsx              # Main React app
├── backend/                 # Python FastAPI server
│   ├── main.py              # Audio processing API
│   ├── instrument_split.py  # Instrument separation logic
│   └── requirements.txt     # Python dependencies
├── assets/                  # App icons and resources
│   ├── icon.icns            # macOS app icon
│   └── icon.ico             # Windows app icon
├── dist/                    # Built frontend (generated)
├── release/                 # Built desktop apps (generated)
└── package.json             # Node.js configuration
```

## 🔧 Development

### Prerequisites for Development
- Node.js 18+
- Python 3.9+
- Git

### Development Setup

1. **Clone and install**:
   ```bash
   git clone https://github.com/magnusAchor/SpectrumSplit.git
   cd SpectrumSplit
   npm install
   cd backend && pip install -r requirements.txt && cd ..
   ```

2. **Start development**:
   ```bash
   # Terminal 1: Start frontend dev server
   npm run dev

   # Terminal 2: Start Electron app
   npm run dev:electron
   ```

3. **Build for production**:
   ```bash
   npm run dist:mac    # macOS
   npm run dist:win    # Windows
   npm run dist:linux  # Linux
   ```

### Key Technologies

- **Frontend**: React 18, Vite, Tailwind CSS, Radix UI
- **Desktop**: Electron 31
- **Backend**: FastAPI, Python 3.9+, Demucs AI
- **Audio Processing**: Librosa, Soundfile, Demucs neural network
- **Build**: Electron Builder, PyInstaller (for backend packaging)

## 📋 System Requirements

### Minimum Requirements
- **OS**: macOS 10.13+, Windows 10+, Linux (Ubuntu 18.04+)
- **RAM**: 4GB
- **Storage**: 500MB free space
- **Python**: 3.9+ (auto-detected on macOS/Linux)

### Recommended for Large Files
- **RAM**: 8GB+
- **CPU**: Multi-core processor
- **Storage**: 2GB+ free space for temporary files

## 🐛 Troubleshooting

### App Won't Start
- **Check Python installation**: `python3 --version`
- **Check Node.js**: `node --version`
- **Check logs**: `~/Library/Application Support/spectrum-split/main.log`

### Processing Fails
- **Large files**: May take 10-15 minutes - be patient!
- **Check disk space**: Processing needs temporary storage
- **Check file format**: Ensure audio file is not corrupted

### Backend Issues
- **Port 5000 in use**: Kill other processes using the port
- **Python not found**: Install Python 3.9+ from python.org

### Build Issues
- **Clean build**: `npm run clean && npm install`
- **Clear cache**: `rm -rf node_modules/.cache`
- **Rebuild backend**: `cd backend && pip install -r requirements.txt`

## 📝 API Documentation

The app includes a local REST API for advanced users:

- **GET /**: Health check
- **POST /separate**: Upload and separate audio file
- **POST /split-instruments**: Split instruments from "other" stem

API runs on `http://127.0.0.1:5000` when the app is running.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Test on multiple file sizes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Demucs**: The amazing AI audio separation technology
- **Electron**: Cross-platform desktop app framework
- **FastAPI**: Modern Python web framework
- **React**: UI library for the frontend

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_GITHUB_USERNAME/SpectrumSplit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_GITHUB_USERNAME/SpectrumSplit/discussions)
- **Documentation**: See this README and inline code comments

---

**Built with ❤️ using Electron, React, and Python**

