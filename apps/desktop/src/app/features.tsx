import type { ComponentType } from "react";
import {
  Binary,
  Blocks,
  Braces,
  Clock3,
  Fingerprint,
  PackageOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { PluginCenterView, type PluginCenterViewProps } from "../features/plugins/PluginCenterView";
import { SettingsView } from "../features/settings/SettingsView";
import {
  EncodingToolView,
  JsonToolView,
  TimestampToolView,
  UuidHashToolView,
} from "../features/tools/BuiltinTools";

export type FeatureCategory = {
  id: string;
  titleKey: string;
  order: number;
};

export type BuiltinFeature = {
  id: string;
  titleKey: string;
  categoryId: string;
  icon: LucideIcon;
  order: number;
  component: ComponentType | ComponentType<PluginCenterViewProps>;
};

export const featureCategories: readonly FeatureCategory[] = [
  { id: "data", titleKey: "categories.data", order: 10 },
  { id: "conversion", titleKey: "categories.conversion", order: 20 },
  { id: "identity", titleKey: "categories.identity", order: 30 },
  { id: "plugins", titleKey: "categories.plugins", order: 80 },
  { id: "system", titleKey: "categories.system", order: 90 },
];

export const builtinFeatures: readonly BuiltinFeature[] = [
  {
    id: "tool.json",
    titleKey: "tools.json.title",
    categoryId: "data",
    icon: Braces,
    order: 10,
    component: JsonToolView,
  },
  {
    id: "tool.timestamp",
    titleKey: "tools.timestamp.title",
    categoryId: "conversion",
    icon: Clock3,
    order: 10,
    component: TimestampToolView,
  },
  {
    id: "tool.encoding",
    titleKey: "tools.encoding.title",
    categoryId: "conversion",
    icon: Binary,
    order: 20,
    component: EncodingToolView,
  },
  {
    id: "tool.uuid-hash",
    titleKey: "tools.uuid.title",
    categoryId: "identity",
    icon: Fingerprint,
    order: 10,
    component: UuidHashToolView,
  },
  {
    id: "plugin-center",
    titleKey: "pluginCenter.title",
    categoryId: "plugins",
    icon: Blocks,
    order: 10,
    component: PluginCenterView,
  },
  {
    id: "settings",
    titleKey: "navigation.settings",
    categoryId: "system",
    icon: Settings,
    order: 10,
    component: SettingsView,
  },
];

export const pluginIcons: Record<string, LucideIcon> = {
  binary: Binary,
  box: PackageOpen,
  braces: Braces,
  clock: Clock3,
  code: Binary,
  fingerprint: Fingerprint,
  plug: Blocks,
};
