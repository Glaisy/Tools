const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const sourcePreview = document.getElementById("source-preview");
const sourceImage = document.getElementById("source-image");
const sourceInfo = document.getElementById("source-info");
const previewCanvas = document.getElementById("preview-canvas");
const resultInfo = document.getElementById("result-info");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const shiftPixelsInput = document.getElementById("shift-pixels");
const outputFilename = document.getElementById("output-filename");

const resultViewport = document.getElementById("result-viewport");
const zoomSlider = document.getElementById("zoom-slider");
const zoomValue = document.getElementById("zoom-value");

const seamBandInput = document.getElementById("seam-band");
const seamInfo = document.getElementById("seam-info");

const interactiveControls = document.querySelectorAll(
    "#flip-h, #flip-v, #rotate-cw, #rotate-ccw, " +
    "#shift-up, #shift-down, #shift-left, #shift-right, " +
    "#shift-pixels, #reset-btn, #save-btn, #zoom-slider, " +
    "#cubemap-cross-to-row, #cubemap-row-to-cross, " +
    "#fix-wrap-seam, #seam-band, " +
    "#output-filename"
);

let loadedImage = null;
let fileName = "";
let fileSize = 0;
let fileType = "";

// --- Storage ---

const ShiftPixelsKey = "shiftPixels";
const SeamBandKey = "seamBand";

function storeSetting(key, value) {
    localStorage.setItem(key, value);
}

function loadSetting(key) {
    return localStorage.getItem(key);
}

// Load stored value or default to 0
const storedPixels = loadSetting(ShiftPixelsKey);
shiftPixelsInput.value = storedPixels !== null ? storedPixels : "0";

shiftPixelsInput.addEventListener("input", () => {
    storeSetting(ShiftPixelsKey, shiftPixelsInput.value);
});

const storedSeamBand = loadSetting(SeamBandKey);
seamBandInput.value = storedSeamBand !== null ? storedSeamBand : "16";

seamBandInput.addEventListener("input", () => {
    storeSetting(SeamBandKey, seamBandInput.value);
    if (transforms.fixWrapSeam) {
        renderPreview();
    }
});

const transforms = {
    flipH: false,
    flipV: false,
    rotation: 0,
    shiftX: 0,
    shiftY: 0,
    cubeMapCrossToRow: false,
    cubeMapRowToCross: false,
    fixWrapSeam: false
};

const view = {
    zoom: 1,
    panX: 0,
    panY: 0
};

// --- Upload ---

browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
});

dropZone.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        loadImage(fileInput.files[0]);
    }
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        loadImage(file);
    }
});

function loadImage(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            loadedImage = img;
            fileName = file.name;
            fileSize = file.size;
            fileType = file.type;

            // Show source preview
            sourceImage.src = img.src;
            sourceImage.classList.remove("hidden");
            const sw = img.naturalWidth;
            const sh = img.naturalHeight;
            sourceInfo.textContent = `${fileName} \u2014 ${sw}\u00d7${sh} px \u2014 ${formatFileSize(fileSize)}`;

            // Set default output filename
            outputFilename.value = fileName.replace(/\.[^.]+$/, "") + "_converted";

            // Set default shift pixels if no stored value
            if (loadSetting(ShiftPixelsKey) === null) {
                const defaultPixels = Math.round(Math.max(sw, sh) * 0.25);
                shiftPixelsInput.value = defaultPixels;
                storeSetting(ShiftPixelsKey, defaultPixels);
            }

            // Enable controls
            setControlsEnabled(true);

            resetTransforms();
            renderPreview();
        };
        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

function setControlsEnabled(enabled) {
    interactiveControls.forEach((el) => {
        el.disabled = !enabled;
    });
}

function resetTransforms() {
    transforms.flipH = false;
    transforms.flipV = false;
    transforms.rotation = 0;
    transforms.shiftX = 0;
    transforms.shiftY = 0;
    transforms.cubeMapCrossToRow = false;
    transforms.cubeMapRowToCross = false;
    transforms.fixWrapSeam = false;
    updateToggleButtons();
    resetView();
}

function resetView() {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    zoomSlider.value = 1;
    zoomValue.textContent = "1x";
    applyView();
}

