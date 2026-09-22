// $TRUTHS buyer airdrops — a manual reward program, separate from the
// [vault] Path A/B systems in docs/VAULT-TROLL-REWARDS.md.
//
// The operator sends $TROLL by hand to wallets that bought $TRUTHS,
// at 3% of the USD amount of $TRUTHS purchased. Nothing here sends,
// signs, or holds anything — this is a public record of transfers the
// operator already made from their own wallet, same boundary as the
// wallet-submission queue.
//
// Add a new entry per airdrop. Only `wallet` is guaranteed at record time —
// everything else may start as TBD and get filled in once confirmed.

export type TruthsAirdrop = {
  wallet: string;
  // $TROLL amount actually sent, in whichever unit was recorded at send
  // time — token count (trollAmount) and/or USD value (trollSentUsd).
  trollAmount?: number;
  trollSentUsd?: number;
  date?: string; // "MMM D, YYYY"
  truthsBoughtUsd?: number;
  ratePct?: number;
  txSignature?: string;
};

export const TRUTHS_AIRDROPS: TruthsAirdrop[] = [
  {
    wallet: "39rs6K2iq7uDYoeFtfW9XguChcEXU5Vo5QGs8DV3pLGR",
    trollSentUsd: 1.62,
    ratePct: 3,
    date: "Sep 22, 2026",
  },
  {
    wallet: "6hoazQrquQxkkKFuiBMNf6thuH2uj6ue9kccLqghrjLJ",
  },
  {
    wallet: "5rrf9yDbFNMzrV4hw7NAoH3iBZLczHPnRg4En16ad2w9",
  },
  {
    wallet: "9qpucJgTkTVSbMPksG4fequu9STgFxr9AQmLN25MwiBV",
  },
  {
    wallet: "CE8xzQDJHPAA7N5Ajrj4W6H2A8d1dhxrnrwqvySYPu34",
    trollAmount: 15,
    date: "Sep 22, 2026",
  },
  {
    wallet: "7zVExNMgHg6pGbZzXP8qv2KLwtKX1pDo5PtrCoEzSBE8",
  },
  {
    wallet: "FKGiBuPYLy68RpwcksFq8zfPppH79pvFKjK9GvQeFqBi",
    trollAmount: 51,
    date: "Sep 22, 2026",
  },
];
