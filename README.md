# Node-Tunnel 🚇
**Node-Tunnel** is a lightweight file transfer solution built with Node.js, enabling real-time streaming and progress tracking over a seamless connection.

This project demonstrates a modern browser-based file upload UI implemented in vanilla JavaScript and pure Node.js, which comes in two versions:
- **v1-http1/**: Traditional HTTP/1 file uploads (non-streaming)
- **v2-http2/**: Advanced HTTP/2 implementation with streamed uploads using [ReadableStream](https://streams.spec.whatwg.org/)
  
Both versions include drag-and-drop functionality, real-time progress bars, and user feedback modals.

# HTTP/1 vs HTTP/2 Comparison:


| Feature                          | `v1-http1`                       | `v2-http2`                                                |
|----------------------------------|----------------------------------|-----------------------------------------------------------|
| Protocol                         | HTTP/1.1                         | HTTP/2                                                    |
| Upload method                    | Full file read (in memory)       | Streamed with `ReadableStream` (minimal memory usage)     |
| Browser compatibility            | Widely supported                 | Requires modern browsers                                  |
| Server requirements              | Pure Node.js (no libs)           | Pure Node.js (no libs)                                    |
| Performance                      | Slow (files up to 300 MBs)       | High (depends on network connection)                      |

# 📦 Prerequisites:
- Node.js installed - v20+
- Modern web browser (for HTTP/2 streaming support in **v2-http2**) - Uses duplex: 'half' header for streamed fetch uploads - ensure your browser supports it
- Self-signed certificates for local HTTPS (required for HTTP/2)

# 🚀 Getting Started:

1. Clone the repository:
   ```bash
   git clone https://github.com/unkn0wn3rr0r/node-tunnel.git
2. Install certificates - Only required for **http2**. Make sure you are in the **v2-http2/certs** dir:

- Windows:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "//CN=localhost" -keyout localhost-privkey.pem -out localhost-cert.pem
   ```
- Linux:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout localhost-privkey.pem -out localhost-cert.pem
3. Run the server from **v1-http1** or **v2-http2**:
   ```bash
   node server.js
4. UI:
   - Go to http://localhost:3000 in your browser for **http1**
   - Go to https://localhost:3000 in your browser for **http2**
   - If you are testing from different machines find your local network IP, for example - https://192.168.xx.xx:3000

# 📚 Disclaimer:
This project was built for fun and educational purposes - to explore file uploading, streaming with HTTP/2, and browser-based UI interactions.
While functional, it has limitations and areas that can be improved, such as:
- Error handling and retry logic
- Not optimized for larger files - uploads over 15-20 GBs may fail or behave unpredictably due to browser, memory, or network constraints
