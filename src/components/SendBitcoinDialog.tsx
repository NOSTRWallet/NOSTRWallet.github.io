import { useState } from 'react';
import { Send, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNsecAccess } from '@/hooks/useNsecAccess';
import { useAppContext } from '@/hooks/useAppContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  npubToBitcoinAddress,
  nostrPubkeyToBitcoinAddress,
  fetchUTXOs,
  getFeeRates,
  createBitcoinTransaction,
  broadcastTransaction,
  satsToBTC,
  btcToSats,
  getApiUrl,
} from '@/lib/bitcoin';
import { useToast } from '@/hooks/useToast';

interface SendBitcoinDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeeSpeed = 'fastest' | 'halfHour' | 'hour' | 'economy';

export function SendBitcoinDialog({ isOpen, onClose }: SendBitcoinDialogProps) {
  const { user } = useCurrentUser();
  const { hasNsecAccess, getPrivateKey } = useNsecAccess();
  const { config } = useAppContext();
  const { toast } = useToast();

  const network = config.bitcoinNetwork;

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed>('halfHour');
  const [error, setError] = useState('');
  const [txId, setTxId] = useState('');

  const senderAddress = user ? nostrPubkeyToBitcoinAddress(user.pubkey, network) : '';

  // Fetch UTXOs
  const { data: utxos, isLoading: isLoadingUtxos } = useQuery({
    queryKey: ['utxos', senderAddress, network],
    queryFn: () => fetchUTXOs(senderAddress, network),
    enabled: !!senderAddress && isOpen,
    staleTime: 0,
  });

  // Fetch fee rates
  const { data: feeRates, isLoading: isLoadingFees } = useQuery({
    queryKey: ['fee-rates', network],
    queryFn: () => getFeeRates(network),
    enabled: isOpen,
    staleTime: 0,
  });

  // Calculate total balance
  const totalBalance = utxos?.reduce((sum, utxo) => sum + utxo.value, 0) || 0;

  // Send transaction mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user || !hasNsecAccess) {
        throw new Error('You must be logged in with nsec to send Bitcoin');
      }

      const privateKey = getPrivateKey();
      if (!privateKey) {
        throw new Error('Failed to access private key');
      }

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      if (!feeRates) {
        throw new Error('Fee rates not loaded');
      }

      // Parse recipient address
      let recipientAddress: string;
      try {
        if (recipient.startsWith('npub1')) {
          recipientAddress = npubToBitcoinAddress(recipient, network);
        } else if (recipient.startsWith('bc1') || recipient.startsWith('tb1')) {
          recipientAddress = recipient;
        } else {
          throw new Error('Invalid recipient format');
        }
      } catch {
        throw new Error('Invalid recipient address or npub');
      }

      // Parse amount
      const amountSats = btcToSats(parseFloat(amount));
      if (isNaN(amountSats) || amountSats <= 0) {
        throw new Error('Invalid amount');
      }

      // Get fee rate based on speed
      const feeRateMap: Record<FeeSpeed, number> = {
        fastest: feeRates.fastestFee,
        halfHour: feeRates.halfHourFee,
        hour: feeRates.hourFee,
        economy: feeRates.economyFee,
      };
      const feeRate = feeRateMap[feeSpeed];

      // Create and sign transaction
      const { txHex, fee } = await createBitcoinTransaction(
        privateKey,
        recipientAddress,
        amountSats,
        utxos,
        feeRate,
        network
      );

      // Broadcast transaction
      const txId = await broadcastTransaction(txHex, network);

      return { txId, fee };
    },
    onSuccess: ({ txId, fee }) => {
      setTxId(txId);
      toast({
        title: 'Transaction sent!',
        description: `Fee: ${satsToBTC(fee)} BTC`,
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: 'Transaction failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    setError('');
    setTxId('');
    sendMutation.mutate();
  };

  const handleClose = () => {
    setRecipient('');
    setAmount('');
    setError('');
    setTxId('');
    setFeeSpeed('halfHour');
    onClose();
  };

  // Show success state
  if (txId) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Transaction Sent!
            </DialogTitle>
            <DialogDescription>
              Your Bitcoin transaction has been broadcast to the network
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <Label className="text-sm text-green-800 dark:text-green-200">
                Transaction ID
              </Label>
              <p className="font-mono text-xs break-all mt-1 text-green-900 dark:text-green-100">
                {txId}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const explorerUrl = getApiUrl(network).replace('/api', '');
                  window.open(`${explorerUrl}/tx/${txId}`, '_blank');
                }}
              >
                View on Explorer
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show not available for non-nsec users
  if (!hasNsecAccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Nsec Required
            </DialogTitle>
            <DialogDescription>
              Sending Bitcoin requires direct access to your private key
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This feature is only available when logged in with your nsec (secret key).
              Browser extensions and bunker connections don't provide access to the private
              key needed to sign Bitcoin transactions.
            </AlertDescription>
          </Alert>
          <Button onClick={handleClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-500" />
            Send Bitcoin
          </DialogTitle>
          <DialogDescription>
            Send Bitcoin to another Nostr user or Bitcoin address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Balance Display */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <Label className="text-sm text-gray-600 dark:text-gray-400">
              Available Balance
            </Label>
            {isLoadingUtxos ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {satsToBTC(totalBalance)} BTC
              </p>
            )}
          </div>

          {/* Recipient Input */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient</Label>
            <Input
              id="recipient"
              placeholder={network === 'mainnet' ? 'npub1... or bc1p...' : 'npub1... or tb1...'}
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setError('');
              }}
            />
            <p className="text-xs text-gray-500">
              Enter a Nostr npub or Bitcoin {network !== 'mainnet' ? `${network} ` : ''}address
            </p>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (BTC)</Label>
            <Input
              id="amount"
              type="number"
              step="0.00000001"
              min="0"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {amount ? `${btcToSats(parseFloat(amount) || 0).toLocaleString()} sats` : ''}
              </span>
              <button
                type="button"
                onClick={() => setAmount(satsToBTC(totalBalance))}
                className="text-orange-600 hover:text-orange-700"
              >
                Send Max
              </button>
            </div>
          </div>

          {/* Fee Speed Selection */}
          <div className="space-y-2">
            <Label htmlFor="fee-speed">Transaction Speed</Label>
            <Select value={feeSpeed} onValueChange={(v) => setFeeSpeed(v as FeeSpeed)}>
              <SelectTrigger id="fee-speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fastest">
                  Fastest (~10 min) - {isLoadingFees ? '...' : `${feeRates?.fastestFee} sat/vB`}
                </SelectItem>
                <SelectItem value="halfHour">
                  Half Hour - {isLoadingFees ? '...' : `${feeRates?.halfHourFee} sat/vB`}
                </SelectItem>
                <SelectItem value="hour">
                  One Hour - {isLoadingFees ? '...' : `${feeRates?.hourFee} sat/vB`}
                </SelectItem>
                <SelectItem value="economy">
                  Economy (~1 day) - {isLoadingFees ? '...' : `${feeRates?.economyFee} sat/vB`}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Warning:</strong> This is an experimental feature. Always test with small
              amounts first. Transactions cannot be reversed.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                !recipient ||
                !amount ||
                parseFloat(amount) <= 0 ||
                isLoadingUtxos ||
                isLoadingFees ||
                sendMutation.isPending
              }
              className="flex-1"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
