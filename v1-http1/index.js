const dropbox = document.getElementById('dropbox');
const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const fileSize = document.getElementById('fileSize');
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
    function abortOnClick() {
        if (!confirm('Are you sure you want to stop?')) {
            return;
        }
        xhr.abort();
    }
    cancelBtn.addEventListener('click', abortOnClick);
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
    });
    xhr.upload.addEventListener('loadend', () => cancelBtn.removeEventListener('click', abortOnClick));
    xhr.upload.addEventListener('abort', () => resetUploadState());
    xhr.upload.addEventListener('timeout', () => {
        alert('Request timed out!');
        resetUploadState();
    });
    xhr.upload.addEventListener('error', () => {
        alert('Request errored out!');
        resetUploadState();
    });
    xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            progress.style.width = '100%';
            setTimeout(() => {
                alert('Files uploaded successfully!');
                resetUploadState();
            }, 1000);
        }
    });
    xhr.open('POST', '/uploads');
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
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const baseLog = getBaseLog(numberOfBytes);
    const exponent = Math.min(Math.floor(baseLog), units.length - 1);
    const approx = numberOfBytes / (1024 ** exponent);
    if (isFileEmpty(exponent, approx)) {
        return `${numberOfBytes} ${units[0]}s`;
    }
    if (exponent === 0) {
        return `${numberOfBytes} ${units[exponent]}s`;
    }
    if (exponent > 2 || (exponent === 2 && approx > 300)) {
        alert('File is too large. Try with file/s less than 300 MBs.');
        resetUploadState();
        throw new Error('File is too large. Try with file/s less than 300 MBs.');
    }
    return `${approx.toFixed(3)} ${units[exponent]}s`;
}

function isFileEmpty(exponent, approx) {
    return !isFinite(exponent) || !isFinite(approx);
}
