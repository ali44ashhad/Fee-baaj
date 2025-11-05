"use client"

import * as React from "react"

interface SidebarContextValue {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

interface SidebarProviderProps {
  children: React.ReactNode
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isOpen, setIsOpen] = React.useState<boolean>(true)
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setIsOpen(false)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return <SidebarContext.Provider value={{ isOpen, setIsOpen, isMobile }}>{children}</SidebarContext.Provider>
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Sidebar({ children, className = "", ...props }: SidebarProps) {
  const { isOpen, setIsOpen, isMobile } = useSidebar()
  const sidebarRef = React.useRef<HTMLDivElement>(null)

  // Handle click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMobile, isOpen, setIsOpen])

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300 ease-in-out"
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-white transition-transform duration-300 ease-in-out md:static ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${className}`}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SidebarContent({ children, className = "", ...props }: SidebarContentProps) {
  return (
    <div className={`flex-1 overflow-auto ${className}`} {...props}>
      {children}
    </div>
  )
}

interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function SidebarTrigger({ className = "", ...props }: SidebarTriggerProps) {
  const { setIsOpen } = useSidebar()

  return (
    <button
      type="button"
      onClick={() => setIsOpen((prev: boolean) => !prev)}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
      {...props}
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  )
}

interface SidebarInsetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SidebarInset({ children, className = "", ...props }: SidebarInsetProps) {
  const { isOpen, isMobile } = useSidebar()

  return (
    <div
      className={`flex flex-1 flex-col transition-[margin] duration-300 ease-in-out ${
        //isOpen && isMobile ? "ml-72" : "ml-0"
        ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

