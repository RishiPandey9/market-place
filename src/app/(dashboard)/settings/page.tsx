import { redirect } from "next/navigation";

// Bare /settings → the first tab.
export default function SettingsIndexPage() {
  redirect("/settings/profile");
}
