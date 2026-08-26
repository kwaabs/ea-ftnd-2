import { redirect } from "next/navigation"

// /districts has no list view of its own — only /districts/[district].
// Redirect to the homepage (which itself forwards to /dashboard once
// authenticated) instead of leaving this as a 404.
export default function DistrictsIndexPage() {
  redirect("/")
}
