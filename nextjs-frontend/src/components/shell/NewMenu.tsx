"use client";
import { ArrowLeftRight, ChevronDown, Flag, Landmark, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Dropdown";
import { useCreate, type CreateKind } from "./CreateProvider";

export const CREATE_ITEMS: { kind: CreateKind; label: string; icon: typeof Plus }[] = [
  { kind: "transaction", label: "Transaction", icon: ArrowLeftRight },
  { kind: "account", label: "Account", icon: Landmark },
  { kind: "debt", label: "Debt", icon: Receipt },
  { kind: "goal", label: "Savings goal", icon: Flag },
];

/** Primary "New" dropdown in the top bar. */
export function NewMenu() {
  const create = useCreate();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" className="h-8 pr-2">
          <Plus /> New
          <ChevronDown className="opacity-70" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-44">
        {CREATE_ITEMS.map(({ kind, label, icon: Icon }) => (
          <MenuItem key={kind} onSelect={() => create(kind)}>
            <Icon /> {label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
