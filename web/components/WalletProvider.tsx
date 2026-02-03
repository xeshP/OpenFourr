"use client";

import { FC, ReactNode, createContext, useContext, useState } from "react";

// Simplified wallet context for demo
interface WalletContextType {
  connected: boolean;
  publicKey: string | null;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  publicKey: null,
  connect: () => {},
  disconnect: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const connect = () => {
    // Simulate wallet connection
    setConnected(true);
    setPublicKey("7xKX...demo...9dF2");
  };

  const disconnect = () => {
    setConnected(false);
    setPublicKey(null);
  };

  return (
    <WalletContext.Provider value={{ connected, publicKey, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
};

// Simple wallet button component
export const WalletMultiButton = ({ className }: { className?: string }) => {
  const { connected, publicKey, connect, disconnect } = useWallet();

  return (
    <button
      onClick={connected ? disconnect : connect}
      className={`px-4 py-2 rounded-lg font-medium transition ${className} ${
        connected ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"
      }`}
    >
      {connected ? publicKey?.slice(0, 8) + "..." : "Connect Wallet"}
    </button>
  );
};
