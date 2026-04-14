export const SETTINGS_KEYS = {
    SAMPLE_SECONDS: 'sample-seconds',
    SELECTION_MODE: 'selection-mode',
    PREFERRED_INTERFACE: 'preferred-interface',
    INCLUDE_TUNNELS: 'include-tunnel-interfaces',
    INCLUDE_LOOPBACK: 'include-loopback-interfaces',
    SHOW_AGGREGATE: 'show-aggregate',
    RATE_UNIT_MODE: 'rate-unit-mode',
    FONT_SIZE_POINTS: 'font-size-points'
};

export const SELECTION_MODE_VALUES = ['auto', 'preferred'];
export const RATE_UNIT_MODE_VALUES = ['auto-bytes', 'auto-bits'];

export function readSettingsSnapshot(settings) {
    return {
        sampleSeconds: _clampInteger(settings.get_int(SETTINGS_KEYS.SAMPLE_SECONDS), 1, 10, 1),
        selectionMode: _readAllowedString(settings, SETTINGS_KEYS.SELECTION_MODE, SELECTION_MODE_VALUES, 'auto'),
        preferredInterface: settings.get_string(SETTINGS_KEYS.PREFERRED_INTERFACE).trim(),
        includeTunnelInterfaces: settings.get_boolean(SETTINGS_KEYS.INCLUDE_TUNNELS),
        includeLoopbackInterfaces: settings.get_boolean(SETTINGS_KEYS.INCLUDE_LOOPBACK),
        showAggregate: settings.get_boolean(SETTINGS_KEYS.SHOW_AGGREGATE),
        rateUnitMode: _readAllowedString(settings, SETTINGS_KEYS.RATE_UNIT_MODE, RATE_UNIT_MODE_VALUES, 'auto-bytes'),
        fontSizePoints: _clampInteger(settings.get_int(SETTINGS_KEYS.FONT_SIZE_POINTS), 0, 24, 0)
    };
}

function _clampInteger(value, minimum, maximum, fallback) {
    if (!Number.isInteger(value))
        return fallback;

    return Math.max(minimum, Math.min(maximum, value));
}

function _readAllowedString(settings, key, allowedValues, fallback) {
    const value = settings.get_string(key);
    return allowedValues.includes(value) ? value : fallback;
}