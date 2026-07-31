import { HelpCircle, Info, MessageSquare } from "lucide-react"
import Link from "next/link"

export function DashboardFooter() {
  return (
    <footer className="border-t mt-12 py-6 px-4 md:px-6">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © 2023 VIBRO Operational Excellence Tool. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/help"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Help</span>
            </Link>
            <Link
              href="/about"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-4 w-4" />
              <span>About</span>
            </Link>
            <Link
              href="/chat-support"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat Support</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
