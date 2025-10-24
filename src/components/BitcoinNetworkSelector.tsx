import { Network } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppContext } from '@/hooks/useAppContext';
import type { BitcoinNetwork } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

interface BitcoinNetworkSelectorProps {
  className?: string;
}

export function BitcoinNetworkSelector({ className }: BitcoinNetworkSelectorProps) {
  const { config, updateConfig } = useAppContext();

  const handleNetworkChange = (network: BitcoinNetwork) => {
    updateConfig(() => ({ bitcoinNetwork: network }));
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Network className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      <Select value={config.bitcoinNetwork} onValueChange={handleNetworkChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mainnet">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Mainnet</span>
            </div>
          </SelectItem>
          <SelectItem value="testnet4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Testnet4</span>
            </div>
          </SelectItem>
          <SelectItem value="testnet">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Testnet3</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