function getBaseScale() {
    const boxW = resultViewport.clientWidth;
    const boxH = resultViewport.clientHeight;
    const cw = previewCanvas.width || 1;
    const ch = previewCanvas.height || 1;
    return Math.min(boxW / cw, boxH / ch);
}

function applyView() {
    const scale = getBaseScale() * view.zoom;
    const boxW = resultViewport.clientWidth;
    const boxH = resultViewport.clientHeight;
    const cw = previewCanvas.width * scale;
    const ch = previewCanvas.height * scale;

    // Center the image within the viewport
    const offsetX = Math.max(0, (boxW - cw) / 2);
    const offsetY = Math.max(0, (boxH - ch) / 2);

    previewCanvas.style.transform = `translate(${offsetX + view.panX}px, ${offsetY + view.panY}px) scale(${scale})`;
}

// --- Controls ---

document.getElementById("flip-h").addEventListener("click", () => {
    transforms.flipH = !transforms.flipH;
    updateToggleButtons();
    renderPreview();
});

document.getElementById("flip-v").addEventListener("click", () => {
    transforms.flipV = !transforms.flipV;
    updateToggleButtons();
    renderPreview();
});

document.getElementById("rotate-cw").addEventListener("click", () => {
    transforms.rotation = (transforms.rotation + 90) % 360;
    renderPreview();
});

document.getElementById("rotate-ccw").addEventListener("click", () => {
    transforms.rotation = (transforms.rotation + 270) % 360;
    renderPreview();
});

document.getElementById("shift-up").addEventListener("click", () => {
    transforms.shiftY -= getShiftAmount();
    renderPreview();
});

document.getElementById("shift-down").addEventListener("click", () => {
    transforms.shiftY += getShiftAmount();
    renderPreview();
});

document.getElementById("shift-left").addEventListener("click", () => {
    transforms.shiftX -= getShiftAmount();
    renderPreview();
});

document.getElementById("shift-right").addEventListener("click", () => {
    transforms.shiftX += getShiftAmount();
    renderPreview();
});

function getShiftAmount() {
    const val = parseInt(shiftPixelsInput.value, 10);
    return isNaN(val) || val < 1 ? 1 : val;
}

document.getElementById("cubemap-cross-to-row").addEventListener("click", () => {
    transforms.cubeMapCrossToRow = !transforms.cubeMapCrossToRow;
    if (transforms.cubeMapCrossToRow) {
        transforms.cubeMapRowToCross = false;
    }
    updateToggleButtons();
    resetView();
    renderPreview();
});

document.getElementById("cubemap-row-to-cross").addEventListener("click", () => {
    transforms.cubeMapRowToCross = !transforms.cubeMapRowToCross;
    if (transforms.cubeMapRowToCross) {
        transforms.cubeMapCrossToRow = false;
    }
    updateToggleButtons();
    resetView();
    renderPreview();
});

document.getElementById("fix-wrap-seam").addEventListener("click", () => {
    transforms.fixWrapSeam = !transforms.fixWrapSeam;
    updateToggleButtons();
    renderPreview();
});

function getSeamBand() {
    const val = parseInt(seamBandInput.value, 10);
    return isNaN(val) || val < 1 ? 1 : val;
}

function updateToggleButtons() {
    document.getElementById("flip-h").classList.toggle("active", transforms.flipH);
    document.getElementById("flip-v").classList.toggle("active", transforms.flipV);
    document.getElementById("cubemap-cross-to-row").classList.toggle("active", transforms.cubeMapCrossToRow);
    document.getElementById("cubemap-row-to-cross").classList.toggle("active", transforms.cubeMapRowToCross);
    document.getElementById("fix-wrap-seam").classList.toggle("active", transforms.fixWrapSeam);
}

// --- Cube Map ---

// Vertical cross (3 cols x 4 rows):
//        [  ] [+Y] [  ]
//        [-X] [+Z] [+X]
//        [  ] [-Y] [  ]
//        [  ] [-Z] [  ]
//
// Horizontal cross (4 cols x 3 rows):
//        [  ] [+Y] [  ] [  ]
//        [-X] [+Z] [+X] [-Z]
//        [  ] [-Y] [  ] [  ]
//
// Output row: +X, -X, +Y, -Y, +Z, -Z

