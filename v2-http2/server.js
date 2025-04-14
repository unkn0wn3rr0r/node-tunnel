const http2 = require('node:http2');
const fs = require('fs');
const path = require('path');
const { finished } = require('node:stream');

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

ensureDirExists('uploads');
ensureDirExists('certs');

const keyPath = getFilepath('certs', 'localhost-privkey.pem');
const certPath = getFilepath('certs', 'localhost-cert.pem');

ensurePEMFilesExist(keyPath, certPath);

const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
    allowHTTP1: true,
};

const server = http2.createSecureServer(options, (req, res) => {
    if (req.method === 'POST' && req.url === '/uploads') {
        handleFileUpload(req, res);
    } else {
        const filepath = getFilepath(req.url === '/' ? 'index.html' : req.url);
        const mimeType = MIME_TYPES[getExtension(filepath)];
        handleStaticAssets(res, filepath, mimeType);
    }
});
server.on('sessionError', (error) => console.error(`[SESSION ERROR]: ${error.message}`));
server.on('timeout', () => console.warn('[TIMEOUT]: timed out'));
server.listen(PORT, () => console.log(`Server listening on https://0.0.0.0:${PORT}`));

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
    const filename = decodeURIComponent(req.headers['x-filename']);
    const writeStream = fs.createWriteStream(getFilepath('uploads', filename), { highWaterMark: 1024 * 1024 });
    req.on('data', (chunk) => {
        if (!writeStream.write(chunk)) {
            req.pause();
        }
    });
    writeStream.on('drain', () => {
        req.resume();
    });
    req.on('end', () => {
        writeResponse(res, `Uploaded file: ${filename}`, 'text/plain');
        writeStream.end();
    });
    writeStream.on('finish', () => {
        const cleanup = finished(writeStream, (err) => {
            cleanup();
            if (err) {
                console.error('Upload failed:', err);
            } else {
                console.log(`✅ Upload successful: ${filename}`);
            }
        });
    });
}

function writeResponse(res, data, contentType) {
    res.writeHead(res.statusCode, { 'Content-Type': contentType });
    res.end(data);
}

function getFilepath(...args) {
    return path.join(__dirname, ...args);
}

function getExtension(filepath) {
    return path.extname(filepath).toLowerCase();
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
        console.log('You can try to create them with the following command: openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "//CN=localhost" -keyout localhost-privkey.pem -out localhost-cert.pem');
        process.exit(1);
    }
}
