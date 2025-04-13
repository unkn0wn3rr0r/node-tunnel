const dropbox = document.getElementById('dropbox');
const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const fileSize = document.getElementById('fileSize');
const filesUploaded = document.getElementById('filesUploaded');
const progress = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const cancelBtn = document.getElementById('cancelBtn');

dropbox.addEventListener('dragenter', suppressEvents);
dropbox.addEventListener('dragover', suppressEvents);
dropbox.addEventListener('drop', drop);
fileInput.addEventListener('change', handleFiles);

function suppressEvents(e) {
    e.stopPropagation();
    e.preventDefault();
}

function drop(e) {
    suppressEvents(e);
    handleFiles(e.dataTransfer.files);
}

async function handleFiles(files) {
    const fileList = this.files ?? files;
    const totalFileSize = getTotalFileSize(fileList);

    fileCount.textContent = fileList.length;
    fileSize.textContent = getFileSizeFormat(totalFileSize);
    fileInput.disabled = true;
    cancelBtn.hidden = false;

    let loaded = 0;
    let uploaded = 0;
    for (const file of fileList) {
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const reader = file.stream().getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            filesUploaded.textContent = ++uploaded;
                            controller.close();
                            break;
                        }
                        loaded += value.byteLength;
                        calculateProgress(loaded, totalFileSize);
                        controller.enqueue(value);
                    }
                } catch (error) {
                    console.error(error);
                    controller.error(error);
                }
            },
        });

        try {
            await fetch('https://localhost:3000/uploads', {
                method: 'POST',
                headers: { 'x-filename': encodeURIComponent(file.name) },
                duplex: 'half',
                body: stream,
            });
            console.log(`File upload was successful: ${file.name}`);
        } catch (error) {
            console.error(`File upload failed: ${file.name} ${error.message}`);
        }
    }

    alert('Files uploaded successfully!');
    resetUploadState();
}

function getTotalFileSize(files) {
    let size = 0;
    for (const file of files) {
        size += file.size;
    }
    return size;
}

function calculateProgress(loaded, total) {
    const percent = (loaded / total) * 100;
    progress.style.width = percent + '%';
    progressText.textContent = percent.toFixed() + '%';
}

function resetUploadState() {
    progress.style.width = '0%';
    progressText.textContent = '0%';
    fileCount.textContent = 0;
    fileSize.textContent = 0;
    filesUploaded.textContent = 0;
    fileInput.value = '';
    fileInput.disabled = false;
    cancelBtn.hidden = true;
}

function getBaseLog(x, base = 1024) {
    return Math.log(x) / Math.log(base);
}

function getFileSizeFormat(numberOfBytes) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const baseLog = getBaseLog(numberOfBytes);
    const exponent = Math.min(Math.floor(baseLog), units.length - 1);
    const approx = numberOfBytes / (1024 ** exponent);
    if (isFileEmpty(exponent, approx)) {
        return `${numberOfBytes} ${units[0]}`;
    }
    if (exponent === 0) {
        return `${numberOfBytes} ${units[exponent]}`;
    }
    return `${approx.toFixed(3)} ${units[exponent]}`;
}

function isFileEmpty(exponent, approx) {
    return exponent === Infinity
        || exponent === -Infinity
        || approx === Infinity
        || approx === -Infinity
        || isNaN(exponent)
        || isNaN(approx);
}