function cubeMapCrossToRow(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    let faceSize;
    let faces;

    if (w * 4 === h * 3) {
        // Vertical cross: 3 wide x 4 tall
        faceSize = w / 3;
        faces = {
            posX: { x: 2, y: 1 },
            negX: { x: 0, y: 1 },
            posY: { x: 1, y: 0 },
            negY: { x: 1, y: 2 },
            posZ: { x: 1, y: 1 },
            negZ: { x: 1, y: 3 }
        };
    } else if (w * 3 === h * 4) {
        // Horizontal cross: 4 wide x 3 tall
        faceSize = w / 4;
        faces = {
            posX: { x: 2, y: 1 },
            negX: { x: 0, y: 1 },
            posY: { x: 1, y: 0 },
            negY: { x: 1, y: 2 },
            posZ: { x: 1, y: 1 },
            negZ: { x: 3, y: 1 }
        };
    } else {
        // Not a recognized cross layout, return as-is
        return null;
    }

    const order = ["posX", "negX", "posY", "negY", "posZ", "negZ"];
    const result = document.createElement("canvas");
    result.width = faceSize * 6;
    result.height = faceSize;
    const ctx = result.getContext("2d");

    for (var i = 0; i < order.length; i++) {
        const face = faces[order[i]];
        ctx.drawImage(
            img,
            face.x * faceSize, face.y * faceSize, faceSize, faceSize,
            i * faceSize, 0, faceSize, faceSize
        );
    }

    return result;
}

// Row order: +X, -X, +Y, -Y, +Z, -Z
// Output: horizontal cross (4 cols x 3 rows)
//        [  ] [+Y] [  ] [  ]
//        [-X] [+Z] [+X] [-Z]
//        [  ] [-Y] [  ] [  ]

function cubeMapRowToCross(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Row must be 6:1 ratio
    if (w !== h * 6) {
        return null;
    }

    const faceSize = h;
    // Input order: index 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
    const layout = [
        { src: 2, x: 1, y: 0 },
        { src: 1, x: 0, y: 1 },
        { src: 4, x: 1, y: 1 },
        { src: 0, x: 2, y: 1 },
        { src: 5, x: 3, y: 1 },
        { src: 3, x: 1, y: 2 }
    ];

    const result = document.createElement("canvas");
    result.width = faceSize * 4;
    result.height = faceSize * 3;
    const ctx = result.getContext("2d");

    for (var i = 0; i < layout.length; i++) {
        const entry = layout[i];
        ctx.drawImage(
            img,
            entry.src * faceSize, 0, faceSize, faceSize,
            entry.x * faceSize, entry.y * faceSize, faceSize, faceSize
        );
    }

    return result;
}

// --- Wrap Seam ---

// The left and right edges of an equirectangular map meet on the body, so their pixels have to line
// up. When they do not, a vertical line shows along the antimeridian.
//
// The fix measures the mismatch per row, smooths it along the vertical axis, then blends a narrow band
// on each side halfway towards the other. Correcting both sides by half means the edges meet without
// either one's features being dragged across the map, and the correction fades to nothing at the inner
// end of the band so the interior is left untouched.

// Rows within this fraction of the image height are averaged together when smoothing the correction.
const SeamSmoothFraction = 1 / 128;

function measureWrapSeam(imageData) {
    const { width, height, data } = imageData;
    let signed = 0;
    let absolute = 0;

    for (let y = 0; y < height; y++) {
        const leftOffset = y * width * 4;
        const rightOffset = (y * width + width - 1) * 4;

        for (let c = 0; c < 3; c++) {
            const difference = data[leftOffset + c] - data[rightOffset + c];
            signed += difference;
            absolute += Math.abs(difference);
        }
    }

    const samples = height * 3;
    return { signed: signed / samples, absolute: absolute / samples };
}

