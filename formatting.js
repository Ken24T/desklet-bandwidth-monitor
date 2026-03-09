var formatRate = function(bytesPerSecond, mode = "auto-bytes") {
    if (mode === "auto-bits") {
        return _formatUnits(bytesPerSecond * 8, ["b/s", "Kb/s", "Mb/s", "Gb/s", "Tb/s"], 1000);
    }

    return _formatUnits(bytesPerSecond, ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"], 1024);
};

var formatDataSize = function(bytes) {
    return _formatUnits(bytes, ["B", "KB", "MB", "GB", "TB"], 1024);
};

function _formatUnits(rawValue, units, step) {
    let value = Math.max(0, rawValue);
    let unitIndex = 0;

    while (value >= step && unitIndex < units.length - 1) {
        value /= step;
        unitIndex += 1;
    }

    const decimals = value >= 100 || unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}