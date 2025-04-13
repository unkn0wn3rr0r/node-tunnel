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

    console.log(fileList);

    let numberOfBytes = 0;
    for (const file of fileList) {
        numberOfBytes += file.size;
    }

    fileCount.textContent = fileList.length;
    fileSize.textContent = getFileSizeFormat(numberOfBytes);

    let loaded = 0;
    let countFiles = fileList.length;

    // const streams = Array.from(fileList).map(async (file) => {
    //     return fetch('https://localhost:3000/uploads', {
    //         method: 'POST',
    //         headers: { 'x-filename': file.name },
    //         duplex: 'half',
    //         body: new ReadableStream({
    //             start(controller) {
    //                 const reader = file.stream().getReader();
    //                 (function read() {
    //                     reader.read().then(({ done, value }) => {
    //                         if (done) {
    //                             fileCount.textContent = --countFiles;
    //                             if (countFiles <= 0) {
    //                                 setTimeout(() => {
    //                                     alert('Files uploaded successfully!');
    //                                     resetUploadState();
    //                                 }, 1000);
    //                             }
    //                             return controller.close();
    //                         }
    //                         loaded += value.byteLength;

    //                         calculateProgress(loaded, numberOfBytes);

    //                         controller.enqueue(value);
    //                         read();
    //                     }).catch((error) => {
    //                         console.error(error);
    //                         controller.error(error);
    //                     });
    //                 })();
    //             },
    //         }),
    //     });
    // });

    // Promise.all(streams)
    //     .then((x) => console.log(x))
    //     .catch((error) => {
    //         console.error('[ERROR]:', error);
    //     });

    for (const file of fileList) {
        const stream = new ReadableStream({
            start(controller) {
                const reader = file.stream().getReader();
                (function read() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            fileCount.textContent = --countFiles;
                            if (countFiles <= 0) {
                                setTimeout(() => {
                                    alert('Files uploaded successfully!');
                                    resetUploadState();
                                }, 1000);
                            }
                            return controller.close();
                        }
                        loaded += value.byteLength;

                        calculateProgress(loaded, numberOfBytes);

                        controller.enqueue(value);
                        read();
                    }).catch((error) => {
                        console.error(error);
                        controller.error(error);
                    });
                })();
            },
        });

        fetch('https://localhost:3000/uploads', {
            method: 'POST',
            headers: { 'x-filename': file.name },
            duplex: 'half',
            body: stream,
        })
            .then(() => {
                console.log('download completed');
            })
            .catch((error) => console.error(error))

        console.log('loaded =>', loaded);
        console.log('numberOfBytes =>', numberOfBytes);

        // sendFiles(data);
    }
}

function calculateProgress(loaded, total) {
    const percent = (loaded / total) * 100;
    progress.style.width = percent + '%';
    progressText.textContent = percent.toFixed() + '%';
}

function sendFiles(data) {

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
    // if (exponent > 3 || (exponent === 3 && approx > 10)) {
    //     alert('File is too large. Try with file/s less than 10 Gib.');
    //     resetUploadState();
    //     throw new Error('File is too large. Try with file/s less than 10 Gib.');
    // }
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
