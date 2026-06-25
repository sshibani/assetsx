"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Gauge,
  Globe,
  Grid2x2,
  Layers,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  "arrow-left": ArrowLeft,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  copy: Copy,
  download: Download,
  gauge: Gauge,
  globe: Globe,
  grid: Grid2x2,
  layers: Layers,
  list: List,
  more: MoreHorizontal,
  plus: Plus,
  search: Search,
  settings: Settings,
  share: Share2,
  sliders: SlidersHorizontal,
  trash: Trash2,
  upload: UploadCloud,
  "user-plus": UserPlus,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
