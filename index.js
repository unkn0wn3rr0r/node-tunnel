const dropbox = document.getElementById('dropbox');
const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const fileSize = document.getElementById('fileSize');
const progress = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const cancelBtn = document.getElementById('cancelBtn');

dropbox.addEventListener('dragenter', debounce(suppressEvents));
dropbox.addEventListener('dragover', debounce(suppressEvents));
dropbox.addEventListener('drop', debounce(drop));
fileInput.addEventListener('change', debounce(handleFiles));

function suppressEvents(e) {
    e.stopPropagation();
    e.preventDefault();
}

function drop(e) {
    suppressEvents(e);
    handleFiles(e.dataTransfer.files);
}

function handleFiles(files) {
    const fileList = this.files ?? files;
    const data = new FormData();

    let numberOfBytes = 0;
    for (const file of fileList) {
        data.append(file.name, file);
        numberOfBytes += file.size;
    }
    fileCount.textContent = fileList.length;
    fileSize.textContent = getFileSizeFormat(numberOfBytes);

    sendFiles(data);
}

function sendFiles(data) {
    const xhr = new XMLHttpRequest();
    let isAborted = false;
    xhr.upload.addEventListener('progress', function (e) {
        if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            progress.style.width = percent + '%';
            progressText.textContent = percent.toFixed() + '%';
        }
    });
    xhr.upload.addEventListener('loadstart', () => {
        fileInput.disabled = true;
        cancelBtn.hidden = false;
        cancelBtn.addEventListener('click', debounce(() => {
            if (!confirm("Are you sure you want to stop?")) {
                return;
            }
            isAborted = true;
            xhr.abort();
        }));
    });
    xhr.upload.addEventListener('loadend', () => {
        if (!isAborted) {
            setTimeout(() => {
                alert('Files uploaded successfully!');
                resetUploadState();
            }, 1000);
        }
    });
    xhr.upload.addEventListener('abort', () => {
        resetUploadState();
    });
    xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            progress.style.width = '100%';
        }
    });
    xhr.open('POST', '/upload');
    xhr.send(data);
}

function resetUploadState() {
    progress.style.width = '0%';
    progressText.textContent = '0%';
    fileCount.textContent = 0;
    fileSize.textContent = 0;
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

function debounce(fn, delay = 300) {
    let timeout = 0;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}
