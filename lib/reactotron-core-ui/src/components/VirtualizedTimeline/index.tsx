import React, { useRef, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import styled from "styled-components"

const VirtualizedContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
`

const VirtualizedInner = styled.div`
  position: relative;
  width: 100%;
`

const VirtualizedItem = styled.div<{ $height: number }>`
  min-height: ${props => props.$height}px;
`

interface VirtualizedTimelineProps {
  items: any[]
  itemHeight?: number
  renderItem: (item: any, index: number) => React.ReactNode
  getItemHeight?: (index: number) => number
  overscan?: number
}

const VirtualizedTimeline: React.FC<VirtualizedTimelineProps> = ({
  items,
  itemHeight = 80,
  renderItem,
  getItemHeight,
  overscan = 5,
}) => {
  const parentRef = useRef<HTMLDivElement>(null)

  const estimateSize = useCallback((index: number) => {
    return getItemHeight ? getItemHeight(index) : itemHeight
  }, [getItemHeight, itemHeight])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  })

  const getActualElementHeight = (element: HTMLElement) => {
    const firstChild = element.firstElementChild as HTMLElement
    return firstChild ? firstChild.getBoundingClientRect().height : element.getBoundingClientRect().height
  }

  const handleItemClick = useCallback((index: number, element: HTMLElement) => {
    const currentHeight = getActualElementHeight(element)
    virtualizer.resizeItem(index, currentHeight)
    
    // Detect height changes with ResizeObserver
    let timeoutId: NodeJS.Timeout
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const newHeight = getActualElementHeight(element)
        if (Math.abs(newHeight - currentHeight) > 1) {
          virtualizer.resizeItem(index, newHeight)
        }
      }, 50)
    })
    
    const firstChild = element.firstElementChild as HTMLElement
    if (firstChild) {
      resizeObserver.observe(firstChild)
    } else {
      resizeObserver.observe(element)
    }
    
    setTimeout(() => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }, 1000)
  }, [virtualizer])

  return (
    <>
      <VirtualizedContainer ref={parentRef}>
        <VirtualizedInner
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <VirtualizedItem
              key={virtualItem.key}
              $height={virtualItem.size}
              data-index={virtualItem.index}
              ref={(el) => {
                if (el) {
                  const height = getActualElementHeight(el)
                  virtualizer.resizeItem(virtualItem.index, height)
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onClick={(e) => {
                const element = e.currentTarget as HTMLElement
                handleItemClick(virtualItem.index, element)
              }}
            >
              {renderItem(items[virtualItem.index], virtualItem.index)}
            </VirtualizedItem>
          ))}
        </VirtualizedInner>
      </VirtualizedContainer>
    </>
  )
}

export default VirtualizedTimeline 