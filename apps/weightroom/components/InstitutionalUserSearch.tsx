"use client";

import { Search, UserPlus } from "lucide-react";

export type InstitutionalUserSearchResult = {
  id: string;
  name: string;
  username: string;
};

type InstitutionalUserSearchProps = {
  emptyMessage: string;
  inputId: string;
  onQueryChange: (query: string) => void;
  onSelect: (result: InstitutionalUserSearchResult) => void;
  placeholder: string;
  query: string;
  results: InstitutionalUserSearchResult[];
  selectLabel: string;
};

export function InstitutionalUserSearch({
  emptyMessage,
  inputId,
  onQueryChange,
  onSelect,
  placeholder,
  query,
  results,
  selectLabel,
}: InstitutionalUserSearchProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="relative block" htmlFor={inputId}>
        <span className="sr-only">{placeholder}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="gusm-input-primary w-full pl-10"
        />
      </label>

      <div className="flex flex-col divide-y divide-accent/15">
        {results.length === 0 ? (
          <p className="px-1 py-3 text-sm text-dim">{emptyMessage}</p>
        ) : (
          results.map((result) => (
            <div key={result.id} className="flex min-h-12 items-center justify-between gap-3 px-1">
              <span className="min-w-0">
                <span className="block truncate text-base text-foreground">{result.name}</span>
                <span className="block truncate text-sm text-muted">{result.username}</span>
              </span>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-base text-accent transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98]"
              >
                <UserPlus className="size-4" aria-hidden="true" />
                {selectLabel}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
