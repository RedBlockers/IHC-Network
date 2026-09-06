export function coverScale(imageWidth, imageHeight, frameSize, zoom = 1) {
    return Math.max(frameSize / imageWidth, frameSize / imageHeight) * zoom;
}

export function clampCropOffset(offset, imageWidth, imageHeight, frameSize, scale) {
    const maxX = Math.max(0, (imageWidth * scale - frameSize) / 2);
    const maxY = Math.max(0, (imageHeight * scale - frameSize) / 2);
    return {
        x: maxX === 0 ? 0 : Math.max(-maxX, Math.min(maxX, offset.x)),
        y: maxY === 0 ? 0 : Math.max(-maxY, Math.min(maxY, offset.y)),
    };
}

export function cropSourceRect(imageWidth, imageHeight, frameSize, scale, offset) {
    const size = frameSize / scale;
    return {
        left: Math.max(0, Math.min(imageWidth - size, (imageWidth - size) / 2 - offset.x / scale)),
        top: Math.max(0, Math.min(imageHeight - size, (imageHeight - size) / 2 - offset.y / scale)),
        width: size,
        height: size,
    };
}

export function exportAvatarCrop(image, frameSize, scale, offset, outputSize = 512) {
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const source = cropSourceRect(image.naturalWidth, image.naturalHeight, frameSize, scale, offset);
    canvas.getContext("2d", { alpha: false }).drawImage(
        image,
        source.left,
        source.top,
        source.width,
        source.height,
        0,
        0,
        outputSize,
        outputSize
    );
    return new Promise((resolve, reject) => canvas.toBlob(
        (blob) => blob ? resolve(new File([blob], "avatar.webp", { type: "image/webp" })) : reject(new Error("Export du cadrage impossible.")),
        "image/webp",
        0.9
    ));
}
