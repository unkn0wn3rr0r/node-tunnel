const { createSecureServer, constants } = require('node:http2');
const { finished } = require('node:stream');
const fs = require('fs');
const path = require('path');

const {
    HTTP2_METHOD_GET,
    HTTP2_METHOD_POST,
    HTTP_STATUS_OK,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

const PORT = 3000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
};
const SSE_CONNECTIONS = new Map();

ensureDirExists('uploads');
ensureDirExists('certs');

const keyPath = getFilepath('certs', 'localhost-privkey.pem');
const certPath = getFilepath('certs', 'localhost-cert.pem');

ensurePEMFilesExist(keyPath, certPath);

const server = createSecureServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
    allowHTTP1: true,
});
server.on('stream', router);
server.on('timeout', () => console.warn('[TIMEOUT]: timed out'));
server.on('sessionError', (error) => console.error(`[SESSION ERROR]: ${error.message}`));
server.listen(PORT, () => console.log(`Server listening on https://localhost:${PORT}`));

function router(stream, headers) {
    const { ':path': path, ':method': method } = headers;

    if (path === '/uploads' && method === HTTP2_METHOD_POST) {
        handleFileUpload(stream, headers);
    } else if (path.includes('/upload-progress/') && method === HTTP2_METHOD_GET) {
        const uploadId = path.split('/').pop();
        handleSSEConnection(stream, uploadId);
    } else {
        const filepath = getFilepath(path === '/' ? 'index.html' : path);
        const mimeType = MIME_TYPES[getExtension(filepath)];
        handleStaticAssets(stream, filepath, mimeType);
    }
}

function handleSSEConnection(conn, uploadId) {
    SSE_CONNECTIONS.set(uploadId, conn);
    conn.respond({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    conn.on('close', () => SSE_CONNECTIONS.delete(uploadId));
}

function handleStaticAssets(stream, filepath, mimeType) {
    function statCheck(stat, headers) {
        headers['last-modified'] = stat.mtime.toUTCString();
    }
    function onError(err) {
        try {
            if (err.code === 'ENOENT') {
                stream.respond({ ':status': 404 });
            } else {
                stream.respond({ ':status': 500 });
            }
        } catch (err) {
            console.error(err);
        }
        stream.end();
    }
    stream.respondWithFile(
        filepath,
        { 'Content-Type': mimeType },
        { statCheck, onError },
    );
}

function handleFileUpload(stream, headers) {
    const filename = decodeURIComponent(headers['x-filename']);
    const filesize = headers['x-filesize'];
    const uploadId = headers['x-uploadid'];
    const filepath = getFilepath('uploads', filename);
    const writeStream = fs.createWriteStream(filepath, { highWaterMark: 1024 * 1024 });

    function handleError(err) {
        deleteFile(filepath);
        sendSSEUpdate(uploadId, 0, 'failed');
        writeResponse(stream, `Upload failed: ${err.message}`, 'text/plain', HTTP_STATUS_INTERNAL_SERVER_ERROR);
        SSE_CONNECTIONS.delete(uploadId);
    }

    writeStream.on('drain', () => stream.resume());
    writeStream.on('error', handleError);
    const cleanup = finished(writeStream, (err) => {
        cleanup();
        if (err) {
            sendSSEUpdate(uploadId, 0, 'failed');
            console.error(`❌ Upload failed: ${err.message}`);
            writeResponse(stream, `Upload failed: ${err.message}`, 'text/plain', HTTP_STATUS_INTERNAL_SERVER_ERROR);
        } else {
            if (stream.aborted) {
                sendSSEUpdate(uploadId, 0, 'canceled');
            } else {
                sendSSEUpdate(uploadId, 100, 'success');
            }
            console.log(stream.aborted ? `❗ Upload canceled: ${filename}` : `✅ Upload successful: ${filename}`);
            writeResponse(stream, stream.aborted ? `Upload canceled: ${filename}` : `Uploaded file: ${filename}`, 'text/plain');
        }
        SSE_CONNECTIONS.delete(uploadId);
    });

    stream.on('end', () => writeStream.end());
    stream.on('error', handleError);

    let loaded = 0;
    stream.on('data', (chunk) => {
        loaded += chunk.length;

        const loadPercent = (loaded / filesize) * 100;
        sendSSEUpdate(uploadId, loadPercent, 'progress');

        if (!writeStream.write(chunk)) {
            stream.pause();
        }
    });
}

function sendSSEUpdate(uploadId, loadPercent, event) {
    const data = JSON.stringify({ loadPercent });
    const message = `event: ${event}\ndata: ${data}\n\n`;

    const conn = SSE_CONNECTIONS.get(uploadId);
    if (conn && !conn.writableEnded) {
        conn.write(message);
    }
}

function writeResponse(stream, data, contentType, status = HTTP_STATUS_OK) {
    if (!stream.writableEnded) {
        stream.respond({ 'Content-Type': contentType, ':status': status });
        stream.end(data);
    }
}

function getFilepath(...args) {
    return path.join(__dirname, ...args);
}

function getExtension(filepath) {
    return path.extname(filepath).toLowerCase();
}

function deleteFile(filepath) {
    fs.unlink(filepath, (err) => {
        if (err) {
            console.error(`File deletion failed: ${err.message}`);
        }
    });
}

function ensureDirExists(dirname) {
    const dir = getFilepath(dirname);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

function ensurePEMFilesExist(keyPath, certPath) {
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.error('❌ Missing PEM file(s):');
        if (!fs.existsSync(keyPath)) {
            console.error(` - ${keyPath}`);
        }
        if (!fs.existsSync(certPath)) {
            console.error(` - ${certPath}`);
        }
        console.error('Please create the required PEM files before starting the server.');
        console.log('You can try to create them with the following command:');
        console.log('- For Windows: openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "//CN=localhost" -keyout localhost-privkey.pem -out localhost-cert.pem');
        console.log("- For Linux:   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout localhost-privkey.pem -out localhost-cert.pem");
        process.exit(1);
    }
}
