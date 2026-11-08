import { Show, createEffect, createResource, onCleanup } from "solid-js";
import { CreateNWAParams, createNwa, fetchNwaStatus } from "~/api/walletAuth";
import { IntegratedQr } from "./IntegratedQr";

export function NWA(props: {
    nwaParams: CreateNWAParams;
    onConnectedChange: (authId?: string) => void;
}) {
    // When we mount we want to reset the "connected" state
    props.onConnectedChange(undefined);

    const [nwaResponse] = createResource(() => props.nwaParams, createNwa);
    // Reading an errored resource (via `()` or `.latest`) rethrows, and a
    // throw from a resource source or an effect escapes to the root
    // ErrorBoundary and replaces the whole page. createNwa now rejects
    // whenever the NIP-07 signer is missing or declines, so only read the
    // response once it is actually ready; the error itself is rendered below.
    const readyResponse = () =>
        nwaResponse.state === "ready" ? nwaResponse() : undefined;
    const [nwaConnected, { refetch }] = createResource(
        readyResponse,
        fetchNwaStatus
    );

    const refetchInterval = setInterval(() => {
        refetch();
    }, 3000);

    onCleanup(() => {
        clearInterval(refetchInterval);
    });

    createEffect(() => {
        const response = readyResponse();
        if (nwaConnected.latest && response) {
            props.onConnectedChange(response.id);
        } else {
            props.onConnectedChange(undefined);
        }
    });

    function handleOpenMutinyNWA() {
        // open mutiny in a new window
        const uri = readyResponse()?.uri;
        const encodedUri = encodeURIComponent(uri);
        window.open(
            `https://app.mutinywallet.com/settings/connections?nwa=${encodedUri}`,
            "_blank"
        );
    }
    return (
        <>
            <Show when={nwaResponse.error}>
                <p class="text-red-500">{nwaResponse.error?.message}</p>
            </Show>
            <Show when={readyResponse()}>
                <IntegratedQr value={readyResponse()?.uri} />
                <label class="text-sm font-normal mt-0 opacity-75">
                    <p>
                        Scan this code with an NWA-compatible wallet like{" "}
                        <a href="https://app.mutinywallet.com">Mutiny</a>.
                    </p>
                </label>
                <button
                    onClick={handleOpenMutinyNWA}
                    class="bg-[#E53254] px-4 py-3 rounded disabled:opacity-25"
                    type="button"
                >
                    Open in Mutiny Wallet
                </button>
            </Show>
        </>
    );
}
