# PermitScope

**Know what you signed. Know what is still open.**

**[Open PermitScope](https://hackathon.pocketplay.win/permitscope/)** · [Hackathon Lab](https://hackathon.pocketplay.win/)

The VPS version puts the selected permission, both states, all three core actions, and before/after evidence on one screen. Detailed history, receipt backups and edge-case controls open in dialogs.

PermitScope records standard ERC-2612 signatures and tracks two independent facts: whether a recorded signature can still activate, and whether its spender already has an on-chain allowance. A zero allowance does not prove that no signed permissions remain.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite (port 5178, `/permitscope/`). No API key, browser wallet, faucet or cryptocurrency is needed.

```sh
npm test
npm run build
npm run preview
```

`npm run build` compiles `contracts/DemoPermitToken.sol` from the pinned OpenZeppelin dependency, typechecks the code and produces a static site in `dist/`. The committed generated artifact lets a fresh checkout run the development demo immediately.

## The two-minute demo

1. A fresh isolated wallet starts with 1,000 valueless tUSD. Its initial test dApp signs a 750 tUSD Permit through the recorder SDK.
2. Observe **Ready to activate** alongside **0 tUSD allowance**.
3. Select **Preview risk**. A temporary EVM branch activates that exact signed permit and executes `transferFrom`; 750 tUSD could leave. All branch state is discarded.
4. Select **Cancel permission**, inspect the target and confirm. A real zero-value Permit executes in the isolated EVM.
5. Select **Verify closure**. The original signature is submitted again and reverts. The test transfer also fails, the token nonce has advanced and the allowance is zero.
6. Under **Test edge cases**, explore an activated allowance followed by **Advance 24 hours**. The signature cannot activate again but the existing allowance stays open until revoked.

## What is real

- Solidity compiled from OpenZeppelin `ERC20Permit` and executed by EthereumJS VM, not hardcoded transaction outcomes.
- EIP-712 secp256k1 signing, signature recovery, domain/account/chain checks, ERC-2612 nonce and deadline enforcement.
- Signed legacy transactions, actual EVM execution receipts, gas counts and contract-state reads.
- A recorder SDK shared by two in-app test dApp contexts.
- IndexedDB receipt retention with no 100-item eviction, local export/import and explicit deletion.
- Independent signature/allowance classification, including expired, future, stale, imported and wrong-context records.

## What is demonstration-only

The website executes in a **private in-memory EVM inside the browser**, chain ID 31337. It is not a public testnet, does not use consensus or finality, does not connect a real wallet and does not protect production assets. Wallets are randomly generated for each isolated session and tokens have no value. Public testnet deployment remains a separate milestone.

The harness keeps test signatures and ephemeral keys in memory to allow controlled replay. The recorder's persistence sink receives metadata only. Reloading resets the EVM and wallet; older records remain locally but display as unverified because the original state is gone.

Neither a receipt backup nor this demo can enumerate unrecorded signatures, import a user's old signature history automatically, recover stolen funds, or guarantee winning a transaction race. Imports are unverified metadata even if their JSON claims otherwise. Same-nonce cancellation can invalidate multiple signatures for that token; allowances for other spenders remain independent.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/core/recorder.ts` | Validate a supported payload, read wallet context, request one signature, verify it, persist metadata |
| `src/core/status.ts` | Deterministic signature and allowance states; unknown is not safe |
| `src/core/sandbox.ts` | Real isolated EthereumJS execution, deployment, temporary probes, cancellation and replay |
| `src/core/storage.ts` | Device-local records and metadata-only backups |
| `src/App.tsx` | Permission workspace, confirmation, evidence and edge-case exploration |
| `tests/` | Real-EVM lifecycle and recorder/storage trust-boundary tests |

### Recorder integration

`capturePermit(provider, payload, context, save)` accepts an explicitly chosen EIP-1193 provider and an explicit known deployment. It returns the signature to the calling dApp and sends only a `PermitRecord` to the persistence sink. It does not globally intercept arbitrary browser wallets. Context reads have bounded timeouts and a limited retry; identity or safety decisions never use stale identity data. Signature prompts are not automatically retried.

The current UI intentionally uses only the isolated provider. Standard ERC-2612 is not interchangeable with DAI-style permits, Permit2, NFT signatures or EIP-7702.

## Research and attribution

- [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612)
- [Revoke.cash explains its off-chain visibility limitation and existing cancellation support](https://revoke.cash/learn/approvals/what-are-eip2612-permit-signatures)
- [Rabby historical record implementation inspected at a fixed commit](https://github.com/RabbyHub/Rabby/blob/66c312834b2706232adb9a1b1a67b9eb7644f9a8/src/background/service/signTextHistory.ts)
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
- [EthereumJS](https://github.com/ethereumjs/ethereumjs-monorepo)

We do not claim to have invented permit revocation or to outperform these products' overall security. The product contribution is a focused lifecycle workflow, preservation of still-relevant receipts, separate status explanations and verifiable outcomes.

## AI disclosure

OpenAI Codex assisted with research, TypeScript/React implementation, styling, Solidity test harness, documentation and verification. OpenZeppelin supplies the token/permit implementation; EthereumJS supplies the EVM. No AI model decides whether a permission is closed or signs transactions. Demo data is explicitly identified in the code and interface. No real users or protected-loss metrics are claimed.

## License

Original project code is MIT licensed. Third-party dependencies retain their own licenses.


## Submission media

[Product demo video](https://www.youtube.com/watch?v=S6Y7p_j_NZk) · [Pitch deck](docs/pitch-deck.pptx) · [Devpost entry](https://devpost.com/software/permitscope)

English synthetic narration, real product recordings, no burned-in subtitles. AI assistance and prototype boundaries are disclosed.
