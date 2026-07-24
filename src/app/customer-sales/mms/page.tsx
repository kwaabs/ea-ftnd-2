import { redirect } from "next/navigation"

export default function MmsCustomerSalesRedirect() {
  redirect("/customer-sales/prepaid?source=mms")
}
