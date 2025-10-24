import { useSeoMeta } from '@unhead/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, Bitcoin, KeyRound, RefreshCw, Wallet, Send, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import { useQuery } from '@tanstack/react-query';
import { SendBitcoinDialog } from '@/components/SendBitcoinDialog';
import { useNsecAccess } from '@/hooks/useNsecAccess';
import { useAppContext } from '@/hooks/useAppContext';
import { BitcoinNetworkSelector } from '@/components/BitcoinNetworkSelector';
import { getNetwork, getApiUrl } from '@/lib/bitcoin';

const Index = () => {
  useSeoMeta({
    title: 'NOSTR Wallet - Bitcoin Wallet Powered by Nostr Protocol',
    description: 'Professional Bitcoin wallet integrated with Nostr. Send, receive, and manage Bitcoin seamlessly using your Nostr identity.',
  });

  const { user } = useCurrentUser();
  const { hasNsecAccess } = useNsecAccess();
  const { config } = useAppContext();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPubkey, setCopiedPubkey] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

  const network = config.bitcoinNetwork;

  // Generate Bitcoin address based on current network
  const bitcoinAddress = useMemo(() => {
    if (!user) return '';
    
    try {
      const pubkeyBuffer = Buffer.from(user.pubkey, 'hex');
      const { address } = bitcoin.payments.p2tr({
        internalPubkey: pubkeyBuffer,
        network: getNetwork(network),
      });
      return address || '';
    } catch (error) {
      console.error('Error generating Bitcoin address:', error);
      return '';
    }
  }, [user, network]);

  const { data: addressData, isLoading: isLoadingBalance, error: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ['bitcoin-balance', bitcoinAddress, network],
    queryFn: async () => {
      if (!bitcoinAddress) return null;

      const apiUrl = getApiUrl(network);
      console.log(`Fetching balance for ${network}:`, bitcoinAddress, 'from', apiUrl);
      
      const response = await fetch(`${apiUrl}/address/${bitcoinAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      const confirmedBalance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      const pendingBalance = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;

      return {
        balance: confirmedBalance,
        pendingBalance: pendingBalance,
        totalBalance: confirmedBalance + pendingBalance,
        totalReceived: data.chain_stats.funded_txo_sum,
        totalSent: data.chain_stats.spent_txo_sum,
        txCount: data.chain_stats.tx_count,
        pendingTxCount: data.mempool_stats.tx_count,
      };
    },
    enabled: !!bitcoinAddress,
    staleTime: 0, // Always fetch fresh data when network changes
    refetchInterval: 30000,
  });

  const satsToBTC = (sats: number) => (sats / 100000000).toFixed(8);

  const copyToClipboard = async (text: string, type: 'address' | 'pubkey') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedPubkey(true);
        setTimeout(() => setCopiedPubkey(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-gray-900 dark:text-white" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NOSTR Wallet</h1>
            </div>
            <div className="flex items-center gap-4">
              <BitcoinNetworkSelector />
              {user && <LoginArea className="max-w-xs" />}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {!user ? (
            <div className="space-y-8">
              <div className="text-center space-y-4 py-12">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                  Bitcoin meets Nostr
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                  Manage your Bitcoin seamlessly using your Nostr identity. One key for both protocols.
                </p>
              </div>

              <Card className="border-2">
                <CardHeader className="text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <KeyRound className="w-8 h-8 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
                  <CardDescription className="text-base">
                    Log in with your Nostr account to access your Bitcoin wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
                  <LoginArea className="max-w-sm w-full" />
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-3 gap-6 pt-8">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mx-auto">
                    <Bitcoin className="w-6 h-6 text-gray-900 dark:text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Taproot Native</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Modern Bitcoin addresses using Taproot technology
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mx-auto">
                    <KeyRound className="w-6 h-6 text-gray-900 dark:text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Non-Custodial</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your keys, your Bitcoin. Full control over your funds
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mx-auto">
                    <Wallet className="w-6 h-6 text-gray-900 dark:text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Unified Identity</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    One Nostr key for social and financial interactions
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Balance</CardTitle>
                        <CardDescription>Live from Bitcoin blockchain</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => refetchBalance()} disabled={isLoadingBalance} className="h-10 w-10 p-0">
                      <RefreshCw className={`w-4 h-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingBalance ? (
                    <div className="space-y-4">
                      <Skeleton className="h-24 w-full" />
                      <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    </div>
                  ) : balanceError ? (
                    <div className="text-center py-8 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-700 dark:text-red-400">Failed to fetch balance. Please try again.</p>
                    </div>
                  ) : addressData ? (
                    <>
                      <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-lg border">
                        <div className="text-center space-y-3">
                          {(network === 'testnet' || network === 'testnet4') && (
                            <div className="flex justify-center mb-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-xs font-medium rounded-full border border-orange-300 dark:border-orange-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                {network === 'testnet4' ? 'Testnet4' : 'Testnet3'}
                              </span>
                            </div>
                          )}
                          <div className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                            {satsToBTC(addressData.totalBalance)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                            BTC ({addressData.totalBalance.toLocaleString()} sats)
                          </div>
                          {addressData.pendingBalance > 0 && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                              <div className="flex items-center justify-center gap-6 text-xs">
                                <span className="text-gray-700 dark:text-gray-300">
                                  Confirmed: {satsToBTC(addressData.balance)} BTC
                                </span>
                                <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" />
                                  Pending: {satsToBTC(addressData.pendingBalance)} BTC
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Received</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{satsToBTC(addressData.totalReceived)}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sent</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{satsToBTC(addressData.totalSent)}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Transactions</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {addressData.txCount}
                            {addressData.pendingTxCount > 0 && <span className="text-amber-600"> (+{addressData.pendingTxCount})</span>}
                          </div>
                        </div>
                      </div>

                      <Button onClick={() => setIsSendDialogOpen(true)} disabled={!hasNsecAccess || (addressData?.totalBalance || 0) === 0} className="w-full h-12" size="lg">
                        <Send className="w-4 h-4 mr-2" />
                        Send Bitcoin
                      </Button>
                      {!hasNsecAccess && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <p className="text-xs text-center text-amber-800 dark:text-amber-300">Sending requires nsec login for security</p>
                        </div>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <SendBitcoinDialog isOpen={isSendDialogOpen} onClose={() => setIsSendDialogOpen(false)} />

              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <Bitcoin className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <CardTitle>Bitcoin Address</CardTitle>
                      <CardDescription>Derived from your Nostr public key</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-lg border">
                    <p className="font-mono text-sm break-all text-center text-gray-900 dark:text-white">{bitcoinAddress}</p>
                  </div>
                  <Button onClick={() => copyToClipboard(bitcoinAddress, 'address')} variant="outline" className="w-full">
                    {copiedAddress ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Address
                      </>
                    )}
                  </Button>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-900 dark:text-amber-300">
                        Ensure you have secure access to your Nostr private key to spend these funds. The same key works for both protocols.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <CardTitle>Nostr Public Key</CardTitle>
                      <CardDescription>Your Nostr identity</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
                    <p className="font-mono text-xs break-all text-gray-700 dark:text-gray-300">{user.pubkey}</p>
                  </div>
                  <Button onClick={() => copyToClipboard(user.pubkey, 'pubkey')} variant="outline" className="w-full">
                    {copiedPubkey ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Public Key
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-50 dark:bg-gray-900">
                <CardHeader>
                  <CardTitle className="text-lg">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white mb-1">Same Cryptography</p>
                      <p className="text-gray-600 dark:text-gray-400">Both Nostr and Bitcoin Taproot use secp256k1 with Schnorr signatures (BIP 340).</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white mb-1">Direct Conversion</p>
                      <p className="text-gray-600 dark:text-gray-400">Your Nostr public key is used directly as a Bitcoin Taproot address (bc1p).</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white mb-1">Spending Funds</p>
                      <p className="text-gray-600 dark:text-gray-400">Use your Nostr private key with Bitcoin wallet software supporting Taproot.</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs text-amber-900 dark:text-amber-300">
                        <strong>Note:</strong> This is experimental technology. Test with small amounts first and ensure you have secure backups of your private key.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Made with ♥ by the NOSTR Wallet Team.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
