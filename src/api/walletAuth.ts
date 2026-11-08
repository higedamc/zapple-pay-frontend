import { eify } from "~/utils/eify";
import { API_BASE, authedPost, describeFailure } from "~/api/nip98";

export async function fetchNwaStatus(nwaResponse: { id: string; uri: string }) {
    try {
        console.log("fetching nwa status for id", nwaResponse.id);
        const response = await fetch(
            `${API_BASE}/check-wallet-auth?id=${encodeURIComponent(nwaResponse.id)}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get NWA status`);
        }

        const data = await response.json();
        console.log("nwa status", data);
        return data;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export type CreateNWAParams = {
    amount?: string;
    time_period?: string;
    identity?: string;
};

/**
 * Ask the backend for a fresh NWA (NIP-49) URI.
 *
 * `/wallet-auth` is a NIP-98 signed POST on the self-hosted backend. The body
 * is either absent (no budget) or a JSON `WalletAuthParams`; anything else is
 * a 400, so the budget fields are only sent when both are present. `identity`
 * is the autozap recipient and only travels together with a budget.
 */
export async function createNwa({
    amount,
    time_period,
    identity
}: CreateNWAParams) {
    console.log("creating nwa", amount, time_period, identity);

    // If we have an amount we must also have a time_period, if we have a time_period we must also have an amount
    if ((amount && !time_period) || (!amount && time_period)) {
        return undefined;
    }

    let body: string | undefined = undefined;

    if (amount && time_period) {
        const params: {
            amount: number;
            time_period: string;
            identity?: string;
        } = {
            amount: Number(amount),
            time_period
        };
        if (identity) {
            params.identity = identity;
        }
        body = JSON.stringify(params);
    }

    try {
        const response = await authedPost("/wallet-auth", body);

        if (!response.ok) {
            throw new Error(
                `Failed to get Nostr Wallet Auth details: ${await describeFailure(
                    response
                )}`
            );
        }

        // {
        //   "id": "hex encoded id",
        //   "uri": "nostr+walletauth://blahblah"
        // }
        const data = await response.json();

        return data;
    } catch (e) {
        console.error(e);
        throw new Error(eify(e).message);
    }
}
