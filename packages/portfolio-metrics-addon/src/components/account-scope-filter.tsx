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

  // Extract distinct portfolio / groups
  const groups = Array.from(
    new Set(activeAccounts.map((a) => a.group).filter((g): g is string => Boolean(g && g.trim()))),
  );

  let triggerLabel = 'Tous les comptes';
  if (scope.type === 'group') {
    triggerLabel = `Portefeuille : ${scope.label || scope.id}`;
  } else if (scope.type === 'account') {
    const acc = activeAccounts.find((a) => a.id === scope.id);
    triggerLabel = acc ? acc.name : 'Compte';
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 h-9 px-3 text-sm font-medium">
          {scope.type === 'all' && <Layers className="w-4 h-4 text-primary" />}
          {scope.type === 'group' && <Folder className="w-4 h-4 text-amber-500" />}
          {scope.type === 'account' && <Wallet className="w-4 h-4 text-blue-500" />}
          <span>{triggerLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onScopeChange({ type: 'all', label: 'Tous les comptes' })}
          className={`flex items-center gap-2 cursor-pointer ${scope.type === 'all' ? 'bg-accent font-medium' : ''}`}
        >
          <Layers className="w-4 h-4 text-primary" />
          <span>Tous les comptes</span>
          <span className="ml-auto text-xs text-muted-foreground">({activeAccounts.length})</span>
        </DropdownMenuItem>

        {groups.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wider px-2 py-1">
              Portefeuilles & Groupes
            </DropdownMenuLabel>
            {groups.map((group) => {
              const groupCount = activeAccounts.filter((a) => a.group === group).length;
              const isSelected = scope.type === 'group' && scope.id === group;
              return (
                <DropdownMenuItem
                  key={group}
                  onClick={() => onScopeChange({ type: 'group', id: group, label: group })}
                  className={`flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-accent font-medium' : ''}`}
                >
                  <Folder className="w-4 h-4 text-amber-500" />
                  <span className="truncate">{group}</span>
                  <span className="ml-auto text-xs text-muted-foreground">({groupCount})</span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wider px-2 py-1">
          Comptes individuels
        </DropdownMenuLabel>
        {activeAccounts.map((account) => {
          const isSelected = scope.type === 'account' && scope.id === account.id;
          return (
            <DropdownMenuItem
              key={account.id}
              onClick={() =>
                onScopeChange({
                  type: 'account',
                  id: account.id,
                  label: account.name,
                })
              }
              className={`flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-accent font-medium' : ''}`}
            >
              <Wallet className="w-4 h-4 text-blue-500" />
              <div className="flex flex-col truncate">
                <span className="truncate">{account.name}</span>
                {account.group && (
                  <span className="text-[10px] text-muted-foreground truncate">{account.group}</span>
                )}
              </div>
              <span className="ml-auto text-xs text-muted-foreground uppercase">{account.currency}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