// Returns the per row, per channel mismatch between the two edges, smoothed vertically.
//
// Smoothing matters: correcting every row by its own raw difference would carry that row's noise into
// the band and replace the vertical seam with a horizontal streak pattern.
function buildSeamCorrection(imageData) {
    const { width, height, data } = imageData;
    const raw = new Float64Array(height * 3);

    for (let y = 0; y < height; y++) {
        const leftOffset = y * width * 4;
        const rightOffset = (y * width + width - 1) * 4;

        for (let c = 0; c < 3; c++) {
            raw[y * 3 + c] = data[leftOffset + c] - data[rightOffset + c];
        }
    }

    const radius = Math.max(1, Math.round(height * SeamSmoothFraction));
    const smoothed = new Float64Array(height * 3);

    for (let y = 0; y < height; y++) {
        for (let c = 0; c < 3; c++) {
            let sum = 0;
            let count = 0;

            for (let d = -radius; d <= radius; d++) {
                const yy = y + d;

                // clamp at the poles rather than wrapping, since the top and bottom rows are not neighbours
                if (yy < 0 || yy >= height) {
                    continue;
                }

                sum += raw[yy * 3 + c];
                count++;
            }

            smoothed[y * 3 + c] = sum / count;
        }
    }

    return smoothed;
}

function fixWrapSeam(source, band) {
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;

    const result = document.createElement("canvas");
    result.width = width;
    result.height = height;

    const ctx = result.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);

    // a band wider than half the image would have the two sides correcting each other
    const effectiveBand = Math.min(band, Math.floor(width / 2));
    if (effectiveBand < 1) {
        return { canvas: result, before: null, after: null };
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const before = measureWrapSeam(imageData);
    const correction = buildSeamCorrection(imageData);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let i = 0; i < effectiveBand; i++) {
            // full strength at the edge, fading to nothing at the inner end of the band
            const t = 1 - i / effectiveBand;
            const weight = t * t * (3 - 2 * t);

            const leftOffset = (y * width + i) * 4;
            const rightOffset = (y * width + width - 1 - i) * 4;

            for (let c = 0; c < 3; c++) {
                const delta = correction[y * 3 + c];

                data[leftOffset + c] = clampChannel(data[leftOffset + c] - 0.5 * delta * weight);
                data[rightOffset + c] = clampChannel(data[rightOffset + c] + 0.5 * delta * weight);
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);

    return { canvas: result, before: before, after: measureWrapSeam(imageData) };
}

function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

// Reports the seam as two numbers, because only one of them is meant to reach zero.
//
// The signed difference is the one that matters: a real seam pushes every row the same way, so it shows
// as a consistent non zero value. The absolute difference stays non zero even on a correct map, since
// the two edges show different terrain.
function reportSeam(before, after) {
    if (!before) {
        seamInfo.textContent = "Image is too narrow to have a seam";
        seamInfo.className = "seam-info";
        return;
    }

    const isPresent = Math.abs(before.signed) > 0.5;

    if (after) {
        seamInfo.textContent =
            `Seam ${before.signed.toFixed(2)} → ${after.signed.toFixed(2)} ` +
            `(detail ${after.absolute.toFixed(2)} kept)`;
        seamInfo.className = "seam-info seam-clean";
        return;
    }

    seamInfo.textContent = isPresent
        ? `Seam detected: ${before.signed.toFixed(2)} level step`
        : `No seam: ${before.signed.toFixed(2)} level step`;
    seamInfo.className = isPresent ? "seam-info seam-present" : "seam-info seam-clean";
}

function measureSource(source) {
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;

    if (width < 2) {
        return null;
    }

    const probe = document.createElement("canvas");
    probe.width = width;
    probe.height = height;

    const ctx = probe.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);

    return measureWrapSeam(ctx.getImageData(0, 0, width, height));
}

// --- Rendering ---

