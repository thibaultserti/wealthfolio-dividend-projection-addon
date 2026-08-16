import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HostAPI, Account } from '@wealthfolio/addon-sdk';
import type { AccountScope } from '../types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wealthfolio/ui';
import { ChevronDown, Folder, Layers, Wallet } from 'lucide-react';

interface AccountScopeFilterProps {
  api: HostAPI;
  scope: AccountScope;
  onScopeChange: (scope: AccountScope) => void;
}

export const AccountScopeFilter: React.FC<AccountScopeFilterProps> = ({
  api,
  scope,
  onScopeChange,
}) => {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-scope-list'],
    queryFn: async () => {
      try {
        return await api.accounts.getAll();
      } catch {
        return [] as Account[];
      }
    },
    staleTime: 300_000,
  });

  const activeAccounts = accounts.filter((a) => !a.isArchived);

  // Group accounts by group name if available
  const groups = Array.from(
    new Set(activeAccounts.map((a) => a.group).filter((g): g is string => Boolean(g && g.trim()))),
  );

  let triggerLabel = 'All Accounts';
  if (scope.type === 'group') {
    triggerLabel = `Group: ${scope.label || scope.id}`;
  } else if (scope.type === 'account') {
    const acc = activeAccounts.find((a) => a.id === scope.id);
    triggerLabel = acc ? acc.name : 'Account';
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 h-9 px-3 text-sm font-medium">
          {scope.type === 'all' && <Layers className="w-4 h-4 text-primary" />}
          {scope.type === 'group' && <Folder className="w-4 h-4 text-amber-500" />}
          {scope.type === 'account' && <Wallet className="w-4 h-4 text-blue-500" />}
          <span className="truncate max-w-[140px] sm:max-w-[200px]">{triggerLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => onScopeChange({ type: 'all', label: 'All Accounts' })}
          className="flex items-center gap-2 font-medium"
        >
          <Layers className="w-4 h-4 text-primary" />
          <span>All Accounts</span>
        </DropdownMenuItem>

        {groups.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
              Account Groups
            </DropdownMenuLabel>
            {groups.map((group) => (
              <DropdownMenuItem
                key={group}
                onClick={() => onScopeChange({ type: 'group', id: group, label: group })}
                className="flex items-center gap-2"
              >
                <Folder className="w-4 h-4 text-amber-500" />
                <span className="truncate">{group}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {activeAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
              Individual Accounts
            </DropdownMenuLabel>
            {activeAccounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                onClick={() =>
                  onScopeChange({
                    type: 'account',
                    id: account.id,
                    label: account.name,
                  })
                }
                className="flex items-center gap-2"
              >
                <Wallet className="w-4 h-4 text-blue-500" />
                <span className="truncate">{account.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
