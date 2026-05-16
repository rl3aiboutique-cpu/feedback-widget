import { Inbox, MessageSquarePlus } from "lucide-react";
import type { ReactElement } from "react";

export type FeedbackTab = "compose" | "mine";

export interface FeedbackTabsProps {
  activeTab: FeedbackTab;
  mineTotalCount: number;
  /** Count of feedback rows where the admin posted since user's last view. */
  unreadAdminRepliesCount?: number;
  onTabChange: (tab: FeedbackTab) => void;
}

export function FeedbackTabs({
  activeTab,
  mineTotalCount,
  unreadAdminRepliesCount = 0,
  onTabChange,
}: FeedbackTabsProps): ReactElement {
  return (
    <div
      className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "compose"}
        onClick={() => onTabChange("compose")}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
          activeTab === "compose"
            ? "bg-card text-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-feedback-id="feedback.tab.compose"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        <span>New feedback</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "mine"}
        onClick={() => onTabChange("mine")}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
          activeTab === "mine"
            ? "bg-card text-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-feedback-id="feedback.tab.mine"
      >
        <Inbox className="h-3.5 w-3.5" />
        <span>My tickets</span>
        {mineTotalCount > 0 ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              unreadAdminRepliesCount > 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/15 text-muted-foreground"
            }`}
            title={
              unreadAdminRepliesCount > 0
                ? `${unreadAdminRepliesCount} with a reply from the team`
                : `${mineTotalCount} total`
            }
          >
            {unreadAdminRepliesCount > 0 ? unreadAdminRepliesCount : mineTotalCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
