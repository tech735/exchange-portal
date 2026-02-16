import * as React from 'react';
import { Search, History, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/use-debounce';
import { supabase } from '@/integrations/supabase/client';
import { Command as CommandPrimitive } from 'cmdk';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchResult {
    id: string;
    order_id: string;
    customer_name: string;
    customer_phone: string;
    stage: string;
}

export function GlobalSearch() {
    const navigate = useNavigate();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
    const debouncedQuery = useDebounce(query, 300);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    // Handle click outside to close
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load recent searches
    React.useEffect(() => {
        const saved = localStorage.getItem('recent_searches');
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse recent searches', e);
            }
        }
    }, []);

    const addRecentSearch = (term: string) => {
        if (!term.trim()) return;
        const newRecent = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
        setRecentSearches(newRecent);
        localStorage.setItem('recent_searches', JSON.stringify(newRecent));
    };

    const removeRecentSearch = (term: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newRecent = recentSearches.filter(s => s !== term);
        setRecentSearches(newRecent);
        localStorage.setItem('recent_searches', JSON.stringify(newRecent));
    };

    React.useEffect(() => {
        async function fetchResults() {
            if (!debouncedQuery.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const { data } = await supabase
                    .from('tickets')
                    .select('id, order_id, customer_name, customer_phone, stage')
                    .or(`order_id.ilike.%${debouncedQuery}%,customer_name.ilike.%${debouncedQuery}%,customer_phone.ilike.%${debouncedQuery}%`)
                    .limit(5);

                if (data) {
                    setResults(data as SearchResult[]);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchResults();
    }, [debouncedQuery]);

    const handleSelect = (ticketId: string) => {
        setOpen(false);
        navigate(`/ticket/${ticketId}`);
        addRecentSearch(query);
        setQuery(''); // Clear query after selection or keep it? strict nav usually implies clearing or effectively moving away.
    };

    const handleSmartNav = () => {
        setOpen(false);
        addRecentSearch(query);

        if (results.length === 1) {
            navigate(`/ticket/${results[0].id}`);
            setQuery('');
        } else {
            navigate(`/dashboard?search=${encodeURIComponent(query)}`);
            // We might want to keep the query in the input if we go to dashboard
        }
    };

    return (
        <div ref={wrapperRef} className="relative max-w-md flex-1 z-50">
            <Command shouldFilter={false} className="overflow-visible bg-transparent">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <CommandPrimitive.Input
                        id="global-search-input"
                        className="flex h-11 w-full rounded-full bg-white px-10 text-sm outline-none placeholder:text-muted-foreground shadow-sm border border-transparent focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="Search tickets, orders, people"
                        value={query}
                        onValueChange={setQuery}
                        onFocus={() => setOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Prevent duplicated submissions
                                handleSmartNav();
                            }
                        }}
                    />
                </div>

                {open && (
                    <div className="absolute top-[calc(100%+8px)] left-0 w-full rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                        <CommandList className="max-h-[300px] overflow-y-auto p-2">
                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                {query ? 'No results found.' : 'No recent searches.'}
                            </CommandEmpty>

                            {results.length > 0 && (
                                <CommandGroup heading="Results">
                                    {results.map((ticket) => (
                                        <CommandItem
                                            key={ticket.id}
                                            onSelect={() => handleSelect(ticket.id)}
                                            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground rounded-md transition-colors"
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                                <Search className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-medium truncate">{ticket.order_id}</span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="truncate">{ticket.customer_name}</span>
                                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                    <span className="uppercase tracking-wider text-[10px]">{ticket.stage.replace(/_/g, ' ')}</span>
                                                </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {!query && recentSearches.length > 0 && (
                                <CommandGroup heading="Recent Searches">
                                    {recentSearches.map((term) => (
                                        <CommandItem
                                            key={term}
                                            onSelect={() => {
                                                setQuery(term);
                                                // trigger search
                                            }}
                                            className="flex items-center justify-between px-3 py-2 cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground rounded-md group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <History className="h-4 w-4 text-muted-foreground" />
                                                <span>{term}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => removeRecentSearch(term, e)}
                                            >
                                                <ArrowRight className="h-3 w-3" />
                                            </Button>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </div>
                )}
            </Command>
        </div>
    );
}
