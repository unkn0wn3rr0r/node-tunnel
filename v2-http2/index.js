const dropbox = document.getElementById('dropbox');
const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const fileSize = document.getElementById('fileSize');
const filesUploaded = document.getElementById('filesUploaded');
const successModal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModalBtn');

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

    const MAX_CONCURRENT_UPLOADS = 8;
    const fileUploadItems = [];
    const uploadTasks = [];

    let uploaded = 0;
    for (const file of fileList) {
        const fileInfo = createFileInfo(file.name, file.size);
        const { progressBar, progress, progressText } = createProgressElements();
        const fileUploadItem = createFileUploadItem(fileInfo, progressBar);
        fileUploadItems.push(fileUploadItem);
        document.body.appendChild(fileUploadItem);

        const uploadTask = async () => {
            let fileLoaded = 0;
            const stream = new ReadableStream({
                start(controller) {
                    const reader = file.stream().getReader();
                    (function read() {
                        reader.read().then(({ done, value }) => {
                            if (done) {
                                return controller.close();
                            }
                            fileLoaded += value.byteLength;
                            calculateProgress(fileLoaded, file.size, progress, progressText);
                            controller.enqueue(value);
                            read();
                        }).catch((error) => {
                            console.error(error);
                            controller.error(error);
                        });
                    })();
                },
            });

            return fetch('/uploads', {
                method: 'POST',
                headers: { 'x-filename': encodeURIComponent(file.name) },
                duplex: 'half',
                body: stream,
            })
                .then(() => {
                    console.log(`File upload was successful: ${file.name}`);
                    progress.style.backgroundColor = '#4caf50';
                })
                .catch((error) => {
                    console.error(`File upload failed: ${file.name} ${error.message}`);
                    progress.style.backgroundColor = 'red';
                })
                .finally(() => {
                    filesUploaded.textContent = ++uploaded;
                    progress.style.width = '100%';
                    progressText.textContent = '100%';
                });
        };

        uploadTasks.push(uploadTask);
    }

    await limitConcurrency(uploadTasks, MAX_CONCURRENT_UPLOADS);
    showModal(fileUploadItems, resetUIState);
}

async function limitConcurrency(tasks, maxConcurrent) {
    const results = [];
    const executing = new Set();

    for (const task of tasks) {
        const promise = task();
        results.push(promise);

        executing.add(promise);
        promise.finally(() => executing.delete(promise));

        if (executing.size >= maxConcurrent) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}

function resetUIState(fileUploadItems) {
    fileUploadItems.forEach((item) => item.remove());
    resetUploadState();
}

function showModal(fileUploadItems, cb) {
    successModal.style.display = 'flex';

    closeModalBtn.addEventListener('click', () => {
        successModal.style.display = 'none';
        cb(fileUploadItems);
    }, { once: true });
}

function createElementWrapper(tagName, clazz, textContent) {
    const element = document.createElement(tagName);
    element.classList.add(clazz);
    element.textContent = textContent ?? '';
    return element;
}

function createFileInfo(name, size) {
    const fileInfo = createElementWrapper('div', 'fileInfo', undefined);
    const fileName = createElementWrapper('span', 'fileName', name);
    const fileSize = createElementWrapper('span', 'fileSize', `(${getFileSizeFormat(size)})`);
    const cancelBtn = createElementWrapper('button', 'cancelBtn', 'Cancel Upload');
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileInfo.appendChild(cancelBtn);
    return fileInfo;
}

function createProgressElements() {
    const progressBar = createElementWrapper('div', 'progressBar', undefined);
    const progress = createElementWrapper('div', 'progress', undefined);
    const progressText = createElementWrapper('span', 'progressText', '0%');
    progress.appendChild(progressText);
    progressBar.appendChild(progress);
    return { progressBar, progress, progressText };
}

function createFileUploadItem(fileInfo, progressBar) {
    const fileUploadItem = createElementWrapper('div', 'fileUploadItem', undefined);
    fileUploadItem.appendChild(fileInfo);
    fileUploadItem.appendChild(progressBar);
    return fileUploadItem;
}

function getTotalFileSize(files) {
    let size = 0;
    for (const file of files) {
        size += file.size;
    }
    return size;
}

function calculateProgress(loaded, total, progress, progressText) {
    const percent = (loaded / total) * 100;
    const randomProgress = Math.floor(90 + Math.random() * 11); // simulate artificial progress, because async ui operations are faster than the servers response, in other words, create a better user experience
    const finalPercent = Math.min(percent, randomProgress);
    progress.style.width = finalPercent.toFixed() + '%';
    progressText.textContent = finalPercent.toFixed() + '%';
}

function resetUploadState() {
    fileCount.textContent = 0;
    fileSize.textContent = 0;
    filesUploaded.textContent = 0;
    fileInput.value = '';
    fileInput.disabled = false;
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
