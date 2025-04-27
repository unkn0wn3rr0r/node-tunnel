const dropbox = document.getElementById('dropbox');
const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const fileSize = document.getElementById('fileSize');
const filesUploaded = document.getElementById('filesUploaded');
const filesCanceled = document.getElementById('filesCanceled');
const filesFailed = document.getElementById('filesFailed');
const successModal = document.getElementById('successModal');
const uploadInfo = document.getElementById('uploadInfo');
const closeModalBtn = document.getElementById('closeModalBtn');
const errorModal = document.getElementById('errorModal');
const errorInfo = document.getElementById('errorInfo');
const closeErrorModalBtn = document.getElementById('closeErrorModalBtn');

const MAX_SIZE_FILES_ALLOWED = 100;
const MAX_CONCURRENT_UPLOADS = 10;

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
    if (fileList.length > MAX_SIZE_FILES_ALLOWED) {
        return showModal(
            [],
            errorModal,
            errorInfo,
            closeErrorModalBtn,
            `You selected ${fileList.length} files. The maximum allowed is ${MAX_SIZE_FILES_ALLOWED}.`,
            resetUIState,
        );
    }

    fileCount.textContent = fileList.length;
    fileSize.textContent = getFileSizeFormat(getTotalFileSize(fileList));
    fileInput.disabled = true;

    const fileUploadItems = [];
    const uploadTasks = [];

    let uploadedCount = 0;
    let canceledCount = 0;
    let failedCount = 0;
    for (const file of fileList) {
        const abortController = new AbortController();
        const signal = abortController.signal;

        const { fileInfo, cancelBtn } = createFileInfo(file.name, file.size);
        const { progressBar, progress, progressText } = createProgressElements();

        const uploadId = crypto.randomUUID();
        subscribeToSSEUpdates(uploadId, progress, progressText);

        cancelBtn.addEventListener('click', () => {
            abortController.abort(`Upload canceled: ${file.name}`);
            cancelBtn.disabled = true;
        });

        const fileUploadItem = createFileUploadItem(fileInfo, progressBar);
        fileUploadItems.push(fileUploadItem);
        document.body.appendChild(fileUploadItem);

        const uploadTask = async () => {
            const reader = file.stream().getReader();
            const stream = new ReadableStream({
                start(controller) {
                    (function read() {
                        reader.read().then(({ done, value }) => {
                            if (signal.aborted) {
                                return;
                            }
                            if (done) {
                                return controller.close();
                            }
                            controller.enqueue(value);
                            read();
                        }).catch((error) => {
                            console.error(error);
                            controller.error(error);
                        });
                    })();
                },
                cancel(reason) {
                    if (typeof reader?.cancel === 'function') {
                        reader.cancel(reason);
                    }
                },
            });

            return fetch('/uploads', {
                method: 'POST',
                headers: {
                    'x-filename': encodeURIComponent(file.name),
                    'x-filesize': file.size,
                    'x-uploadid': uploadId,
                },
                duplex: 'half',
                body: stream,
                signal,
            })
                .then((response) => {
                    validateResponse(response);
                    console.log(`File upload was successful: ${file.name}`);
                    filesUploaded.textContent = ++uploadedCount;
                })
                .catch((error) => {
                    console.error(`File upload failed: ${file.name} ${error?.message ?? error ?? ''}`);
                    if (signal.aborted) {
                        filesCanceled.textContent = ++canceledCount;
                    } else {
                        filesFailed.textContent = ++failedCount;
                    }
                });
        };

        uploadTasks.push(uploadTask);
    }

    await limitConcurrency(uploadTasks, MAX_CONCURRENT_UPLOADS);
    showModal(
        fileUploadItems,
        successModal,
        uploadInfo,
        closeModalBtn,
        `${uploadedCount} Files were uploaded successfully.`,
        resetUIState,
    );
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

function subscribeToSSEUpdates(uploadId, progress, progressText) {
    const eventSource = new EventSource(`/upload-progress/${uploadId}`);
    eventSource.addEventListener('progress', (event) => {
        const { loadPercent } = JSON.parse(event.data);
        setProgressStatus('progress', loadPercent, progress, progressText);
    });
    eventSource.addEventListener('success', (event) => {
        const { loadPercent } = JSON.parse(event.data);
        setProgressStatus('success', loadPercent, progress, progressText);
        eventSource.close();
    });
    eventSource.addEventListener('failed', (event) => {
        const { loadPercent } = JSON.parse(event.data);
        setProgressStatus('failed', loadPercent, progress, progressText);
        eventSource.close();
    });
    eventSource.addEventListener('canceled', (event) => {
        const { loadPercent } = JSON.parse(event.data);
        setProgressStatus('canceled', loadPercent, progress, progressText);
        eventSource.close();
    });
    eventSource.addEventListener('error', (_) => {
        setProgressStatus('failed', 0, progress, progressText);
        eventSource.close();
    });
}

function resetUIState(fileUploadItems) {
    fileUploadItems.forEach((item) => item.remove());
    resetUploadState();
}

function showModal(items, modal, info, btn, message, cb) {
    modal.style.display = 'flex';
    info.textContent = message;

    btn.addEventListener('click', () => cb(items), { once: true });
}

function validateResponse(response) {
    if (!response.ok || response.status !== 200) {
        throw new Error('Upload failed.');
    }
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
    return { fileInfo, cancelBtn };
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

function setProgressStatus(status, loadPercent, progress, progressText) {
    switch (status) {
        case 'progress':
            progress.style.width = loadPercent.toFixed() + '%';
            progressText.textContent = loadPercent.toFixed() + '%';
            break;
        case 'success':
            progress.style.backgroundColor = '#4caf50';
            progress.style.width = loadPercent.toFixed() + '%';
            progressText.textContent = loadPercent.toFixed() + '%';
            break;
        case 'canceled':
            progress.style.backgroundColor = 'orange';
            progressText.textContent = 'Canceled';
            break;
        case 'failed':
            progress.style.backgroundColor = 'red';
            progressText.textContent = 'Failed';
            break;
    }
}

function getTotalFileSize(files) {
    let size = 0;
    for (const file of files) {
        size += file.size;
    }
    return size;
}

function resetUploadState() {
    fileCount.textContent = 0;
    fileSize.textContent = 0;
    filesUploaded.textContent = 0;
    filesCanceled.textContent = 0;
    filesFailed.textContent = 0;
    fileInput.value = '';
    fileInput.disabled = false;
    uploadInfo.textContent = '';
    successModal.style.display = 'none';
    errorInfo.textContent = '';
    errorModal.style.display = 'none';
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
    return `${approx.toFixed(3)} ${units[exponent]}s`;
}

function isFileEmpty(exponent, approx) {
    return !isFinite(exponent) || !isFinite(approx);
}
