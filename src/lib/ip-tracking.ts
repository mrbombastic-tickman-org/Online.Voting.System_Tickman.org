// Server-side setting: IP tracking toggle for admin testing
// This is an in-memory store — resets on server restart
// In production, swap this with a database-backed setting

let _ipTrackingEnabled = true;

export function isIpTrackingEnabled(): boolean {
    return _ipTrackingEnabled;
}

export function setIpTrackingEnabled(enabled: boolean): void {
    _ipTrackingEnabled = enabled;
}
