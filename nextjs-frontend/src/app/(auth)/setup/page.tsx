import type { Metadata } from "next";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return <SetupForm />;
}
