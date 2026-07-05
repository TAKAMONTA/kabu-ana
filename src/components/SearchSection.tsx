"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeDisplayText } from "@/lib/displayText";
import { Search } from "lucide-react";

interface Suggestion {
  symbol: string;
  companyName: string;
  exchange?: string;
}

interface SearchSectionProps {
  searchQuery: string;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  activeSuggestion: number;
  setActiveSuggestion: (index: number) => void;
  suggestions: Suggestion[];
  isSuggestLoading: boolean;
  isLoading: boolean;
  onSearch: () => void;
  onInputChange: (value: string) => void;
  onSelectSuggestion: (symbol: string, displayText?: string) => void;
  renderHighlighted: (text: string, query: string) => React.ReactNode;
  remainingUses?: number;
  isPremium?: boolean;
}

export function SearchSection({
  searchQuery,
  showSuggestions,
  setShowSuggestions,
  activeSuggestion,
  setActiveSuggestion,
  suggestions,
  isSuggestLoading,
  isLoading,
  onSearch,
  onInputChange,
  onSelectSuggestion,
  renderHighlighted,
  remainingUses,
  isPremium,
}: SearchSectionProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === "Enter") onSearch();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion(
          activeSuggestion < suggestions.length - 1 ? activeSuggestion + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion(
          activeSuggestion > 0 ? activeSuggestion - 1 : suggestions.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const sel =
          activeSuggestion >= 0 ? suggestions[activeSuggestion] : null;
        if (sel?.symbol) {
          onSelectSuggestion(sel.symbol, normalizeDisplayText(sel.companyName));
        } else {
          onSearch();
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      }
    },
    [
      showSuggestions,
      suggestions,
      activeSuggestion,
      onSearch,
      onSelectSuggestion,
      setActiveSuggestion,
      setShowSuggestions,
    ]
  );

  const showSuggestionList =
    showSuggestions && (suggestions.length > 0 || isSuggestLoading);
  const activeOptionId =
    showSuggestionList &&
    !isSuggestLoading &&
    activeSuggestion >= 0 &&
    activeSuggestion < suggestions.length
      ? `search-suggestion-${activeSuggestion}`
      : undefined;

  return (
    <div>
      <div className="rounded-2xl border border-border/70 bg-background p-2 shadow-sm transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 focus-within:ring-offset-2 focus-within:ring-offset-background">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Label htmlFor="search" className="sr-only">
              企業検索
            </Label>
            <Input
              id="search"
              placeholder="証券コード・企業名で検索（例: 7203, AAPL, トヨタ）"
              value={searchQuery}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-0"
              onFocus={() => {
                if (suggestions.length > 0 || isSuggestLoading) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 100);
              }}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={showSuggestionList ? "search-suggestions" : undefined}
              aria-expanded={showSuggestionList}
              aria-activedescendant={activeOptionId}
            />
            {showSuggestionList && (
              <div className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-lg">
                {searchQuery.trim() && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                    onMouseDown={e => {
                      e.preventDefault();
                      onSearch();
                    }}
                  >
                    <span className="text-muted-foreground">検索:</span>
                    <span className="font-medium">{searchQuery.trim()}</span>
                  </button>
                )}

                {isSuggestLoading && (
                  <div
                    className="px-4 py-3 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    候補を取得中...
                  </div>
                )}
                <ul
                  id="search-suggestions"
                  role="listbox"
                  aria-label="検索候補"
                  className="m-0 list-none p-0"
                >
                  {!isSuggestLoading &&
                    suggestions.map((sug, idx) => {
                      const companyName = normalizeDisplayText(sug.companyName);
                      const exchange = sug.exchange
                        ? normalizeDisplayText(sug.exchange)
                        : "";

                      return (
                        <li
                          key={`${sug.symbol}-${idx}`}
                          id={`search-suggestion-${idx}`}
                          role="option"
                          aria-selected={idx === activeSuggestion}
                        >
                          <button
                            type="button"
                            tabIndex={-1}
                            className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-accent ${
                              idx === activeSuggestion ? "bg-accent" : ""
                            }`}
                            onMouseEnter={() => setActiveSuggestion(idx)}
                            onMouseDown={e => {
                              e.preventDefault();
                              onSelectSuggestion(sug.symbol, companyName);
                            }}
                          >
                            <span className="font-medium">
                              {renderHighlighted(companyName, searchQuery)}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {renderHighlighted(sug.symbol, searchQuery)}
                              {exchange ? ` · ${exchange}` : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
          <Button
            onClick={onSearch}
            disabled={!searchQuery.trim() || isLoading}
            size="lg"
            className="h-12 w-full rounded-xl bg-foreground px-6 text-background hover:bg-foreground/90 disabled:opacity-50 sm:w-auto"
          >
            <Search className="mr-2 h-4 w-4" />
            {isLoading ? "取得中..." : "検索・AI分析"}
          </Button>
        </div>
      </div>
      {!isPremium && typeof remainingUses === "number" && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          検索すると自動でAI分析が実行されます（無料枠 本日あと{remainingUses}回）
        </p>
      )}
    </div>
  );
}
