# Node-Tunnel 🚇
**Node-Tunnel** is a lightweight file transfer solution built with Node.js, enabling real-time streaming and progress tracking over a seamless connection.

The project demonstrates a modern browser-based file upload UI, implemented in two versions:
- **v1-http1/**: Traditional HTTP/1 file uploads (non-streaming).
- **v2-http2/**: Advanced HTTP/2 implementation with streamed uploads using [ReadableStream](https://streams.spec.whatwg.org/).
  
Both versions include drag-and-drop functionality, real-time progress bars, and user feedback modals.

# HTTP/1 vs HTTP/2 Comparison:


| Feature                          | `v1-http1`                       | `v2-http2`                                                |
|----------------------------------|----------------------------------|-----------------------------------------------------------|
| Protocol                         | HTTP/1.1                         | HTTP/2                                                    |
| Upload method                    | Full file read (in memory)       | Streamed with `ReadableStream` (minimal memory usage)     |
| Browser compatibility            | Widely supported                 | Requires modern browsers                                  |
| Server requirements              | Pure Node.js (no libs)           | Pure Node.js (no libs)                                    |
| Performance                      | Slow 🐢 (files up to 300 MiBs)   | Lightning fast  🚈                                       |

# Features:

- 🖱 Drag & Drop and file input support
- 📂 File metadata display:
  - file count
  - total files size
  - uploaded files (**http2** only))
- 📊 Individual file progress bars (**http2** only)
- ✅ Success modal on completion (**http2** only)
- 🔁 Concurrency control for smoother UX (**http2** only)

# Notes
- Uses duplex: 'half' for streamed fetch uploads - ensure the browser and server support it
- The UI simulates progress to smooth out jumps due to fast async handling vs slower network speed

# 📦 Prerequisites:
- Node.js installed - 20+
- Modern web browser (for HTTP/2 streaming support in **v2-http2**)
- Self-signed certificates for local HTTPS (required for HTTP/2)

# 🚀 Getting Started:

1. Clone the repository:
   ```bash
   git clone https://github.com/unkn0wn3rr0r/node-tunnel.git
2. Install certificates - Only required for **http2**. Make sure you are in the **v2-http2** dir:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "//CN=localhost" -keyout localhost-privkey.pem -out localhost-cert.pem
2. Run the server from **v1-http1** or **v2-http2**:
   ```bash
   node server.js
3. UI:
   - Go to http://localhost:3000 in your browser for **http1**
   - Go to https://localhost:3000 in your browser for **http2**

# 📚 Disclaimer:
This project was built for fun and educational purposes — to explore file uploading, streaming with HTTP/2, and browser-based UI interactions.
While functional, it has limitations and areas that can be improved, such as:
- Error handling and retry logic
- Cancel upload functionality (button is present but not connected)
- Not optimized for ultra-large files — uploads over 40-50 GiBs or into the terabyte range may fail or behave unpredictably due to browser, memory, or network constraints
