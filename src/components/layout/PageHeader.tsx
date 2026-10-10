/**
 * src/components/layout/PageHeader.tsx
 * WHAT: The title block at the top of a page: a big title, a subtitle, an
 *       optional back button and an optional action on the right.
 * WHY : Every screen starts with the same visual rhythm, which makes the app
 *       feel like one product instead of many pages.
 */
"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/Button";
import { ArrowLeftIcon } from "@/components/ui/Icons";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back arrow that returns to the previous page. */
  back?: boolean;
  /** An explicit URL to go back to (used when history is unreliable). */
  backHref?: string;
  /** Right-hand action, usually a button or a filter icon. */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

/**
 * PageHeader
 * WHAT: Renders the header row.
 * WHY : Centralising it means changing the title size once updates the whole app.
 */
export function PageHeader({ title, subtitle, back = false, backHref, action, className, children }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className={cn("mb-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {back || backHref ? (
            <IconButton
              label="Go back"
              icon={<ArrowLeftIcon size={20} />}
              className="-ml-2 mr-1 mt-0.5"
              onClick={() => (backHref ? router.push(backHref) : router.back())}
            />
          ) : null}

          <div className="min-w-0">
            <h1 className="mc-page-title truncate">{title}</h1>
            {subtitle ? <p className="mc-page-subtitle">{subtitle}</p> : null}
          </div>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {/* Anything extra (filter chips, tabs) sits under the title. */}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
