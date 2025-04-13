const http2 = require('node:http2');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MBS = 64 * 1024 * 1024 // 64
const PORT = 3000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    // '.json': 'application/json',
    // '.png': 'image/png',
    // '.jpg': 'image/jpeg',
    // '.ico': 'image/x-icon',
    // '.txt': 'text/plain',
};

ensureUploadDirExists();

const options = {
    key: fs.readFileSync(getFilepath('certs', 'localhost-privkey.pem')),
    cert: fs.readFileSync(getFilepath('certs', 'localhost-cert.pem')),
    allowHTTP1: true,
};
const html = fs.readFileSync(path.resolve('index.html'), { encoding: 'utf-8' });
// const js = fs.readFileSync(path.resolve('index.js'), { encoding: 'utf-8' });
// const css = fs.readFileSync(path.resolve('styles.css'), { encoding: 'utf-8' });

const server = http2.createSecureServer(options, (req, res) => {
    if (req.url === '/') {
        res.writeHead(200, {
            'Content-Type': 'text/html',
        });
        res.write(html);
        res.end();
        return;
    }

    if (req.url === '/uploads') {
        return handleFileUpload(req, res);
    }

    try {
        const filepath = getAssetFilepath(req.url);
        const mimeType = MIME_TYPES[getExtension(filepath)];

        res.writeHead(200, { 'Content-Type': mimeType });

        const readStream = fs.createReadStream(filepath);
        readStream.pipe(res);
    } catch (error) {
        console.log(error);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.write('File not found');
        res.end();
    }
});
// const server = http2.createSecureServer(options, (req, res) => {
//     const filepath = getAssetFilepath(req.url);
//     const mimeType = MIME_TYPES[getExtension(filepath)];
//     if (mimeType) {
//         handleStaticAssets(res, filepath, mimeType);
//     } else if (req.method === 'POST' && req.url === '/upload') {
//         handleFileUpload(req, res);
//     }
// });
server.on('sessionError', (error) => console.error(`[SESSION ERROR]: ${error.message}`));
server.on('timeout', () => console.error('[TIMEOUT]: timed out!'));
server.listen(PORT, () => console.log(`Server listening on port https://localhost:${PORT}`));

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
    const filename = req.headers['x-filename'];
    const filepath = getFilepath('uploads', filename);
    const writeStream = fs.createWriteStream(filepath, { highWaterMark: MBS });
    req.on('data', (chunk) => {
        if (!writeStream.write(chunk)) {
            console.log('pause');
            req.pause();
        }
    });
    writeStream.on('drain', () => {
        req.resume();
        console.log('resume');
    });
    req.on('end', () => {
        writeResponse(res, `✅ Saved file: ${filename}`, 'text/plain');
    });
}

function getFilepath(...args) {
    return path.join(__dirname, ...args);
}

function getAssetFilepath(url) {
    return path.normalize(path.join(process.cwd(), url === '/' ? 'index.html' : url));
}

function getExtension(filepath) {
    return path.extname(filepath).toLowerCase();
}

function ensureUploadDirExists() {
    const uploadDir = getFilepath('uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }
}

// function getServerAddress() {
//     return Object.values(os.networkInterfaces()).flat().find((i) => i.family === 'IPv4' && !i.internal).address;
// }
