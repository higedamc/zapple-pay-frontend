// NIP-98 HTTP auth for the mutation endpoints of the self-hosted backend.
//
// Every state-changing request (set-user, create-subscription, wallet-auth)
// must carry `Authorization: Nostr <base64(kind 27235 event)>` signed by the
// npub that owns the config. The backend checks the `u` tag against its
// `--public-url` + path byte for byte, so the URL signed here must be the
// exact URL fetched. Signing is delegated to a NIP-07 browser extension; this
// site never sees a private key.
import type { Event, EventTemplate } from "nostr-tools";

declare global {
    interface Window {
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: EventTemplate): Promise<Event>;
        };
    }
}

const HTTP_AUTH_KIND = 27235;

/**
 * Base URL of the backend, fixed at build time (nsite is static). A bare host
 * gets `https://` (upstream behaviour); a value with an explicit scheme is
 * used as-is so a local `http://127.0.0.1:<port>` backend can be exercised.
 */
const RAW_API_URL: string = import.meta.env.VITE_ZAPPLE_API_URL ?? "";
export const API_BASE = (
    /^https?:\/\//.test(RAW_API_URL) ? RAW_API_URL : `https://${RAW_API_URL}`
).replace(/\/+$/, "");

export const NO_SIGNER_MESSAGE =
    "A NIP-07 signer extension (Alby, nos2x, ...) is required: requests to the backend are signed with your key.";

export function hasNip07(): boolean {
    return typeof window !== "undefined" && !!window.nostr;
}

function signer() {
    if (!hasNip07()) {
        throw new Error(NO_SIGNER_MESSAGE);
    }
    return window.nostr!;
}

/** Hex pubkey of the key the extension will sign with. */
export async function getExtensionPubkey(): Promise<string> {
    return signer().getPublicKey();
}

async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function base64Utf8(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

/**
 * Build the `Authorization` header value for `method url` with `body`.
 * The payload tag is only added when there is a body: the backend requires
 * it for non-empty bodies and tolerates its absence for empty ones.
 */
export async function nip98Header(
    url: string,
    method: "POST",
    body?: string
): Promise<string> {
    const tags: string[][] = [
        ["u", url],
        ["method", method]
    ];
    if (body !== undefined && body.length > 0) {
        tags.push(["payload", await sha256Hex(body)]);
    }
    const template: EventTemplate = {
        kind: HTTP_AUTH_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: ""
    };
    const event = await signer().signEvent(template);
    return `Nostr ${base64Utf8(JSON.stringify(event))}`;
}

/** Error text the backend put in its JSON body, or the HTTP status line. */
export async function describeFailure(res: Response): Promise<string> {
    const fallback = `${res.status} ${res.statusText}`.trim();
    try {
        const text = await res.text();
        if (!text) return fallback;
        try {
            const json = JSON.parse(text);
            if (json && typeof json.reason === "string") return json.reason;
        } catch (_) {
            // not JSON, fall through to the raw text
        }
        return text;
    } catch (_) {
        return fallback;
    }
}

/**
 * POST `path` on the backend with a signed NIP-98 header. `body` is sent
 * verbatim (and hashed verbatim), or omitted entirely when undefined.
 */
export async function authedPost(
    path: string,
    body?: string
): Promise<Response> {
    const url = `${API_BASE}${path}`;
    const headers: Record<string, string> = {
        Authorization: await nip98Header(url, "POST", body)
    };
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    return fetch(url, { method: "POST", headers, body });
}
