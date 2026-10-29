import { VISIBILITY_BADGE_CLASSES, VISIBILITY_LABELS, Visibility } from "@/lib/visibility";

type VisibilityBadgeProps = {
  visibility: Visibility;
  showPublic?: boolean;
  className?: string;
};

export function VisibilityBadge({ visibility, showPublic = false, className }: VisibilityBadgeProps) {
  if (visibility === Visibility.PUBLIC && !showPublic) return null;

  const classes = className ? `${VISIBILITY_BADGE_CLASSES[visibility]} ${className}` : VISIBILITY_BADGE_CLASSES[visibility];
  return <span className={classes}>{VISIBILITY_LABELS[visibility]}</span>;
}