function renderPreview() {
    if (!loadedImage) {
        return;
    }

    // Determine the source for further transforms
    let source = loadedImage;
    if (transforms.cubeMapCrossToRow) {
        const converted = cubeMapCrossToRow(loadedImage);
        if (converted) {
            source = converted;
        }
    } else if (transforms.cubeMapRowToCross) {
        const converted = cubeMapRowToCross(loadedImage);
        if (converted) {
            source = converted;
        }
    }

    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;
    const rotated = transforms.rotation === 90 || transforms.rotation === 270;
    const cw = rotated ? sh : sw;
    const ch = rotated ? sw : sh;

    previewCanvas.width = cw;
    previewCanvas.height = ch;

    const ctx = previewCanvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);

    // Order of operations: flip, then rotate, then shift.
    // Flip and rotate are baked into an offscreen canvas sized like the
    // final result, so the shift wraps along the final axes.
    const offscreen = document.createElement("canvas");
    offscreen.width = cw;
    offscreen.height = ch;
    const offCtx = offscreen.getContext("2d");

    offCtx.save();

    // Move origin to canvas center
    offCtx.translate(cw / 2, ch / 2);

    // Apply rotation
    offCtx.rotate((transforms.rotation * Math.PI) / 180);

    // Apply flip
    const scaleX = transforms.flipH ? -1 : 1;
    const scaleY = transforms.flipV ? -1 : 1;
    offCtx.scale(scaleX, scaleY);

    offCtx.drawImage(source, -sw / 2, -sh / 2);

    offCtx.restore();

    // Normalize shift to [0, dimension) range for wrapping
    const dx = ((transforms.shiftX % cw) + cw) % cw;
    const dy = ((transforms.shiftY % ch) + ch) % ch;

    // Draw the flipped/rotated image 4 times (2x2 tile) for wrap-around
    ctx.drawImage(offscreen, dx, dy);
    ctx.drawImage(offscreen, dx - cw, dy);
    ctx.drawImage(offscreen, dx, dy - ch);
    ctx.drawImage(offscreen, dx - cw, dy - ch);

    // The seam is fixed last, on the image as it will be saved: a rotation swaps which edges meet, so
    // measuring it any earlier would correct the wrong pair
    if (transforms.fixWrapSeam) {
        const fixed = fixWrapSeam(previewCanvas, getSeamBand());
        if (fixed.before) {
            // replace rather than composite, since the corrected pixels are opaque replacements
            ctx.clearRect(0, 0, cw, ch);
            ctx.drawImage(fixed.canvas, 0, 0);
        }
        reportSeam(fixed.before, fixed.after);
    } else {
        reportSeam(measureSource(previewCanvas), null);
    }

    resultInfo.textContent = `${cw}\u00d7${ch} px \u2014 ${fileType}`;
    applyView();
}

// --- Zoom & Pan ---

zoomSlider.addEventListener("input", () => {
    view.zoom = parseInt(zoomSlider.value, 10);
    zoomValue.textContent = view.zoom + "x";
    clampPan();
    applyView();
});

resultViewport.addEventListener("wheel", (e) => {
    if (!loadedImage) {
        return;
    }
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    view.zoom = Math.min(8, Math.max(1, view.zoom + delta));
    zoomSlider.value = view.zoom;
    zoomValue.textContent = view.zoom + "x";
    clampPan();
    applyView();
}, { passive: false });

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panStartX = 0;
let panStartY = 0;

resultViewport.addEventListener("mousedown", (e) => {
    if (!loadedImage || view.zoom <= 1) {
        return;
    }
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = view.panX;
    panStartY = view.panY;
    resultViewport.classList.add("dragging");
});

window.addEventListener("mousemove", (e) => {
    if (!isDragging) {
        return;
    }
    view.panX = panStartX + (e.clientX - dragStartX);
    view.panY = panStartY + (e.clientY - dragStartY);
    clampPan();
    applyView();
});

window.addEventListener("mouseup", () => {
    if (isDragging) {
        isDragging = false;
        resultViewport.classList.remove("dragging");
    }
});

function clampPan() {
    const scale = getBaseScale() * view.zoom;
    const boxW = resultViewport.clientWidth;
    const boxH = resultViewport.clientHeight;
    const cw = previewCanvas.width * scale;
    const ch = previewCanvas.height * scale;

    // How much the scaled canvas exceeds the viewport
    const overflowX = Math.max(0, cw - boxW);
    const overflowY = Math.max(0, ch - boxH);
    view.panX = Math.min(0, Math.max(-overflowX, view.panX));
    view.panY = Math.min(0, Math.max(-overflowY, view.panY));
}

// --- Reset ---

resetBtn.addEventListener("click", () => {
    resetTransforms();
    renderPreview();
});

// --- Save ---

saveBtn.addEventListener("click", () => {
    if (!loadedImage) {
        return;
    }

    const mimeType = fileType === "image/jpeg" ? "image/jpeg" : "image/png";
    const ext = mimeType === "image/jpeg" ? ".jpg" : ".png";
    const name = outputFilename.value.trim() || "output";

    const link = document.createElement("a");
    link.download = name + ext;
    link.href = previewCanvas.toDataURL(mimeType, 1.0);
    link.click();
});

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
