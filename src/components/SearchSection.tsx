"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

interface Suggestion {
  symbol: string;
  companyName: string;
  exchange?: string;
}

interface SearchSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
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
}

export function SearchSection({
  searchQuery,
  setSearchQuery,
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
          onSelectSuggestion(sel.symbol, `${sel.companyName}`);
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

  return (
    <div className="mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Label htmlFor="search" className="sr-only">
                企業検索
              </Label>
              <Input
                id="search"
                placeholder="証券コード、ティッカーシンボル、または企業名で検索（例: 7203, AAPL, トヨタ自動車）"
                value={searchQuery}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11"
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 100);
                }}
              />
              {/* サジェストドロップダウン */}
              {showSuggestions &&
                (suggestions.length > 0 || isSuggestLoading) && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-md border bg-card shadow">
                    {searchQuery.trim() && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
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
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        候補を取得中...
                      </div>
                    )}
                    {!isSuggestLoading &&
                      suggestions.map((sug, idx) => (
                        <button
                          key={`${sug.symbol}-${idx}`}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${
                            idx === activeSuggestion ? "bg-accent" : ""
                          }`}
                          onMouseEnter={() => setActiveSuggestion(idx)}
                          onMouseDown={e => {
                            e.preventDefault();
                            onSelectSuggestion(sug.symbol, `${sug.companyName}`);
                          }}
                        >
                          <span className="font-medium">
                            {renderHighlighted(sug.companyName, searchQuery)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {renderHighlighted(sug.symbol, searchQuery)}
                            {sug.exchange ? ` · ${sug.exchange}` : ""}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
            </div>
            <Button
              onClick={onSearch}
              disabled={!searchQuery.trim() || isLoading}
              size="lg"
              className="px-8"
            >
              <Search className="h-4 w-4 mr-2" />
              {isLoading ? "検索中..." : "企業を検索"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

