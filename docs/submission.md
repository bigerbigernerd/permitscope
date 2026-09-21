# PermitScope

## Problem and motivation
A wallet shows zero allowance. It looks safe. But an unsubmitted permit signature may still authorize a transfer later. The user needs to know what they actually signed, what remains executable, and whether cancellation really closed the permission.

## Existing solutions and remaining gap
Revoke dot cash already supports permit cancellation. Rabby already records signatures. The remaining issue is visibility and lifecycle: a chain scan cannot discover a signature that was never submitted. PermitScope connects captured receipts to current nonce, deadline, and allowance. It does not discover signatures it never recorded.

## Working prototype
Here is the real deployed prototype, running a real Ethereum virtual machine inside the browser. The test wallet has a captured permit for seven hundred and fifty test dollars, while its current allowance is zero. Preview risk executes a disposable branch and shows the potential transfer. Cancel permission submits a zero value permit at the same nonce. After confirmation, verify closure replays the original signature. The old signature is rejected, and the test transfer is rejected. Open the execution trail to inspect the actual local transaction receipts. These are test assets; no personal wallet is connected.

## Technical approach
Our engineering contribution is the complete evidence loop: typed data capture, device local metadata, explicit state assessment, real execution, and a replayable closure check. Signature expiry and token allowance are checked separately, because an allowance may survive its signature deadline.

## Results and limitations
The demonstrated result is narrow and inspectable: an executable test permission becomes unusable after cancellation. Coverage is limited to captured standard ERC twenty six twelve permits and the supported token implementation. Next comes wallet integration and user testing, without claiming universal wallet protection.

## AI and dependency disclosure
OpenAI Codex assisted research, code, tests, interface and documentation. Remotion composes actual screen recordings with synthetic narration. No customer traction, revenue, production security audit or unmeasured business impact is claimed. Third-party libraries retain their licenses.

## Sources
- https://eips.ethereum.org/EIPS/eip-2612
- https://revoke.cash/learn/approvals/what-are-eip2612-permit-signatures
- https://github.com/RabbyHub/Rabby/blob/66c312834b2706232adb9a1b1a67b9eb7644f9a8/src/background/service/signTextHistory.ts
