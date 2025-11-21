"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  sentAt: string;
  messageType?: string;
  [key: string]: any;
}

interface VirtualScrollOptions {
  containerHeight: number;
  estimatedItemHeight: number;
  overscan?: number;
  scrollToIndex?: number;
  onScroll?: (scrollTop: number) => void;
  onLoadMore?: () => void;
  loadMoreThreshold?: number;
}

interface VirtualItem<T> {
  index: number;
  start: number;
  size: number;
  item: T;
  isVisible: boolean;
}

interface ChatVirtualScrollResult<T extends ChatMessage> {
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  scrollElementProps: {
    ref: React.RefObject<HTMLDivElement>;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    style: React.CSSProperties;
  };
  scrollToItem: (index: number) => void;
  scrollToBottom: () => void;
  measureItem: (index: number, height: number) => void;
  isScrolledToBottom: boolean;
}

export function useChatVirtualScroll<T extends ChatMessage>(
  items: T[],
  options: VirtualScrollOptions
): ChatVirtualScrollResult<T> {
  const {
    containerHeight,
    estimatedItemHeight,
    overscan = 5,
    scrollToIndex,
    onScroll,
    onLoadMore,
    loadMoreThreshold = 100,
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const itemHeights = useRef<Map<number, number>>(new Map());
  const lastScrollTop = useRef(0);

  // Calculate item positions with measured heights
  const itemPositions = useMemo(() => {
    const positions: Array<{ start: number; size: number }> = [];
    let currentPosition = 0;

    for (let i = 0; i < items.length; i++) {
      const measuredHeight = itemHeights.current.get(i);
      const height = measuredHeight || estimatedItemHeight;

      positions.push({
        start: currentPosition,
        size: height,
      });

      currentPosition += height;
    }

    return positions;
  }, [items.length, estimatedItemHeight]);

  const totalHeight =
    itemPositions.length > 0
      ? itemPositions[itemPositions.length - 1].start +
        itemPositions[itemPositions.length - 1].size
      : 0;

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (itemPositions.length === 0) {
      return { start: 0, end: 0 };
    }

    // Find first visible item
    let start = 0;
    for (let i = 0; i < itemPositions.length; i++) {
      if (itemPositions[i].start + itemPositions[i].size > scrollTop) {
        start = i;
        break;
      }
    }

    // Find last visible item
    let end = start;
    const viewportBottom = scrollTop + containerHeight;
    for (let i = start; i < itemPositions.length; i++) {
      if (itemPositions[i].start < viewportBottom) {
        end = i;
      } else {
        break;
      }
    }

    // Apply overscan
    const overscanStart = Math.max(0, start - overscan);
    const overscanEnd = Math.min(itemPositions.length - 1, end + overscan);

    return { start: overscanStart, end: overscanEnd };
  }, [scrollTop, containerHeight, itemPositions, overscan]);

  // Create virtual items
  const virtualItems = useMemo(() => {
    const result: VirtualItem<T>[] = [];

    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (i < items.length && itemPositions[i]) {
        result.push({
          index: i,
          start: itemPositions[i].start,
          size: itemPositions[i].size,
          item: items[i],
          isVisible:
            i >= visibleRange.start + overscan &&
            i <= visibleRange.end - overscan,
        });
      }
    }

    return result;
  }, [visibleRange, items, itemPositions, overscan]);

  // Handle scroll events
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      const scrollHeight = e.currentTarget.scrollHeight;
      const clientHeight = e.currentTarget.clientHeight;

      setScrollTop(newScrollTop);

      // Check if scrolled to bottom
      const isAtBottom =
        Math.abs(scrollHeight - clientHeight - newScrollTop) < 10;
      setIsScrolledToBottom(isAtBottom);

      // Call onScroll callback
      onScroll?.(newScrollTop);

      // Check if we need to load more messages (when scrolling up)
      if (
        onLoadMore &&
        newScrollTop < loadMoreThreshold &&
        newScrollTop < lastScrollTop.current
      ) {
        onLoadMore();
      }

      lastScrollTop.current = newScrollTop;
    },
    [onScroll, onLoadMore, loadMoreThreshold]
  );

  // Scroll to specific item
  const scrollToItem = useCallback(
    (index: number) => {
      if (scrollElementRef.current && itemPositions[index]) {
        const scrollTop = itemPositions[index].start;
        scrollElementRef.current.scrollTop = scrollTop;
        setScrollTop(scrollTop);
      }
    },
    [itemPositions]
  );

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollElementRef.current) {
      const scrollTop = scrollElementRef.current.scrollHeight - containerHeight;
      scrollElementRef.current.scrollTop = scrollTop;
      setScrollTop(scrollTop);
      setIsScrolledToBottom(true);
    }
  }, [containerHeight]);

  // Measure item height
  const measureItem = useCallback((index: number, height: number) => {
    const currentHeight = itemHeights.current.get(index);
    if (currentHeight !== height) {
      itemHeights.current.set(index, height);
      // Force re-render to update positions
      setScrollTop((prev) => prev);
    }
  }, []);

  // Auto-scroll to specific index
  useEffect(() => {
    if (scrollToIndex !== undefined && scrollToIndex >= 0) {
      scrollToItem(scrollToIndex);
    }
  }, [scrollToIndex, scrollToItem]);

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (isScrolledToBottom && items.length > 0) {
      // Small delay to allow for DOM updates
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [items.length, isScrolledToBottom, scrollToBottom]);

  return {
    virtualItems,
    totalHeight,
    scrollElementProps: {
      ref: scrollElementRef,
      onScroll: handleScroll,
      style: {
        height: containerHeight,
        overflow: "auto",
        position: "relative",
      },
    },
    scrollToItem,
    scrollToBottom,
    measureItem,
    isScrolledToBottom,
  };
}

// Hook for measuring message heights automatically
export function useMessageHeightMeasurement() {
  const measureRef = useRef<(index: number, height: number) => void>();
  const observerRef = useRef<ResizeObserver>();

  const setMeasureFunction = useCallback(
    (fn: (index: number, height: number) => void) => {
      measureRef.current = fn;
    },
    []
  );

  const measureElement = useCallback(
    (element: HTMLElement | null, index: number) => {
      if (!element || !measureRef.current) return;

      // Initial measurement
      const height = element.getBoundingClientRect().height;
      measureRef.current(index, height);

      // Set up resize observer for dynamic content
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height;
          measureRef.current?.(index, newHeight);
        }
      });

      observerRef.current.observe(element);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    setMeasureFunction,
    measureElement,
  };
}
