const http = require('http');
const fs = require('fs');
const path = require('path');

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

ensureUploadDirExists();

const server = http.createServer((req, res) => {
    const filepath = getFilepath(req.url === '/' ? 'index.html' : req.url);
    const mimeType = MIME_TYPES[getExtension(filepath)];
    if (mimeType) {
        handleStaticAssets(res, filepath, mimeType);
    } else {
        handleFileUpload(req, res);
    }
});
server.on('dropRequest', (req, socket) => {
    console.warn(`[DROP REQUEST]: ${socket.remoteAddress} dropped`);
    console.warn(`[DROP REQUEST]: request closed: ${req.closed}`);
    console.warn(`[DROP REQUEST]: request completed: ${req.complete}`);
    console.error(`[DROP REQUEST]: request error: ${req.errored?.message ?? 'N/A'}`);
});
server.on('error', (error) => console.error(`[ERROR]: ${error.message}`));
server.on('close', () => console.log('[CLOSE]: Server is closing the connection..'));
server.on('connection', (socket) => console.log(`[CONNECTION]: ${socket.remoteAddress} connected`));
server.on('clientError', (error, socket) => console.error(`[CLIENT ERROR]: ${socket.remoteAddress} errored out with: ${error.message}`));
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

function writeResponse(res, data, contentType) {
    res.writeHead(res.statusCode, { 'Content-Type': contentType });
    res.end(data);
}

function handleStaticAssets(res, filepath, mimeType) {
    fs.readFile(filepath, (err, data) => {
        if (err) {
            writeResponse(res, 'Internal Server Error', 'text/plain');
        } else {
            writeResponse(res, data, mimeType);
        }
    });
}

function handleFileUpload(req, res) {
    let rawData = Buffer.alloc(0);
    req.on('data', (chunk) => rawData = Buffer.concat([rawData, chunk]));

    const boundaryBuffer = Buffer.from(req.headers['content-type'].split('boundary=')[1]);
    req.on('end', () => {
        splitBuffer(rawData, boundaryBuffer).forEach((part) => {
            if (part.length === 0 || !part.includes(Buffer.from('filename="'))) {
                return;
            }

            const headerEndIndex = part.indexOf('\r\n\r\n');
            if (headerEndIndex === -1) {
                return;
            }

            const header = part.slice(0, headerEndIndex).toString();
            const matchFilename = header.match(/filename="(.+?)"/);
            if (!matchFilename) {
                return;
            }

            const filename = matchFilename[1].replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const fileData = part.slice(headerEndIndex + 4);
            if (fileData.slice(-2).toString() === '\r\n') {
                fileData = fileData.slice(0, -2);
            }

            const filePath = path.join(__dirname, 'uploads', filename);
            fs.writeFile(filePath, fileData, (err) => {
                if (err) {
                    throw err;
                }
                console.log(`✅ Upload successful: ${filename}`);
            });
        });

        writeResponse(res, 'Files uploaded!', 'text/plain');
    });
}

function splitBuffer(buffer, delimiter) {
    let parts = [];
    let start = 0, index = 0;

    while ((index = buffer.indexOf(delimiter, start)) !== -1) {
        parts.push(buffer.slice(start, index));
        start = index + delimiter.length;
    }
    parts.push(buffer.slice(start));

    return parts;
}

function getFilepath(...args) {
    return path.join(__dirname, ...args);
}

function getExtension(filepath) {
    return path.extname(filepath).toLowerCase();
}

function ensureUploadDirExists() {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }
}
