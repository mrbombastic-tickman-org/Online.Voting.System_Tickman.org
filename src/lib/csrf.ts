export function getCSRFTokenFromCookie(): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const cookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith('csrf-token='));

    if (!cookie) {
        return null;
    }

    return decodeURIComponent(cookie.substring('csrf-token='.length));
}

export function getCSRFHeaders(
    headers: Record<string, string> = {}
): Record<string, string> {
    const token = getCSRFTokenFromCookie();
    if (!token) {
        return headers;
    }

    return {
        ...headers,
        'x-csrf-token': token,
    };
}
