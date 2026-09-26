"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { describeAddressProblem, isValidSolanaAddress, shortenAddress } from "@/lib/solanaAddress";
import { MIN_WALLET_SUBMIT_PROBLEMS, trollForProblems } from "@/lib/redemption";

type WalletSubmission = {
  address: string;
  status: "pending" | "airdropped" | "skipped";
  created_at: string;
  updated_at: string;
};

type OpenRound = {
  problemsPerTroll: number;
  remainingTroll: number;
  perUserCap: number | null;
  label: string | null;
};

type RedemptionRequest = {
  id: string;
  problems_spent: number;
  rate_at_request: number;
  status: "pending" | "paid" | "refunded";
  amount_troll: number | null;
  created_at: string;
};

const XP_PER_PROBLEM = 25;
const MIN_REDEEM = 5;

async function getToken(): Promise<string | null> {
  const { data } = await getPublicClient().auth.getSession();
  return data.session?.access_token ?? null;
}

// The "spend your signal" body — redeem for xp and the $troll airdrop
// queue. Shared by the vault page and the nav's PROBLEMS counter popup
// (components/ProblemsCounter.tsx), so both surfaces run the exact same
// forms against the same routes. Only mount it for a signed-in user.
export default function SpendSignal({
  balance,
  onBalanceChange,
}: {
  balance: number;
  onBalanceChange?: (balance: number) => void;
}) {
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<{ xpAwarded: number; level: number } | null>(
    null
  );
  const [submission, setSubmission] = useState<WalletSubmission | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSaved, setAddressSaved] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [round, setRound] = useState<OpenRound | null>(null);
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);

  // The wallet submission is read through the API rather than the public
  // client: RLS would allow a direct select, but the route already shapes
  // the response and deliberately withholds the operator's private payout
  // record (amount, signature) from the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/vault/wallet", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const result = await res.json();
        if (!cancelled) setSubmission(result.submission ?? null);
      } catch {
        // Non-fatal: the form still works, it just won't prefill.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRedemption = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/vault/redeem-troll", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const result = await res.json();
      setRound(result.round ?? null);
      setRequests(result.requests ?? []);
    } catch {
      // Non-fatal — the rest of the panel still renders.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadRedemption();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRedemption]);

  async function saveAddress() {
    const address = addressInput.trim();
    if (addressBusy) return;
    if (balance < MIN_WALLET_SUBMIT_PROBLEMS) {
      setAddressError(`you need at least ${MIN_WALLET_SUBMIT_PROBLEMS} PROBLEMS to submit a wallet`);
      return;
    }
    const problem = describeAddressProblem(address);
    if (problem) {
      setAddressError(problem);
      return;
    }
    setAddressBusy(true);
    setAddressError(null);
    setAddressSaved(false);
    try {
      const token = await getToken();
      if (!token) {
        setAddressError("sign in required");
        return;
      }
      const res = await fetch("/api/vault/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAddressError(result.error ?? "could not save your address");
        return;
      }
      setSubmission(result.submission ?? null);
      setAddressInput("");
      setAddressSaved(true);
      setEditingAddress(false);
    } catch {
      setAddressError("connection to the terminal was lost");
    } finally {
      setAddressBusy(false);
    }
  }

  async function redeem() {
    const amount = Math.floor(Number(redeemInput));
    if (redeemBusy || !Number.isFinite(amount) || amount < MIN_REDEEM) return;
    setRedeemBusy(true);
    setRedeemError(null);
    setRedeemResult(null);
    try {
      const token = await getToken();
      if (!token) {
        setRedeemError("sign in required");
        return;
      }
      const res = await fetch("/api/vault/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      const result = await res.json();
      if (!res.ok) {
        setRedeemError(result.error ?? "redemption failed");
        return;
      }
      onBalanceChange?.(result.balance);
      // Keeps the nav counter (and any other open surface) in step.
      window.dispatchEvent(new Event("problems-changed"));
      setRedeemResult({ xpAwarded: result.xpAwarded, level: result.level });
      setRedeemInput("");
    } catch {
      setRedeemError("connection to the terminal was lost");
    } finally {
      setRedeemBusy(false);
    }
  }

  const redeemAmount = Math.floor(Number(redeemInput));
  const redeemValid = Number.isFinite(redeemAmount) && redeemAmount >= MIN_REDEEM;
  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <>
      <p className="mb-2 text-xs tracking-wide text-dim">redeem for xp</p>
      <p className="text-dim text-xs mb-3">
        1 PROBLEM = {XP_PER_PROBLEM} XP, one-way, minimum {MIN_REDEEM} at a time.
      </p>
      <div className="flex gap-2 vault-amount-form">
        <input
          type="number"
          min={MIN_REDEEM}
          step={1}
          value={redeemInput}
          onChange={(e) => {
            setRedeemInput(e.target.value);
            setRedeemResult(null);
            setRedeemError(null);
          }}
          placeholder={`${MIN_REDEEM}+`}
          disabled={redeemBusy}
          className="w-28 bg-transparent border border-dim px-2 py-1 text-sm text-problem outline-none focus:border-problem disabled:opacity-50"
        />
        <button
          type="button"
          onClick={redeem}
          disabled={redeemBusy || !redeemValid || redeemAmount > balance}
          className="border border-terminal text-terminal px-3 text-xs hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
        >
          {redeemBusy ? "..." : "redeem"}
        </button>
      </div>
      {redeemValid && (
        <p className="text-dim text-xs mt-2">
          → {redeemAmount * XP_PER_PROBLEM} xp
          {redeemAmount > balance && <span className="text-alert"> · not enough PROBLEMS</span>}
        </p>
      )}
      {redeemError && <p className="text-alert text-xs mt-2">[ {redeemError} ]</p>}
      {redeemResult && (
        <p className="text-terminal text-xs mt-2">
          [ +{redeemResult.xpAwarded} xp — now level {redeemResult.level} ]
        </p>
      )}

      <p className="mt-4 mb-2 border-t border-dim/40 pt-3 text-xs tracking-wide text-dim">
        $troll airdrop
      </p>
      {round && (
        <p className="text-dim text-xs mb-3">{round.problemsPerTroll} PROBLEMS: 1 $TROLL</p>
      )}
      {submission && !editingAddress ? (
        <>
          <p className="text-dim text-xs mb-2">you&apos;re in the queue.</p>
          <p className="text-problem text-sm font-mono break-all mb-2">
            {shortenAddress(submission.address, 6, 6)}
          </p>
          <p className="text-dim text-xs mb-3">
            status:{" "}
            {submission.status === "pending" && (
              <span className="text-problem">waiting on review</span>
            )}
            {submission.status === "airdropped" && <span className="text-gain">airdropped</span>}
            {submission.status === "skipped" && <span className="text-ghost">not this time</span>}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingAddress(true);
              setAddressInput(submission.address);
              setAddressSaved(false);
              setAddressError(null);
            }}
            className="border border-dim text-dim px-3 py-1 text-xs hover:border-terminal hover:text-terminal transition-colors"
          >
            change address
          </button>
        </>
      ) : (
        <>
          <p className="text-dim text-xs mb-3">
            {balance < MIN_WALLET_SUBMIT_PROBLEMS ? (
              <>
                needs {MIN_WALLET_SUBMIT_PROBLEMS} PROBLEMS to unlock ({balance}/
                {MIN_WALLET_SUBMIT_PROBLEMS}).
              </>
            ) : (
              <>
                paste YOUR solana address for a $TROLL airdrop. reviewed — this is a request, not a
                claim.
              </>
            )}
          </p>
          <div className="flex gap-2 vault-amount-form">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setAddressError(null);
                setAddressSaved(false);
              }}
              placeholder="your solana address"
              spellCheck={false}
              autoComplete="off"
              disabled={addressBusy || balance < MIN_WALLET_SUBMIT_PROBLEMS}
              className="flex-1 min-w-0 bg-transparent border border-dim px-2 py-1 text-sm text-problem font-mono outline-none focus:border-problem disabled:opacity-50"
            />
            <button
              type="button"
              onClick={saveAddress}
              disabled={
                addressBusy ||
                !isValidSolanaAddress(addressInput) ||
                balance < MIN_WALLET_SUBMIT_PROBLEMS
              }
              className="shrink-0 border border-terminal text-terminal px-3 text-xs hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
            >
              {addressBusy ? "..." : "submit"}
            </button>
          </div>
          {editingAddress && (
            <button
              type="button"
              onClick={() => {
                setEditingAddress(false);
                setAddressInput("");
                setAddressError(null);
              }}
              className="text-ghost text-xs mt-2 hover:text-dim transition-colors"
            >
              cancel
            </button>
          )}
          {addressError && <p className="text-alert text-xs mt-2">[ {addressError} ]</p>}
        </>
      )}
      {addressSaved && (
        <p className="text-terminal text-xs mt-2">
          [ submitted — the operator reviews these by hand. no promises. ]
        </p>
      )}
      <p className="text-ghost text-xs mt-3">
        double-check it. an airdrop sent to a wrong address is not my PROBLEM. haha.
      </p>

      {requests.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs border-t border-dim pt-3">
          {requests.slice(0, 6).map((r) => (
            <li key={r.id} className="flex justify-between gap-3 text-dim">
              <span>
                {r.problems_spent} PROBLEMS →{" "}
                {r.amount_troll ?? trollForProblems(r.problems_spent, r.rate_at_request)} $TROLL
              </span>
              <span className="shrink-0">
                {r.status === "pending" && <span className="text-problem">pending</span>}
                {r.status === "paid" && <span className="text-gain">sent</span>}
                {r.status === "refunded" && <span className="text-ghost">refunded</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pendingRequests.length > 0 && (
        <p className="text-ghost text-xs mt-2">{pendingRequests.length} waiting on review.</p>
      )}
    </>
  );
}
