import { redirect } from "next/navigation"

/** AMR list lives under Postpaid SLT index; meter detail routes under /amr/[meter] stay. */
export default function AmrListRedirect() {
  redirect("/customer-sales/postpaid/amr")
}
