import { NavLink } from "react-router"

import { buttonVariants } from "@/components/ui/button"

const navigationItems = [
  { label: "Connection", to: "/connect" },
  { label: "Moments", to: "/dashboard" },
  { label: "Settings", to: "/settings" },
]

function PrimaryNav() {
  return (
    <nav aria-label="Primary navigation" className="flex items-center gap-1 rounded-2xl border border-border/60 bg-card/50 p-1">
      {navigationItems.map((item) => (
        <NavLink
          aria-label={item.label}
          className={({ isActive }) =>
            buttonVariants({
              size: "sm",
              variant: isActive ? "secondary" : "ghost",
            })
          }
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export { PrimaryNav }
