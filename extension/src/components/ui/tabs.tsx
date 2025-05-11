import React, { createContext, useContext, useState } from "react"
import { cn } from "../../lib/utils"

// Context for tab state
const TabsContext = createContext<{
  selectedTab: string
  setSelectedTab: (id: string) => void
  tabsId: string
} | null>(null)

// Hook to use tabs context
const useTabsContext = () => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider")
  }
  return context
}

// Main Tabs container
interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
  id?: string
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
  id = "tabs-" + Math.random().toString(36).substr(2, 9)
}) => {
  // Use controlled or uncontrolled state
  const [selectedTabInternal, setSelectedTabInternal] = useState(defaultValue || "")
  
  const selectedTab = value !== undefined ? value : selectedTabInternal
  
  const setSelectedTab = (newValue: string) => {
    if (value === undefined) {
      setSelectedTabInternal(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ selectedTab, setSelectedTab, tabsId: id }}>
      <div className={cn("w-full", className)} data-tabs-container={id}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// Tab list component
interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export const TabsList: React.FC<TabsListProps> = ({ children, className }) => {
  const { tabsId } = useTabsContext()
  
  return (
    <div role="tablist" className={cn("flex rounded-md bg-gray-100 p-1", className)} data-tabs-list={tabsId}>
      {children}
    </div>
  )
}

// Individual tab trigger
interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className,
  disabled = false
}) => {
  const { selectedTab, setSelectedTab, tabsId } = useTabsContext()
  const isSelected = selectedTab === value
  
  return (
    <button
      role="tab"
      aria-selected={isSelected}
      aria-controls={`${tabsId}-panel-${value}`}
      id={`${tabsId}-tab-${value}`}
      disabled={disabled}
      onClick={() => setSelectedTab(value)}
      data-state={isSelected ? "active" : "inactive"}
      data-tabs-trigger={`${tabsId}-${value}`}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
        "px-3 py-1.5 flex-1",
        isSelected
          ? "bg-white text-blue-600 shadow-sm"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/70",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  )
}

// Tab content panel
interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className
}) => {
  const { selectedTab, tabsId } = useTabsContext()
  const isSelected = selectedTab === value
  
  if (!isSelected) return null
  
  return (
    <div
      role="tabpanel"
      id={`${tabsId}-panel-${value}`}
      aria-labelledby={`${tabsId}-tab-${value}`}
      data-state={isSelected ? "active" : "inactive"}
      data-tabs-content={`${tabsId}-${value}`}
      className={cn("mt-2 animate-in fade-in-10", className)}
    >
      {children}
    </div>
  )
} 