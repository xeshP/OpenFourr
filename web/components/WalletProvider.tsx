"use client";

import { FC, ReactNode, useMemo, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletError } from "@solana/wallet-adapter-base";
import { SOLANA_RPC } from "@/lib/constants";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: ReactNode;
}

const WalletProviderInner: FC<Props> = ({ children }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const onError = useCallback((error: WalletError) => {
    console.error("Wallet error:", error);
  }, []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <SolanaWalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

// Wrap entire provider to avoid SSR hydration issues
export const WalletContextProvider: FC<Props> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <WalletProviderInner>{children}</WalletProviderInner>;
};

// Dynamically import the wallet button to avoid SSR issues
const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <button className="px-4 py-2 bg-fiverr-green text-white rounded font-semibold">Connect Wallet</button> }
);

// Re-export wallet button with custom styling
export const WalletMultiButton: FC<{ className?: string }> = ({ className }) => {
  return <WalletMultiButtonDynamic className={className} />;
};

// Export useWallet hook
export { useWallet };
