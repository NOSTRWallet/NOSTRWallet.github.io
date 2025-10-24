import * as bitcoin from 'bitcoinjs-lib';
import { nip19 } from 'nostr-tools';
import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory, type ECPairAPI } from 'ecpair';

// Lazy initialization to avoid issues in test environment
let ECPair: ECPairAPI | null = null;

function getECPair(): ECPairAPI {
  if (!ECPair) {
    bitcoin.initEccLib(ecc);
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

export type BitcoinNetwork = 'mainnet' | 'testnet' | 'testnet4';

/**
 * Get bitcoinjs-lib network object based on network type
 */
export function getNetwork(network: BitcoinNetwork): bitcoin.networks.Network {
  // testnet4 uses the same network parameters as testnet3 in bitcoinjs-lib
  return (network === 'testnet' || network === 'testnet4') 
    ? bitcoin.networks.testnet 
    : bitcoin.networks.bitcoin;
}

/**
 * Get API base URL based on network
 */
export function getApiUrl(network: BitcoinNetwork): string {
  if (network === 'testnet4') {
    return 'https://mempool.space/testnet4/api';
  } else if (network === 'testnet') {
    return 'https://mempool.space/testnet/api';
  }
  return 'https://mempool.space/api';
}

/**
 * Get Blockstream API base URL based on network (deprecated, use getApiUrl instead)
 */
export function getBlockstreamApiUrl(network: BitcoinNetwork): string {
  return getApiUrl(network);
}

/**
 * Convert Nostr pubkey (hex) to Bitcoin Taproot address
 */
export function nostrPubkeyToBitcoinAddress(pubkeyHex: string, network: BitcoinNetwork = 'mainnet'): string {
  try {
    const pubkeyBuffer = Buffer.from(pubkeyHex, 'hex');

    const { address } = bitcoin.payments.p2tr({
      internalPubkey: pubkeyBuffer,
      network: getNetwork(network),
    });

    return address || '';
  } catch (error) {
    console.error('Error generating Bitcoin address:', error);
    return '';
  }
}

/**
 * Convert npub to Bitcoin Taproot address
 */
export function npubToBitcoinAddress(npub: string, network: BitcoinNetwork = 'mainnet'): string {
  try {
    const decoded = nip19.decode(npub);

    if (decoded.type !== 'npub') {
      throw new Error('Invalid npub format');
    }

    const pubkeyHex = decoded.data as string;
    return nostrPubkeyToBitcoinAddress(pubkeyHex, network);
  } catch (error) {
    console.error('Error converting npub to Bitcoin address:', error);
    throw error;
  }
}

/**
 * Interface for UTXO (Unspent Transaction Output)
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Fetch UTXOs for a Bitcoin address from API
 */
export async function fetchUTXOs(address: string, network: BitcoinNetwork = 'mainnet'): Promise<UTXO[]> {
  const apiUrl = getApiUrl(network);
  const response = await fetch(`${apiUrl}/address/${address}/utxo`);

  if (!response.ok) {
    throw new Error('Failed to fetch UTXOs');
  }

  return response.json();
}

/**
 * Get recommended fee rates from API
 */
export async function getFeeRates(network: BitcoinNetwork = 'mainnet'): Promise<{
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}> {
  const apiUrl = getApiUrl(network);
  const response = await fetch(`${apiUrl}/v1/fees/recommended`);

  if (!response.ok) {
    throw new Error('Failed to fetch fee estimates');
  }

  const data = await response.json();

  return {
    fastestFee: data.fastestFee || 1,
    halfHourFee: data.halfHourFee || 1,
    hourFee: data.hourFee || 1,
    economyFee: data.economyFee || 1,
    minimumFee: data.minimumFee || 1,
  };
}

/**
 * Broadcast a transaction to the Bitcoin network
 */
export async function broadcastTransaction(txHex: string, network: BitcoinNetwork = 'mainnet'): Promise<string> {
  const apiUrl = getApiUrl(network);
  const response = await fetch(`${apiUrl}/tx`, {
    method: 'POST',
    body: txHex,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to broadcast transaction: ${error}`);
  }

  return response.text(); // Returns the transaction ID
}

/**
 * Create and sign a Bitcoin transaction
 * @param privateKeyHex - Private key in hex format (from Nostr nsec)
 * @param toAddress - Recipient Bitcoin address
 * @param amountSats - Amount to send in satoshis
 * @param utxos - Available UTXOs
 * @param feeRate - Fee rate in sat/vB
 * @param network - Bitcoin network (mainnet or testnet)
 * @returns Signed transaction hex
 */
export async function createBitcoinTransaction(
  privateKeyHex: string,
  toAddress: string,
  amountSats: number,
  utxos: UTXO[],
  feeRate: number,
  network: BitcoinNetwork = 'mainnet'
): Promise<{ txHex: string; fee: number }> {
  // Create key pair from private key
  const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
  const keyPair = getECPair().fromPrivateKey(privateKeyBuffer);

  // Get x-only public key (32 bytes) for Taproot
  // Remove the first byte (compression flag) from the 33-byte compressed pubkey
  const internalPubkey = keyPair.publicKey.slice(1, 33);

  const btcNetwork = getNetwork(network);

  // Get sender's address for change
  const { address: changeAddress } = bitcoin.payments.p2tr({
    internalPubkey,
    network: btcNetwork,
  });

  if (!changeAddress) {
    throw new Error('Failed to generate change address');
  }

  // Create transaction builder
  const psbt = new bitcoin.Psbt({ network: btcNetwork });

  // Add inputs (UTXOs)
  let totalInput = 0;
  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoin.payments.p2tr({
          internalPubkey,
          network: btcNetwork,
        }).output!,
        value: BigInt(utxo.value),
      },
      tapInternalKey: internalPubkey,
    });

    totalInput += utxo.value;
  }

  // Estimate transaction size
  // P2TR input: ~57.5 vBytes, P2TR output: ~43 vBytes
  const estimatedSize = utxos.length * 57.5 + 2 * 43 + 10.5; // 2 outputs (recipient + change) + overhead
  const estimatedFee = Math.ceil(estimatedSize * feeRate);

  // Calculate change
  const change = totalInput - amountSats - estimatedFee;

  if (change < 0) {
    throw new Error(
      `Insufficient funds. Need ${amountSats + estimatedFee} sats, have ${totalInput} sats`
    );
  }

  // Add output for recipient
  psbt.addOutput({
    address: toAddress,
    value: BigInt(amountSats),
  });

  // Add change output if significant (> dust limit)
  const dustLimit = 546; // Standard dust limit for Bitcoin
  if (change > dustLimit) {
    psbt.addOutput({
      address: changeAddress,
      value: BigInt(change),
    });
  }

  // Create a Taproot signer
  // For Taproot key-path spending, we need to tweak the private key
  const tweakedSigner = keyPair.tweak(
    bitcoin.crypto.taggedHash('TapTweak', internalPubkey)
  );

  // Sign all inputs
  for (let i = 0; i < utxos.length; i++) {
    psbt.signInput(i, tweakedSigner);
  }

  // Finalize and extract transaction
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    txHex: tx.toHex(),
    fee: estimatedFee,
  };
}

/**
 * Convert satoshis to BTC
 */
export function satsToBTC(sats: number): string {
  return (sats / 100000000).toFixed(8);
}

/**
 * Convert BTC to satoshis
 */
export function btcToSats(btc: number): number {
  return Math.round(btc * 100000000);
}
