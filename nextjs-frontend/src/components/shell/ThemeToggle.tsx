"use client";
import { useColorScheme } from "@mui/material/styles";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/Dropdown";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tip } from "@/components/ui/Tooltip";

type Mode = "system" | "light" | "dark";

/** System / Light / Dark segmented control (Settings, More sheet). Drives MUI + Tailwind (".dark" on <html>). */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useColorScheme();
  return (
    <SegmentedControl<Mode>
      aria-label="Colour theme"
      size="sm"
      fullWidth
      className={className}
      value={(mode as Mode) ?? "system"}
      onChange={(m) => setMode(m)}
      options={[
        { value: "system", label: <span className="inline-flex items-center gap-1"><Monitor className="size-3.5" aria-hidden />System</span> },
        { value: "light", label: <span className="inline-flex items-center gap-1"><Sun className="size-3.5" aria-hidden />Light</span> },
        { value: "dark", label: <span className="inline-flex items-center gap-1"><Moon className="size-3.5" aria-hidden />Dark</span> },
      ]}
    />
  );
}

/** Top bar icon button with a System/Light/Dark menu. */
export function ThemeMenu() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode : mode;
  const Icon = resolved === "dark" ? Moon : Sun;
  return (
    <Menu>
      <Tip content="Theme" side="bottom">
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Colour theme">
            <Icon />
          </Button>
        </MenuTrigger>
      </Tip>
      <MenuContent align="end" className="min-w-40">
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={(mode as Mode) ?? "system"} onValueChange={(v) => setMode(v as Mode)}>
          <MenuRadioItem value="system">
            <Monitor /> System
          </MenuRadioItem>
          <MenuRadioItem value="light">
            <Sun /> Light
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <Moon /> Dark
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
